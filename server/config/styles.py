"""The 4 content styles, as the structural skeletons from the plan doc —
config the content agent follows, not hardcoded prompt branches."""

STYLES: dict[str, dict] = {
    "educational": {
        "label": "Educational",
        "arc": ["Hook", "Explain the concept", "Concrete example", "Why it matters", "Takeaway"],
        "tone": "Clear, teacherly, assumes the reader wants to learn something specific",
    },
    "technical": {
        "label": "Technical",
        "arc": ["Problem", "The technology", "How it works", "Technical insight", "Trade-off / takeaway"],
        "tone": "Precise, comfortable with jargon for a technical audience, opinionated about trade-offs",
    },
    "storytelling": {
        "label": "Storytelling",
        "arc": ["Hook", "Context", "Development", "Insight", "Conclusion"],
        "tone": "Narrative, personal voice, builds toward the insight rather than stating it upfront",
    },
    "conversational": {
        "label": "Conversational / Entertainment",
        "arc": ["Relatable hook", "Observation", "Connect to the technology", "Useful takeaway"],
        "tone": "Casual, first-person, light humor welcome, reads like a scroll-stopping take rather than an announcement",
    },
}


def get_style(name: str) -> dict:
    if name not in STYLES:
        raise ValueError(f"Unknown style '{name}'. Valid: {list(STYLES)}")
    return STYLES[name]
