"""
FastAPI service that bridges the Next.js chat UI to the PortfolioMCP server.

On startup it opens a single persistent MCP client session (stdio) to
server/portfolio_server.py and keeps it alive for the process lifetime.
Each /api/chat request runs a bounded tool-calling loop against Gemini:
the model decides which MCP tool(s) to call, we execute them against the
live MCP session, feed the results back, and repeat until the model gives
a final grounded answer or the tool-call budget runs out.
"""

import json
import logging
import os
import re
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.genai import errors as genai_errors
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from pydantic import BaseModel, EmailStr, Field

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))

from gemini_adapter import GeminiAdapter  # noqa: E402
from model_adapter import Message, ToolSpec  # noqa: E402

load_dotenv(ROOT / ".env")

SERVER_SCRIPT = ROOT / "server" / "portfolio_server.py"
MAX_TOOL_ROUNDS = 4

SYSTEM_INSTRUCTION = (
    "You are the assistant embedded in a software engineer's portfolio site. "
    "Recruiters and hiring managers ask you questions about the candidate's "
    "skills, experience, and projects. Answer ONLY using information you "
    "retrieve via the available tools (get_skills, get_projects, "
    "get_experience, search_profile) — never invent employers, skills, "
    "dates, or achievements that the tools don't return. This includes "
    "individual fields: if a tool result is missing a specific detail (e.g. "
    "a project entry with no listed employer), do not fill the gap with a "
    "plausible-sounding guess — say that detail isn't specified rather than "
    "inventing one. If the tools don't return information relevant to the "
    "question at all, say plainly that it isn't "
    "in the candidate's portfolio data rather than guessing. For role-fit "
    "questions (e.g. 'why is this candidate good for a React role?'), call "
    "the relevant tools first and base your answer only on what they return."
)

logger = logging.getLogger("portfoliomcp.chat")
logging.basicConfig(level=logging.INFO)


class McpBridge:
    """Owns the single long-lived MCP client connection to the portfolio server."""

    def __init__(self) -> None:
        self._session: ClientSession | None = None
        self._session_cm = None
        self._stdio_cm = None
        self.tools: list[ToolSpec] = []

    async def start(self) -> None:
        server_params = StdioServerParameters(
            command=sys.executable, args=[str(SERVER_SCRIPT)]
        )
        self._stdio_cm = stdio_client(server_params)
        read, write = await self._stdio_cm.__aenter__()
        self._session_cm = ClientSession(read, write)
        self._session = await self._session_cm.__aenter__()
        await self._session.initialize()

        tool_list = await self._session.list_tools()
        self.tools = [
            ToolSpec(
                name=t.name,
                description=t.description or "",
                input_schema=t.inputSchema or {},
            )
            for t in tool_list.tools
        ]
        logger.info("MCP session ready, tools=%s", [t.name for t in self.tools])

    async def stop(self) -> None:
        if self._session_cm is not None:
            await self._session_cm.__aexit__(None, None, None)
        if self._stdio_cm is not None:
            await self._stdio_cm.__aexit__(None, None, None)

    async def call_tool(self, name: str, arguments: dict) -> str:
        assert self._session is not None
        result = await self._session.call_tool(name, arguments)
        return "\n".join(getattr(block, "text", str(block)) for block in result.content)

    async def read_resource(self, uri: str) -> Any:
        assert self._session is not None
        result = await self._session.read_resource(uri)
        text = "\n".join(getattr(c, "text", "") for c in result.contents)
        return json.loads(text)


def _retry_delay_seconds(exc: genai_errors.ClientError) -> float | None:
    """Pull the RetryInfo.retryDelay Gemini sends with a 429 (e.g. '16s')."""
    try:
        for detail in exc.details.get("error", {}).get("details", []):
            if detail.get("@type", "").endswith("RetryInfo"):
                match = re.match(r"([\d.]+)s?$", detail.get("retryDelay", ""))
                if match:
                    return float(match.group(1))
    except (AttributeError, TypeError, ValueError):
        pass
    return None


def _exhausted_quota_id(exc: genai_errors.ClientError) -> str | None:
    """Which quota bucket was hit, e.g. '...PerDay...' vs '...PerMinute...'.

    Gemini always includes a short RetryInfo.retryDelay even when the real
    constraint is the daily cap — that delay is misleading once the quotaId
    says PerDay, since the bucket won't actually clear for hours, not
    seconds. Check quotaId before trusting retryDelay."""
    try:
        for detail in exc.details.get("error", {}).get("details", []):
            for violation in detail.get("violations", []):
                if violation.get("quotaId"):
                    return violation["quotaId"]
    except (AttributeError, TypeError):
        pass
    return None


def _rate_limit_message(exc: genai_errors.ClientError) -> str:
    quota_id = _exhausted_quota_id(exc) or ""

    if "PerDay" in quota_id:
        return (
            "The chat model's free-tier **daily** request limit has been "
            "reached — this isn't a short wait, it resets on Google's daily "
            "quota rollover (typically midnight Pacific Time). Check "
            "https://ai.dev/rate-limit for your exact quota, or switch "
            "GEMINI_MODEL in .env to a model with separate/higher quota."
        )

    delay = _retry_delay_seconds(exc)
    if delay is None:
        return (
            "The chat model's free-tier rate limit was hit — please wait a "
            "few seconds and try again."
        )
    retry_at = (datetime.now() + timedelta(seconds=delay)).strftime("%H:%M:%S")
    return (
        f"The chat model's free-tier rate limit was hit — please try again "
        f"in about {round(delay)}s (around {retry_at})."
    )


