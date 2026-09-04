"""
FastAPI service that bridges the Next.js chat UI to the PortfolioMCP server.

On startup it opens a single persistent MCP client session (stdio) to
server/portfolio_server.py and keeps it alive for the process lifetime.
Each /api/chat request runs a bounded tool-calling loop against Gemini:
the model decides which MCP tool(s) to call, we execute them against the
live MCP session, feed the results back, and repeat until the model gives
a final grounded answer or the tool-call budget runs out.
"""

import logging
import os
import re
import sys
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.genai import errors as genai_errors
from pydantic import BaseModel, EmailStr, Field

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))

from agents.content_agent import generate_draft  # noqa: E402
from agents.research_agent import run_research  # noqa: E402
from agents.validators import validate_draft  # noqa: E402
from gemini_adapter import GeminiAdapter  # noqa: E402
from mcp_bridge import McpBridge  # noqa: E402
from model_adapter import Message  # noqa: E402
from schemas import Draft, Recommendation, ResearchRun  # noqa: E402
import state  # noqa: E402

load_dotenv(ROOT / ".env")

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


# ---------------------------------------------------------------------------
# Admin: research recommendations + content draft review
#
# This is a private workflow surface (the /admin page in the frontend, not
# linked from the public recruiter-facing nav) for the candidate to review
# AI-generated content opportunities and drafts before anything is posted.
# No auth is wired up here — same explicit scope decision as the rest of
# this project ("complex authentication" is out of scope) — don't publish
# this API publicly without adding some.
# ---------------------------------------------------------------------------


def _find_recommendation(day: str, recommendation_id: str) -> Recommendation:
    run = state.load_research_run(day)
    if run is None:
        raise HTTPException(status_code=404, detail=f"No research run found for {day}.")
    for rec in run.recommendations:
        if rec.id == recommendation_id:
            return rec
    raise HTTPException(
        status_code=404, detail=f"Recommendation {recommendation_id} not found on {day}."
    )


def _load_draft_or_404(day: str, draft_id: str) -> dict:
    draft = state.load_draft(day, draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail=f"Draft {draft_id} not found on {day}.")
    return draft


class RunResearchRequest(BaseModel):
    # None = "Profile Based Research" (free-ranging, matched against the
    # candidate's real background). Set = a human-typed topic search that
    # still cross-references PortfolioMCP, but focuses the news search.
    topic: str | None = None


@app.post("/api/research/run", response_model=ResearchRun)
async def trigger_research(req: RunResearchRequest = RunResearchRequest()) -> ResearchRun:
    """Manual research trigger for the admin page — the same logic the
    daily cron runs, against this process's already-open MCP session. New
    recommendations are appended to today's existing run, not a replacement
    of it, so "Profile Based Research" and one or more topic searches build
    up one list the human curates with the per-card Remove action."""
    assert model_adapter is not None
    deleted = state.purge_stale_runs()
    if deleted:
        logger.info("purged stale run directories: %s", deleted)
    try:
        return await run_research(mcp_bridge, model_adapter, topic=req.topic)
    except Exception:
        logger.exception("manual research run failed")
        raise HTTPException(status_code=502, detail="Research run failed — see server logs.")


@app.get("/api/research/recommendations")
async def get_recommendations(day: str | None = None) -> ResearchRun:
    run = state.load_research_run(day or state.today_str())
    if run is None:
        raise HTTPException(status_code=404, detail="No research run found for that date.")
    return run


@app.delete("/api/research/recommendations/{recommendation_id}", response_model=ResearchRun)
async def remove_recommendation(recommendation_id: str, day: str | None = None) -> ResearchRun:
    """Drops a recommendation the human doesn't want to act on — permanently,
    not archived, per the no-long-term-storage rule. Also removes any draft
    already generated for it, since an orphaned draft with no recommendation
    behind it isn't reviewable."""
    day = day or state.today_str()
    run = state.remove_recommendation(day, recommendation_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"No research run found for {day}.")
    return run


class GenerateDraftRequest(BaseModel):
    recommendation_id: str
    date: str | None = None


