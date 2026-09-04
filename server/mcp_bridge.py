"""Shared MCP client bridge to the PortfolioMCP server.

Owns a single stdio connection to server/portfolio_server.py so any caller
(the FastAPI chat server, the research/content agents) can list its tools,
call them, and read its portfolio:// resources without re-implementing the
MCP session lifecycle each time.
"""

import json
import logging
import sys
from pathlib import Path
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from model_adapter import ToolSpec

SERVER_SCRIPT = Path(__file__).resolve().parent / "portfolio_server.py"

logger = logging.getLogger("portfoliomcp.mcp_bridge")


class McpBridge:
    """Owns a long-lived MCP client connection to the portfolio server."""

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