mcp_bridge = McpBridge()
model_adapter: GeminiAdapter | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model_adapter
    await mcp_bridge.start()
    model_adapter = GeminiAdapter()
    yield
    await mcp_bridge.stop()


app = FastAPI(title="PortfolioMCP Chat API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatTurn] = []


class ToolCallLog(BaseModel):
    name: str
    arguments: dict
    result: str


class ChatResponse(BaseModel):
    reply: str
    tool_calls: list[ToolCallLog]


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    assert model_adapter is not None

    history: list[Message] = [
        Message(role=turn.role, content=turn.content) for turn in req.history
    ]
    history.append(Message(role="user", content=req.message))

    tool_log: list[ToolCallLog] = []

    for _ in range(MAX_TOOL_ROUNDS):
        try:
            response = model_adapter.generate(history, mcp_bridge.tools, SYSTEM_INSTRUCTION)
        except genai_errors.ClientError as exc:
            if exc.code == 429:
                logger.warning("Gemini rate limit hit: %s", exc)
                return ChatResponse(reply=_rate_limit_message(exc), tool_calls=tool_log)
            logger.exception("Gemini client error")
            return ChatResponse(
                reply="Something went wrong talking to the chat model. Please try again.",
                tool_calls=tool_log,
            )
        except genai_errors.ServerError:
            logger.exception("Gemini server error")
            return ChatResponse(
                reply="The chat model is temporarily unavailable. Please try again shortly.",
                tool_calls=tool_log,
            )

        if not response.tool_calls:
            reply = (
                response.text
                or "I don't have an answer for that based on the candidate's portfolio data."
            )
            return ChatResponse(reply=reply, tool_calls=tool_log)

        history.append(
            Message(
                role="assistant",
                content=response.text or "",
                tool_calls=response.tool_calls,
            )
        )

        for call in response.tool_calls:
            logger.info("tool_call name=%s arguments=%s", call.name, call.arguments)
            result_text = await mcp_bridge.call_tool(call.name, call.arguments)
            tool_log.append(
                ToolCallLog(name=call.name, arguments=call.arguments, result=result_text)
            )
            history.append(
                Message(
                    role="tool",
                    content=result_text,
                    tool_call_id=call.id,
                    name=call.name,
                )
            )

    return ChatResponse(
        reply="I looked into this but couldn't reach a confident answer within the tool-call budget.",
        tool_calls=tool_log,
    )


class ContactRequest(BaseModel):
    name: str = ""
    email: EmailStr
    subject: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=5000)


class ContactResponse(BaseModel):
    status: str


async def _send_contact_email(req: ContactRequest) -> None:
    """Relay a contact-form submission to the candidate's inbox via Resend's
    HTTP API (regular HTTPS, port 443).

    Switched from plain SMTP after confirming Render's free tier has no
    outbound route to SMTP servers at all (connection attempts failed with
    a 15s timeout on port 587 and "Network is unreachable" on 465, on every
    resolved address) — a common free-tier PaaS restriction to prevent spam.
    An HTTP API sidesteps that entirely since it isn't a blocked port.
    Raises on failure — the caller turns that into a 502."""
    api_key = os.environ["RESEND_API_KEY"]
    to_email = os.environ["CONTACT_EMAIL"]
    from_address = os.environ.get(
        "RESEND_FROM", "PortfolioMCP Contact <onboarding@resend.dev>"
    )

    sender_label = f"{req.name} <{req.email}>" if req.name else req.email
    body = f"From: {sender_label}\n\n{req.message}"

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "from": from_address,
                "to": [to_email],
                "subject": f"[Portfolio contact] {req.subject}",
                "text": body,
                "reply_to": req.email,
            },
        )
        response.raise_for_status()


@app.post("/api/contact", response_model=ContactResponse)
async def contact(req: ContactRequest) -> ContactResponse:
    required_env = ["RESEND_API_KEY", "CONTACT_EMAIL"]
    missing = [key for key in required_env if not os.environ.get(key)]
    if missing:
        logger.error("Contact form not configured, missing env vars: %s", missing)
        raise HTTPException(
            status_code=503,
            detail="The contact form isn't configured yet — missing Resend settings.",
        )

    try:
        await _send_contact_email(req)
    except Exception:
        logger.exception("Failed to send contact email")
        raise HTTPException(
            status_code=502,
            detail="Couldn't send your message right now — please try again shortly.",
        )

    return ContactResponse(status="sent")


@app.get("/api/portfolio")
async def portfolio() -> dict:
    """Renders the static portfolio page from the same MCP resources the
    demo client exercises — profile/skills/experience/projects are read via
    portfolio:// resources, not a duplicated copy of the JSON file."""
    return {
        "profile": await mcp_bridge.read_resource("portfolio://profile"),
        "skills": await mcp_bridge.read_resource("portfolio://skills"),
        "experience": await mcp_bridge.read_resource("portfolio://experience"),
        "projects": await mcp_bridge.read_resource("portfolio://projects"),
        "target_roles": await mcp_bridge.read_resource("portfolio://target_roles"),
        "certifications": await mcp_bridge.read_resource("portfolio://certifications"),
    }


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "tools": [t.name for t in mcp_bridge.tools]}
