"""Content agent: given a chosen recommendation (topic/platform/style,
already picked by the human) plus its supporting facts, drafts the actual
post. Has access to PortfolioMCP tools to pull additional candidate context
it needs rather than guessing — the topic and angle are fixed by the human's
selection, so it doesn't need news tools.
"""

import logging

from agents.agent_runtime import run_agent
from agents.tool_registry import ToolRegistry
from config.platforms import get_platform
from config.styles import get_style
from gemini_adapter import GeminiAdapter
from mcp_bridge import McpBridge

logger = logging.getLogger("portfoliomcp.content_agent")


def _build_tools(mcp_bridge: McpBridge) -> ToolRegistry:
    registry = ToolRegistry()
    registry.register_mcp(mcp_bridge)
    return registry


def _system_instruction(platform: str, style: str) -> str:
    platform_cfg = get_platform(platform)
    style_cfg = get_style(style)
    return (
        "You are a content-drafting agent writing on behalf of a specific "
        "software engineer, for their own professional content pipeline. "
        "You are given a topic, a suggested angle, and a list of "
        "supporting_facts that were already verified by a research step — "
        "treat those facts as the ground truth for what you may claim about "
        "the news topic and the candidate's background. If you need more "
        "detail about the candidate's real skills, projects, or experience "
        "to write convincingly, call get_skills / get_projects / "
        "get_experience / search_profile rather than inventing it. Never "
        "state a specific achievement, employer, technology, or metric that "
        "isn't backed by a supporting_fact or a tool result.\n\n"
        f"Platform: {platform_cfg['label']}\n"
        f"Audience: {platform_cfg['audience']}\n"
        f"Target length: {platform_cfg['length']}\n"
        f"Required structure: {platform_cfg['structure']}\n"
        f"Call to action: {platform_cfg['cta']}\n"
        f"Style notes: {platform_cfg['style_notes']}\n\n"
        f"Content style: {style_cfg['label']}\n"
        f"Follow this arc, in order: {' -> '.join(style_cfg['arc'])}\n"
        f"Tone: {style_cfg['tone']}\n\n"
        "When you are done, respond with ONLY the final draft text — no "
        "preamble, no markdown headers labeling the arc sections, no "
        "explanation of what you did. Just the post/article text itself, "
        "ready to publish as-is."
    )


def _build_goal(
    topic: str,
    suggested_angle: str,
    supporting_facts: list[str],
    revision_feedback: list[str] | None = None,
) -> str:
    facts_block = "\n".join(f"- {fact}" for fact in supporting_facts) or "(none provided)"
    goal = (
        f"Topic: {topic}\n"
        f"Suggested angle: {suggested_angle}\n"
        f"Supporting facts (from research, verified):\n{facts_block}\n\n"
        "Write the draft now."
    )
    if revision_feedback:
        feedback_block = "\n".join(f"- {fb}" for fb in revision_feedback)
        goal += (
            "\n\nThis is a REVISION. The human reviewer gave this feedback on "
            f"the previous draft — address it directly:\n{feedback_block}"
        )
    return goal


async def generate_draft(
    mcp_bridge: McpBridge,
    adapter: GeminiAdapter,
    topic: str,
    platform: str,
    style: str,
    suggested_angle: str,
    supporting_facts: list[str],
    revision_feedback: list[str] | None = None,
) -> str:
    """Returns the raw draft text. Caller is responsible for running
    validate_draft() and persisting the result via state.py."""
    tools = _build_tools(mcp_bridge)
    system_instruction = _system_instruction(platform, style)
    goal = _build_goal(topic, suggested_angle, supporting_facts, revision_feedback)
    return await run_agent(adapter, system_instruction, goal, tools, max_rounds=4)
