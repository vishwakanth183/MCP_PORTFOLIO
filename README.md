# PortfolioMCP

A publicly deployable, MCP-powered portfolio: a recruiter or visitor can chat
with a candidate's portfolio and get grounded, factual answers about skills,
projects, experience and role fit — backed by a real Model Context Protocol
(MCP) server, not a hardcoded FAQ.

## Status

Weekend build, in progress. See [`docs/plan.md`](docs/plan.md) (or the
original planning doc) for the full two-day plan.

- [x] Repository scaffold (server / client / data / frontend)
- [x] Portfolio JSON schema (`data/portfolio.json`) — **needs real candidate data**
- [x] MCP server with tools, resources and prompts (`server/portfolio_server.py`)
- [x] MCP client that discovers and exercises the server (`client/portfolio_client.py`)
- [ ] LLM-powered chat (tool-selection loop)
- [ ] Next.js portfolio + chat UI
- [ ] Public deployment

## Architecture

```
Next.js Portfolio + Chat UI  -->  Python MCP Client  -->  Python MCP Server  -->  data/portfolio.json
```

The MCP server exposes:

- **Tools** (actions/queries): `get_skills`, `get_projects`, `get_experience`, `search_profile`
- **Resources** (stable read-only context): `portfolio://profile`, `portfolio://skills`,
  `portfolio://experience`, `portfolio://projects`
- **Prompts** (reusable interaction patterns): `recruiter_summary`, `technical_profile`,
  `project_summary`

The chat layer will let an LLM decide which tool(s) to call for a given
question, and must answer only from data returned by those tools — if the
data doesn't support an answer, the system says so instead of guessing.

## Repository layout

```
PortfolioMCP/
├── data/
│   └── portfolio.json       # single source of truth for candidate data
├── server/
│   ├── portfolio_data.py    # loads/reloads the JSON data
│   └── portfolio_server.py  # FastMCP server: tools, resources, prompts
├── client/
│   └── portfolio_client.py  # standalone MCP client for local testing
└── frontend/                # Next.js portfolio + chat UI (WIP)
```

## Local setup

1. Create and activate a virtual environment, then install dependencies:

   ```bash
   python -m venv .venv
   .venv\Scripts\activate   # Windows
   pip install -r requirements.txt
   ```

2. Fill in `data/portfolio.json` with real (non-sensitive) candidate data —
   see the schema already in that file.

3. Run the client, which spawns the server over stdio, discovers its
   tools/resources/prompts, and exercises a few of each:

   ```bash
   python client/portfolio_client.py
   ```

   You should see the list of tools/resources/prompts, the result of calling
   `get_skills` and `get_projects`, the `portfolio://profile` resource, and
   the `recruiter_summary` prompt.

## What this project deliberately does not include

No NestJS backend, no database or vector store, no RAG/embeddings, no
multi-agent system, no automatic social posting, no complex auth, and no
sprawling tool surface — the goal is a small, explainable MCP demonstration,
not production infrastructure.

## Sample questions the chat should be able to answer

- "What frontend frameworks does this candidate know?"
- "Tell me about the \<project name\> project."
- "Why would this candidate be a good fit for a React role?"
- "Has this candidate worked with Kubernetes?" (should say "not found in the
  data" if true, rather than guessing)
