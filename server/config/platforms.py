"""Platform-specific content requirements, as plain configuration — no
platform-specific code branches in the content agent, just data it's handed."""

PLATFORMS: dict[str, dict] = {
    "linkedin": {
        "label": "LinkedIn",
        "audience": (
            "Recruiters, hiring managers, and fellow engineers scrolling a "
            "professional feed. Skimmed in seconds, not read like an article."
        ),
        "length": "150-300 words, short punchy paragraphs (1-3 sentences each)",
        "structure": (
            "Hook line (first 1-2 lines must work standalone, before 'see more' "
            "truncation) -> body -> a clear takeaway -> call to action"
        ),
        "cta": "Invite comments/discussion or a soft plug for the candidate's work (e.g. a project link), never a hard sales pitch",
        "style_notes": "Line breaks between thoughts, minimal jargon unless the audience clearly is technical, first person",
    },
    "blog": {
        "label": "Personal blog",
        "audience": (
            "Readers who clicked through wanting depth — other engineers, "
            "technical recruiters doing due diligence, or people researching the topic"
        ),
        "length": "500-900 words, proper sections with subheadings for anything technical",
        "structure": "Intro -> body sections -> conclusion with a takeaway",
        "cta": "Optional link to a related project or an invitation to connect",
        "style_notes": "Can go deeper technically than LinkedIn, code snippets/specifics welcome where relevant",
    },
}


def get_platform(name: str) -> dict:
    if name not in PLATFORMS:
        raise ValueError(f"Unknown platform '{name}'. Valid: {list(PLATFORMS)}")
    return PLATFORMS[name]
