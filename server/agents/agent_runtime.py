"""Bounded tool-calling agent loop, shared by the research and content
agents. Same pattern as api/chat_server.py's /api/chat loop: the model
decides which tool(s) to call each round, we execute them and feed results
back, until it returns final text or the round budget runs out."""

import logging

from google.genai import errors as genai_errors

from agents.tool_registry import ToolRegistry
from gemini_adapter import GeminiAdapter
from model_adapter import Message

logger = logging.getLogger("portfoliomcp.agent_runtime")


class AgentBudgetExceeded(Exception):
    """Raised when the agent used its full tool-call round budget without
    producing a final answer, so the caller can decide how to fail safely."""


async def run_agent(
    adapter: GeminiAdapter,
    system_instruction: str,
    goal: str,
    tools: ToolRegistry,
    max_rounds: int = 5,
) -> str:
    """Runs the tool-calling loop and returns the model's final text.

    Raises AgentBudgetExceeded if no final answer came back within
    max_rounds — callers should treat that as a failed run, not guess at a
    partial answer.
    """
    history: list[Message] = [Message(role="user", content=goal)]

    for round_num in range(max_rounds):
        try:
            response = adapter.generate(history, tools.specs, system_instruction)
        except (genai_errors.ClientError, genai_errors.ServerError):
            logger.exception("Gemini call failed on agent round %d", round_num)
            raise

        if not response.tool_calls:
            if response.text:
                return response.text
            raise AgentBudgetExceeded("Model returned neither text nor a tool call.")

        history.append(
            Message(role="assistant", content=response.text or "", tool_calls=response.tool_calls)
        )

        for call in response.tool_calls:
            logger.info("agent tool_call name=%s arguments=%s", call.name, call.arguments)
            result_text = await tools.call(call.name, call.arguments)
            history.append(
                Message(role="tool", content=result_text, tool_call_id=call.id, name=call.name)
            )

    raise AgentBudgetExceeded(f"Exceeded max_rounds={max_rounds} without a final answer.")
