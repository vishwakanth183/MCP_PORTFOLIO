"""Research agent: finds current tech news, cross-references it against the
candidate's PortfolioMCP data, and produces 3 structured content
opportunities for the Sunday content workflow to pick up.

Run directly (e.g. from the scheduled-tasks cron):
    python server/agents/research_agent.py
"""

import asyncio
import json
import logging
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "server"))

from dotenv import load_dotenv  # noqa: E402
from pydantic import ValidationError  # noqa: E402

from agents.agent_runtime import AgentBudgetExceeded, run_agent  # noqa: E402
from agents.tool_registry import ToolRegistry  # noqa: E402
from gemini_adapter import GeminiAdapter  # noqa: E402
from mcp_bridge import McpBridge  # noqa: E402
from schemas import Recommendation, ResearchRun  # noqa: E402
from state import (  # noqa: E402
    load_research_run,
    purge_stale_runs,
    save_research_run,
    today_str,
)
from tools import news_tools  # noqa: E402

load_dotenv(ROOT / ".env")

logger = logging.getLogger("portfoliomcp.research_agent")
logging.basicConfig(level=logging.INFO)

SYSTEM_INSTRUCTION = (
    "You are a research agent for a software engineer's personal content "
    "pipeline. Your job: find current technology news, then decide which "
    "articles are genuinely worth this specific candidate writing about, "
    "based on their real skills/projects/experience.\n\n"
    "Use search_techcrunch / search_verge / search_all_news to find "
    "candidate articles, and get_article to read one in more depth when a "
    "summary isn't enough. Use get_skills / get_projects / get_experience / "
    "search_profile (the candidate's real portfolio data) to check whether "
    "a topic actually connects to something the candidate has done — do "
    "NOT invent skills, projects, or experience the tools don't return. "
    "If a topic has no real connection to the candidate's background, "
    "either skip it or say plainly in personal_relevance that the "
    "connection is general/industry-level rather than direct experience.\n\n"
    "Investigate as many articles and portfolio tools as you need — you "
    "decide which sources to check and when you have enough to decide. "
    "When you are done, respond with ONLY a JSON array of exactly 3 "
    "objects (no prose, no markdown fences), each with these fields: "
    "topic, source, source_url, published_at, why_it_matters, "
    "personal_relevance, suggested_angle, recommended_platform "
    '("linkedin" or "blog"), recommended_style ("educational", '
    '"technical", "storytelling", or "conversational"), confidence '
    "(0.0-1.0), supporting_facts (array of short strings citing what the "
    "tools actually returned). Every claim in why_it_matters and "
    "personal_relevance must be traceable to a supporting_fact."
)

def _build_goal(topic: str | None) -> str:
    if topic:
        return (
            f"Focus your research specifically on this topic/keyword: '{topic}'. "
            "Use it as your primary query against the news search tools (try "
            "variations if the exact phrase returns nothing), then still "
            "cross-reference whatever you find against the candidate's real "
            "PortfolioMCP data. If nothing relevant to this topic turns up in "
            "either outlet's current feed, say so honestly in why_it_matters "
            "for that entry rather than forcing an unrelated article to fit. "
            "Recommend exactly 3 content opportunities as specified in your "
            "system instructions."
        )
    return (
        "Research today's technology news and the candidate's PortfolioMCP data, "
        "then recommend exactly 3 content opportunities as specified in your "
        "system instructions."
    )


def _build_tools(mcp_bridge: McpBridge) -> ToolRegistry:
    registry = ToolRegistry()
    registry.register_local(
        "search_techcrunch",
        "Search TechCrunch's current RSS feed for articles matching a keyword.",
        {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Keyword or phrase to search for."},
                "limit": {"type": "integer", "description": "Max articles to return."},
            },
        },
        news_tools.search_techcrunch,
    )
    registry.register_local(
        "search_verge",
        "Search The Verge's current RSS feed for articles matching a keyword.",
        {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Keyword or phrase to search for."},
                "limit": {"type": "integer", "description": "Max articles to return."},
            },
        },
        news_tools.search_verge,
    )
    registry.register_local(
        "search_all_news",
        "Search both TechCrunch and The Verge feeds at once for a keyword.",
        {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Keyword or phrase to search for."},
                "limit": {"type": "integer", "description": "Max articles to return per outlet."},
            },
        },
        news_tools.search_all_news,
    )
    registry.register_local(
        "get_article",
        "Fetch and extract the full text of one article by URL.",
        {
            "type": "object",
            "properties": {"url": {"type": "string", "description": "The article URL."}},
            "required": ["url"],
        },
        news_tools.get_article,
    )
    registry.register_mcp(mcp_bridge)
    return registry


def _parse_recommendations(raw_text: str) -> list[Recommendation]:
    text = raw_text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        text = match.group(0)

    data = json.loads(text)
    if not isinstance(data, list):
        raise ValueError("Expected a JSON array of recommendations.")

    recommendations = []
    for item in data:
        item.setdefault("id", uuid.uuid4().hex[:8])
        recommendations.append(Recommendation.model_validate(item))
    return recommendations


async def run_research(
    mcp_bridge: McpBridge, adapter: GeminiAdapter, topic: str | None = None
) -> ResearchRun:
    """Core research logic against an already-open MCP session and model
    adapter, so a long-lived caller (the FastAPI admin API) can reuse its
    existing connection instead of spawning a new MCP subprocess per run.
    The standalone CLI entrypoint (main(), below) owns its own bridge.

    New recommendations are appended to today's existing run rather than
    replacing it, so a profile-based run and one or more topic searches all
    build up one reviewable list the human can prune with "Remove" in
    /admin, instead of each call silently discarding the last one's work."""
    tools = _build_tools(mcp_bridge)
    goal = _build_goal(topic)
    raw_text = await run_agent(adapter, SYSTEM_INSTRUCTION, goal, tools, max_rounds=8)
    new_recommendations = _parse_recommendations(raw_text)

    existing = load_research_run(today_str())
    combined = (existing.recommendations if existing else []) + new_recommendations

    run = ResearchRun(
        run_id=uuid.uuid4().hex[:12],
        date=today_str(),
        created_at=datetime.now(timezone.utc).isoformat(),
        recommendations=combined,
    )
    path = save_research_run(run)
    logger.info(
        "saved %d recommendations (%d new) to %s",
        len(combined),
        len(new_recommendations),
        path,
    )
    return run


async def main() -> None:
    topic = " ".join(sys.argv[1:]).strip() or None

    deleted = purge_stale_runs()
    if deleted:
        logger.info("purged stale run directories: %s", deleted)

    mcp_bridge = McpBridge()
    await mcp_bridge.start()
    try:
        adapter = GeminiAdapter()
        try:
            run = await run_research(mcp_bridge, adapter, topic=topic)
        except AgentBudgetExceeded:
            logger.error("research agent exceeded its tool-call budget without a final answer")
            raise SystemExit(1)
        except (json.JSONDecodeError, ValueError, ValidationError) as exc:
            logger.error("research agent returned unparseable/invalid recommendations: %s", exc)
            raise SystemExit(1)
    finally:
        await mcp_bridge.stop()

    for rec in run.recommendations:
        print(f"- [{rec.recommended_platform}/{rec.recommended_style}] {rec.topic}")


if __name__ == "__main__":
    asyncio.run(main())
