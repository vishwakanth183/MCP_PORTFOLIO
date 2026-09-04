"""Unifies local Python tools (e.g. RSS news tools) and MCP-bridged tools
(PortfolioMCP) behind one ToolSpec list + dispatcher, so an agent's
tool-calling loop doesn't need to know which kind of tool it's calling."""

import inspect
import json
from dataclasses import dataclass
from typing import Any, Callable

from mcp_bridge import McpBridge
from model_adapter import ToolSpec


@dataclass
class LocalTool:
    spec: ToolSpec
    fn: Callable[..., Any]


class ToolRegistry:
    def __init__(self) -> None:
        self._local: dict[str, LocalTool] = {}
        self._mcp: McpBridge | None = None

    def register_local(self, name: str, description: str, input_schema: dict, fn: Callable) -> None:
        self._local[name] = LocalTool(
            spec=ToolSpec(name=name, description=description, input_schema=input_schema),
            fn=fn,
        )

    def register_mcp(self, bridge: McpBridge) -> None:
        self._mcp = bridge

    @property
    def specs(self) -> list[ToolSpec]:
        specs = [t.spec for t in self._local.values()]
        if self._mcp is not None:
            specs += self._mcp.tools
        return specs

    async def call(self, name: str, arguments: dict) -> str:
        if name in self._local:
            fn = self._local[name].fn
            result = fn(**arguments)
            if inspect.isawaitable(result):
                result = await result
            return result if isinstance(result, str) else json.dumps(result, default=str)

        if self._mcp is not None and any(t.name == name for t in self._mcp.tools):
            return await self._mcp.call_tool(name, arguments)

        return json.dumps({"error": f"Unknown tool '{name}'"})
