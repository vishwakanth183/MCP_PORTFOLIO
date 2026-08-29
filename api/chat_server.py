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
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from pydantic import BaseModel

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
    "dates, or achievements that the tools don't return. If the tools don't "
    "return information relevant to the question, say plainly that it isn't "
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
        response = model_adapter.generate(history, mcp_bridge.tools, SYSTEM_INSTRUCTION)

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


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "tools": [t.name for t in mcp_bridge.tools]}
