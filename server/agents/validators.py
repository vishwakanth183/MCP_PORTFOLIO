"""Deterministic quality/fact checks run on a generated draft before it goes
to human review. Intentionally no extra LLM call here — these are
mechanical checks (length, required fields, claim grounding) that don't
need one, which also keeps the free-tier Gemini quota for the agents that
actually need to reason."""

import re

from config.platforms import get_platform
from schemas import ValidationIssue, ValidationResult

_WORD_RE = re.compile(r"[A-Za-z0-9']+")


def _word_count(text: str) -> int:
    return len(_WORD_RE.findall(text))


def _length_bounds(platform_cfg: dict) -> tuple[int, int]:
    match = re.search(r"(\d+)-(\d+)", platform_cfg["length"])
    if not match:
        return (0, 10_000)
    return int(match.group(1)), int(match.group(2))


def validate_draft(content: str, platform: str, supporting_facts: list[str]) -> ValidationResult:
    issues: list[ValidationIssue] = []

    if not content or not content.strip():
        issues.append(ValidationIssue(field="content", problem="Draft content is empty."))
        return ValidationResult(passed=False, issues=issues)

    platform_cfg = get_platform(platform)
    lo, hi = _length_bounds(platform_cfg)
    words = _word_count(content)
    # allow 25% slack on either side before flagging - a strict window makes
    # the check too brittle to be useful
    if words < lo * 0.75:
        issues.append(
            ValidationIssue(
                field="length",
                problem=f"Draft is {words} words, well under {platform_cfg['label']}'s "
                f"target range ({platform_cfg['length']}).",
            )
        )
    elif words > hi * 1.25:
        issues.append(
            ValidationIssue(
                field="length",
                problem=f"Draft is {words} words, well over {platform_cfg['label']}'s "
                f"target range ({platform_cfg['length']}).",
            )
        )

    if not supporting_facts:
        issues.append(
            ValidationIssue(
                field="supporting_facts",
                problem="No supporting facts were provided to ground this draft's claims.",
            )
        )
    else:
        content_lower = content.lower()
        grounded = 0
        for fact in supporting_facts:
            # crude but dependency-free: a fact is "reflected" if a
            # meaningfully long word from it shows up in the draft
            fact_words = [w for w in _WORD_RE.findall(fact.lower()) if len(w) > 4]
            if any(w in content_lower for w in fact_words):
                grounded += 1
        if supporting_facts and grounded == 0:
            issues.append(
                ValidationIssue(
                    field="grounding",
                    problem="None of the supplied supporting facts appear reflected in the "
                    "draft — it may be making claims that aren't grounded in the research.",
                )
            )

    # Only a genuinely broken draft (no content, no facts at all) blocks
    # review outright — length drift and weak grounding are surfaced as
    # flags for the human reviewer, not auto-rejected.
    hard_fail_fields = {"content"}
    hard_fail = any(i.field in hard_fail_fields for i in issues) or not supporting_facts
    return ValidationResult(passed=not hard_fail, issues=issues)
