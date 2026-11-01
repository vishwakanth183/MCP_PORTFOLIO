import json
import math
from datetime import date
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "portfolio.json"


def experience_years(start: str, today: date | None = None) -> float:
    """Full years since `start` (ISO date), floored to one decimal so the
    figure never overstates experience (5.29 -> 5.2, not 5.3)."""
    today = today or date.today()
    days = (today - date.fromisoformat(start)).days
    return math.floor(days / 365.25 * 10) / 10


def load_data() -> dict:
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Experience is computed from the full-time start date rather than
    # stored, so the site and the chat never go stale. The internship is
    # listed separately and not counted in the total.
    profile = data.get("profile", {})
    start = profile.get("career_start_date")
    if start:
        years = experience_years(start)
        profile["total_experience_years"] = years
        profile["summary"] = profile.get("summary", "").replace("{years}", str(years))
    return data
