"""Failure-case tests for the research agent's parsing and tool logic.

Deliberately dependency-free (no pytest) and doesn't call the real Gemini
API — it exercises the code paths that have to handle a misbehaving model
or an unreachable article, which is where real failures show up, without
spending free-tier quota on live calls. Run directly:

    python tests/test_research_agent.py
"""

import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))

from pydantic import ValidationError  # noqa: E402

from agents.research_agent import _parse_recommendations  # noqa: E402
from agents.tool_registry import ToolRegistry  # noqa: E402
from tools import news_tools  # noqa: E402

VALID_REC = {
    "topic": "Test topic",
    "source": "TechCrunch",
    "source_url": "https://example.com/a",
    "published_at": "2026-09-04",
    "why_it_matters": "matters",
    "personal_relevance": "relevant",
    "suggested_angle": "angle",
    "recommended_platform": "linkedin",
    "recommended_style": "technical",
    "confidence": 0.8,
    "supporting_facts": ["fact one"],
}


def test_parses_valid_json_array():
    recs = _parse_recommendations(json.dumps([VALID_REC, VALID_REC, VALID_REC]))
    assert len(recs) == 3
    assert recs[0].topic == "Test topic"
    print("ok: parses a valid JSON array")


def test_parses_json_wrapped_in_code_fence():
    text = "```json\n" + json.dumps([VALID_REC]) + "\n```"
    recs = _parse_recommendations(text)
    assert len(recs) == 1
    print("ok: strips ```json fences")


def test_parses_json_with_surrounding_prose():
    text = "Here are my picks:\n" + json.dumps([VALID_REC]) + "\nHope that helps!"
    recs = _parse_recommendations(text)
    assert len(recs) == 1
    print("ok: extracts JSON array from surrounding prose")


def test_rejects_missing_required_field():
    """Simulates the model returning an under-specified / unsupported-topic
    recommendation (e.g. no why_it_matters) — must fail loudly, not
    silently accept a hollow recommendation."""
    bad = {k: v for k, v in VALID_REC.items() if k != "why_it_matters"}
    try:
        _parse_recommendations(json.dumps([bad]))
    except ValidationError:
        print("ok: rejects a recommendation missing a required field")
        return
    raise AssertionError("expected a ValidationError for a missing required field")


def test_rejects_invalid_confidence_range():
    bad = {**VALID_REC, "confidence": 1.5}
    try:
        _parse_recommendations(json.dumps([bad]))
    except ValidationError:
        print("ok: rejects an out-of-range confidence value")
        return
    raise AssertionError("expected a ValidationError for confidence > 1.0")


def test_rejects_non_array_payload():
    try:
        _parse_recommendations(json.dumps({"not": "a list"}))
    except ValueError:
        print("ok: rejects a non-array JSON payload")
        return
    raise AssertionError("expected a ValueError for a non-list payload")


def test_get_article_unreachable_url_returns_error_not_exception():
    """Missing-data case: a dead/unreachable article URL must not crash the
    agent loop — it should come back as a tool result the model can react
    to."""
    result = news_tools.get_article("https://this-domain-does-not-exist.invalid/article")
    assert "error" in result
    print("ok: get_article degrades to an error dict instead of raising")


def test_search_empty_query_returns_recent_without_crashing():
    """Search tools have to behave with no keyword at all (e.g. the agent
    asking for 'recent news' generically)."""
    results = news_tools.search_all_news(query="", limit=1)
    assert isinstance(results, list)
    print("ok: empty-query search returns a list without crashing")


def test_search_obscure_query_returns_no_results_not_error():
    """Irrelevant/no-match case: an obscure query should return an empty
    list, not raise or hang."""
    results = news_tools.search_techcrunch(
        query="zzz_no_such_topic_should_ever_match_zzz", limit=5
    )
    assert results == []
    print("ok: no-match search returns an empty list")


def test_registry_unknown_tool_returns_error_json_not_exception():
    async def _run():
        registry = ToolRegistry()
        result = await registry.call("does_not_exist", {})
        data = json.loads(result)
        assert "error" in data

    asyncio.run(_run())
    print("ok: calling an unregistered tool name returns an error payload")


def main() -> None:
    tests = [obj for name, obj in globals().items() if name.startswith("test_")]
    failures = []
    for test in tests:
        try:
            test()
        except Exception as exc:  # noqa: BLE001
            failures.append((test.__name__, exc))
            print(f"FAIL: {test.__name__}: {exc}")

    print(f"\n{len(tests) - len(failures)}/{len(tests)} passed")
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
