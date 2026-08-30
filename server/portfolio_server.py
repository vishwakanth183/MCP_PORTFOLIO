import json
from typing import Optional

from mcp.server.fastmcp import FastMCP

from portfolio_data import load_data

mcp = FastMCP("PortfolioMCP")


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@mcp.tool()
def get_skills(category: Optional[str] = None) -> dict:
    """Return the candidate's skills.

    Args:
        category: Optional skill category to filter by (e.g. "frontend",
            "backend", "cloud", "ai"). If omitted, all categories are returned.
    """
    skills = load_data().get("skills", {})
    if category:
        return {category: skills.get(category, [])}
    return skills


@mcp.tool()
def get_projects(name: Optional[str] = None) -> list:
    """Return the candidate's projects.

    Args:
        name: Optional case-insensitive substring to filter project names by.
            If omitted, all projects are returned.
    """
    projects = load_data().get("projects", [])
    if name:
        needle = name.lower()
        return [p for p in projects if needle in p.get("name", "").lower()]
    return projects


@mcp.tool()
def get_experience(company: Optional[str] = None) -> list:
    """Return the candidate's work experience.

    Args:
        company: Optional case-insensitive substring to filter by employer
            name. If omitted, the full experience history is returned.
    """
    experience = load_data().get("experience", [])
    if company:
        needle = company.lower()
        return [e for e in experience if needle in e.get("company", "").lower()]
    return experience


@mcp.tool()
def search_profile(query: str) -> dict:
    """Search across the whole portfolio (profile, skills, experience,
    projects, education, certifications) for a keyword or phrase and return
    the matching sections.

    Args:
        query: Free-text search term.
    """
    data = load_data()
    needle = query.lower()
    results = {}
    for section in (
        "profile",
        "skills",
        "experience",
        "projects",
        "education",
        "certifications",
    ):
        value = data.get(section)
        if value and needle in json.dumps(value).lower():
            results[section] = value
    if not results:
        return {"message": f"No portfolio data matched '{query}'."}
    return results


# ---------------------------------------------------------------------------
# Resources — stable, read-only portfolio context
# ---------------------------------------------------------------------------

@mcp.resource("portfolio://profile")
def profile_resource() -> str:
    """The candidate's profile summary (name, headline, location, links)."""
    return json.dumps(load_data().get("profile", {}), indent=2)


@mcp.resource("portfolio://skills")
def skills_resource() -> str:
    """The candidate's full skills breakdown by category."""
    return json.dumps(load_data().get("skills", {}), indent=2)


@mcp.resource("portfolio://experience")
def experience_resource() -> str:
    """The candidate's full work experience history."""
    return json.dumps(load_data().get("experience", []), indent=2)


@mcp.resource("portfolio://projects")
def projects_resource() -> str:
    """The candidate's full project list."""
    return json.dumps(load_data().get("projects", []), indent=2)


@mcp.resource("portfolio://target_roles")
def target_roles_resource() -> str:
    """The kinds of roles the candidate is targeting."""
    return json.dumps(load_data().get("target_roles", []), indent=2)


# ---------------------------------------------------------------------------
# Prompts — reusable interaction patterns for the LLM
# ---------------------------------------------------------------------------

@mcp.prompt()
def recruiter_summary() -> str:
    """Guide the model to produce a concise, factual recruiter-facing summary."""
    return (
        "You are helping a recruiter quickly evaluate a candidate. Use the "
        "get_skills, get_experience and get_projects tools and the portfolio:// "
        "resources to produce a concise, factual summary of the candidate's "
        "background and fit. Never invent skills, employers, or achievements "
        "that are not present in the retrieved data. If something is not "
        "covered by the data, say it is not available rather than guessing."
    )


@mcp.prompt()
def technical_profile() -> str:
    """Guide the model to produce a technical profile for an engineering audience."""
    return (
        "Produce a technical profile of the candidate for an engineering "
        "audience. Retrieve skills and experience via the MCP tools and "
        "resources, group them logically (e.g. by stack or domain), and "
        "highlight depth of experience with specific technologies. Cite only "
        "information present in the retrieved portfolio data."
    )


@mcp.prompt()
def project_summary(project_name: str) -> str:
    """Guide the model to explain a specific project in depth.

    Args:
        project_name: The name (or partial name) of the project to explain.
    """
    return (
        f"Explain the project '{project_name}' using the get_projects tool. "
        "Describe the problem it solved, the candidate's role, the "
        "technologies used, and the outcome or achievements. If no matching "
        "project is found in the data, say so instead of guessing."
    )


if __name__ == "__main__":
    mcp.run()