@app.post("/api/content/generate", response_model=Draft)
async def generate_content(req: GenerateDraftRequest) -> Draft:
    assert model_adapter is not None
    day = req.date or state.today_str()
    rec = _find_recommendation(day, req.recommendation_id)

    try:
        content = await generate_draft(
            mcp_bridge,
            model_adapter,
            topic=rec.topic,
            platform=rec.recommended_platform,
            style=rec.recommended_style,
            suggested_angle=rec.suggested_angle,
            supporting_facts=rec.supporting_facts,
        )
    except Exception:
        logger.exception("content generation failed")
        raise HTTPException(status_code=502, detail="Content generation failed — see server logs.")

    validation = validate_draft(content, rec.recommended_platform, rec.supporting_facts)
    draft = Draft(
        id=uuid.uuid4().hex[:8],
        recommendation_id=rec.id,
        date=day,
        created_at=datetime.now().isoformat(),
        topic=rec.topic,
        platform=rec.recommended_platform,
        style=rec.recommended_style,
        content=content,
        supporting_facts=rec.supporting_facts,
        validation=validation,
        status="VALIDATED" if validation.passed else "GENERATED",
    )
    state.save_draft(day, draft.id, draft.model_dump())
    return draft


@app.get("/api/content/drafts")
async def list_content_drafts(day: str | None = None) -> list[dict]:
    return state.list_drafts(day or state.today_str())


@app.post("/api/content/{draft_id}/approve", response_model=Draft)
async def approve_draft(draft_id: str, day: str | None = None) -> Draft:
    day = day or state.today_str()
    draft = Draft.model_validate(_load_draft_or_404(day, draft_id))
    draft.status = "APPROVED"
    state.save_draft(day, draft.id, draft.model_dump())
    return draft


@app.post("/api/content/{draft_id}/reject")
async def reject_draft(draft_id: str, day: str | None = None) -> dict:
    """Rejected drafts aren't kept — REJECTED -> ARCHIVED means "gone", not
    "kept in an archive folder", per the no-long-term-storage decision."""
    day = day or state.today_str()
    _load_draft_or_404(day, draft_id)
    state.delete_draft(day, draft_id)
    return {"status": "rejected_and_deleted"}


class ReviseRequest(BaseModel):
    feedback: str
    date: str | None = None


@app.post("/api/content/{draft_id}/revise", response_model=Draft)
async def revise_draft(draft_id: str, req: ReviseRequest) -> Draft:
    assert model_adapter is not None
    day = req.date or state.today_str()
    existing = Draft.model_validate(_load_draft_or_404(day, draft_id))

    feedback_history = [*existing.revision_feedback, req.feedback]
    try:
        content = await generate_draft(
            mcp_bridge,
            model_adapter,
            topic=existing.topic,
            platform=existing.platform,
            style=existing.style,
            suggested_angle="",
            supporting_facts=existing.supporting_facts,
            revision_feedback=feedback_history,
        )
    except Exception:
        logger.exception("content revision failed")
        raise HTTPException(status_code=502, detail="Content revision failed — see server logs.")

    validation = validate_draft(content, existing.platform, existing.supporting_facts)
    existing.content = content
    existing.validation = validation
    existing.revision_feedback = feedback_history
    existing.status = "VALIDATED" if validation.passed else "GENERATED"
    state.save_draft(day, existing.id, existing.model_dump())
    return existing


@app.post("/api/content/{draft_id}/mark-posted")
async def mark_posted(draft_id: str, day: str | None = None) -> dict:
    """The user has pasted the approved draft into LinkedIn/Medium
    themselves and confirms it's live — the record is deleted immediately,
    matching the "nothing kept forever" retention rule."""
    day = day or state.today_str()
    draft = Draft.model_validate(_load_draft_or_404(day, draft_id))
    if draft.status != "APPROVED":
        raise HTTPException(
            status_code=400,
            detail=f"Draft {draft_id} is not APPROVED (status={draft.status}); "
            "approve it before marking it posted.",
        )
    state.delete_draft(day, draft_id)
    return {"status": "posted_and_deleted"}
