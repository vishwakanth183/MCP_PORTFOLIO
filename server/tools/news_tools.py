"""RSS-based news tools for the research agent.

Uses each outlet's official RSS feed instead of scraping their HTML — free,
stable, no API key, no terms-of-service risk. get_article() fetches one
article's page for full text when a feed summary isn't enough detail.
"""

import re
from typing import Any

import feedparser
import httpx
from bs4 import BeautifulSoup

FEEDS = {
    "techcrunch": "https://techcrunch.com/feed/",
    "verge": "https://www.theverge.com/rss/index.xml",
}

_feed_cache: dict[str, list[dict]] = {}


def _load_feed(source: str) -> list[dict]:
    if source in _feed_cache:
        return _feed_cache[source]

    parsed = feedparser.parse(FEEDS[source])
    entries = [
        {
            "title": entry.get("title", ""),
            "url": entry.get("link", ""),
            "summary": _strip_html(entry.get("summary", "")),
            "published_at": entry.get("published", ""),
            "source": source,
        }
        for entry in parsed.entries
    ]
    _feed_cache[source] = entries
    return entries


def _strip_html(html: str) -> str:
    text = BeautifulSoup(html, "html.parser").get_text(separator=" ")
    return re.sub(r"\s+", " ", text).strip()


def _search(source: str, query: str, limit: int) -> list[dict]:
    entries = _load_feed(source)
    if not query:
        return entries[:limit]
    needle = query.lower()
    matches = [
        e for e in entries if needle in e["title"].lower() or needle in e["summary"].lower()
    ]
    return matches[:limit]


def search_techcrunch(query: str = "", limit: int = 5) -> list[dict[str, Any]]:
    """Search TechCrunch's current RSS feed for articles matching a keyword.

    Args:
        query: Keyword or phrase to match against title/summary. Empty
            returns the most recent articles regardless of topic.
        limit: Max number of articles to return.
    """
    return _search("techcrunch", query, limit)


def search_verge(query: str = "", limit: int = 5) -> list[dict[str, Any]]:
    """Search The Verge's current RSS feed for articles matching a keyword.

    Args:
        query: Keyword or phrase to match against title/summary. Empty
            returns the most recent articles regardless of topic.
        limit: Max number of articles to return.
    """
    return _search("verge", query, limit)


def search_all_news(query: str = "", limit: int = 5) -> list[dict[str, Any]]:
    """Search both TechCrunch and The Verge feeds at once for a keyword.

    Args:
        query: Keyword or phrase to match against title/summary.
        limit: Max number of articles to return per outlet.
    """
    return search_techcrunch(query, limit) + search_verge(query, limit)


def get_article(url: str) -> dict[str, Any]:
    """Fetch and extract the full text of one article by URL, for a deeper
    read than the RSS summary provides.

    Args:
        url: The article URL, as returned by search_techcrunch/search_verge.
    """
    try:
        response = httpx.get(
            url,
            timeout=10,
            headers={"User-Agent": "Mozilla/5.0 (PortfolioMCP research agent)"},
            follow_redirects=True,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        return {"url": url, "error": f"Could not fetch article: {exc}"}

    soup = BeautifulSoup(response.text, "html.parser")
    title_tag = soup.find("h1")
    title = title_tag.get_text(strip=True) if title_tag else ""

    paragraphs = [p.get_text(" ", strip=True) for p in soup.find_all("p")]
    text = " ".join(p for p in paragraphs if len(p) > 40)

    return {
        "url": url,
        "title": title,
        "text": text[:4000],
    }
