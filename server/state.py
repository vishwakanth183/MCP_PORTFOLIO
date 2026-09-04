"""File-based state store for research runs and content drafts.

Everything lives under data/runs/<YYYY-MM-DD>/, one JSON file per run plus a
drafts/ subfolder — no database, matching the rest of this project. Nothing
is kept indefinitely: purge_stale_runs() deletes whole date directories once
they're older than RETENTION_DAYS, as long as they don't hold a draft that's
still APPROVED and waiting to be marked posted (that one is deleted the
instant it's marked posted instead, from mark_posted()).
"""

import json
import shutil
from datetime import date, datetime, timedelta
from pathlib import Path

from schemas import ResearchRun

ROOT = Path(__file__).resolve().parent.parent
RUNS_DIR = ROOT / "data" / "runs"
RETENTION_DAYS = 7


def today_str() -> str:
    return date.today().isoformat()


def run_dir(day: str | None = None) -> Path:
    d = RUNS_DIR / (day or today_str())
    d.mkdir(parents=True, exist_ok=True)
    (d / "drafts").mkdir(exist_ok=True)
    return d


def save_research_run(run: ResearchRun) -> Path:
    path = run_dir(run.date) / "recommendations.json"
    path.write_text(run.model_dump_json(indent=2), encoding="utf-8")
    return path


def load_research_run(day: str) -> ResearchRun | None:
    path = RUNS_DIR / day / "recommendations.json"
    if not path.exists():
        return None
    return ResearchRun.model_validate_json(path.read_text(encoding="utf-8"))


def remove_recommendation(day: str, recommendation_id: str) -> ResearchRun | None:
    """Drops one recommendation from a day's run permanently (not archived —
    matches the no-long-term-storage rule) and deletes any draft already
    generated for it, since a draft with no backing recommendation is
    orphaned. Returns the updated run, or None if the day has no run."""
    run = load_research_run(day)
    if run is None:
        return None

    run.recommendations = [r for r in run.recommendations if r.id != recommendation_id]
    save_research_run(run)

    for draft in list_drafts(day):
        if draft.get("recommendation_id") == recommendation_id:
            delete_draft(day, draft["id"])

    return run


def list_research_runs() -> list[ResearchRun]:
    if not RUNS_DIR.exists():
        return []
    runs = []
    for day_dir in sorted(RUNS_DIR.iterdir(), reverse=True):
        run = load_research_run(day_dir.name) if day_dir.is_dir() else None
        if run:
            runs.append(run)
    return runs


def draft_path(day: str, draft_id: str) -> Path:
    return run_dir(day) / "drafts" / f"{draft_id}.json"


def save_draft(day: str, draft_id: str, draft: dict) -> Path:
    path = draft_path(day, draft_id)
    path.write_text(json.dumps(draft, indent=2), encoding="utf-8")
    return path


def load_draft(day: str, draft_id: str) -> dict | None:
    path = draft_path(day, draft_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def delete_draft(day: str, draft_id: str) -> None:
    path = draft_path(day, draft_id)
    if path.exists():
        path.unlink()


def list_drafts(day: str) -> list[dict]:
    drafts_dir = run_dir(day) / "drafts"
    return [
        json.loads(p.read_text(encoding="utf-8")) for p in sorted(drafts_dir.glob("*.json"))
    ]


def purge_stale_runs(retention_days: int = RETENTION_DAYS) -> list[str]:
    """Delete date directories older than retention_days, unless they still
    hold an APPROVED draft (kept until mark_posted deletes it explicitly).
    Returns the list of deleted day strings."""
    if not RUNS_DIR.exists():
        return []

    cutoff = datetime.now() - timedelta(days=retention_days)
    deleted: list[str] = []

    for day_dir in RUNS_DIR.iterdir():
        if not day_dir.is_dir():
            continue
        try:
            day_date = datetime.strptime(day_dir.name, "%Y-%m-%d")
        except ValueError:
            continue
        if day_date >= cutoff:
            continue

        drafts = list_drafts(day_dir.name)
        if any(d.get("status") == "APPROVED" for d in drafts):
            continue

        shutil.rmtree(day_dir)
        deleted.append(day_dir.name)

    return deleted
