"""
Provider-agnostic interface for the chat LLM.

Keeping this as a small abstract interface means the chat loop in
`api/chat_server.py` never talks to a specific provider's SDK directly —
swapping Gemini for another provider later means writing one new adapter
class, not touching the chat loop or the MCP wiring.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass
class ToolSpec:
    name: str
    description: str
    input_schema: dict[str, Any]


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]
    # Opaque provider-specific data that must be echoed back verbatim when
    # this call is replayed into history (e.g. Gemini's thought_signature).
    # Adapters that don't need it simply ignore it.
    provider_data: Any = None


@dataclass
class Message:
    """One turn of provider-agnostic chat history.

    role "tool" carries the JSON-serialized result of a prior tool call,
    identified by tool_call_id so multi-tool turns line up correctly.
    """

    role: Literal["user", "assistant", "tool"]
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_call_id: str | None = None
    name: str | None = None


@dataclass
class ModelResponse:
    text: str | None
    tool_calls: list[ToolCall]


class ModelAdapter(ABC):
    @abstractmethod
    def generate(
        self,
        history: list[Message],
        tools: list[ToolSpec],
        system_instruction: str,
    ) -> ModelResponse:
        """Given the conversation so far and the available MCP tools, return
        either tool call(s) to execute or a final text answer."""
        raise NotImplementedError
