# PortfolioMCP

A publicly deployable, MCP-powered portfolio: a recruiter or visitor can chat
with a candidate's portfolio and get grounded, factual answers about skills,
projects, experience and role fit — backed by a real Model Context Protocol
(MCP) server, not a hardcoded FAQ.

## Documentation

This README covers setup and a high-level overview. For depth:

- **[docs/MCP.md](docs/MCP.md)** — the MCP tools/resources/prompts this
  project exposes, why each exists, the exact request flow from a chat
  question to a grounded answer, and how to extend it.
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — how to deploy the frontend
  and backend on free hosting tiers, and why they need different kinds of
  hosts.

## Status

Weekend build, in progress.

- [x] Repository scaffold (server / client / data / api / frontend)
- [x] Portfolio JSON (`data/portfolio.json`) filled with real candidate data
- [x] MCP server with tools, resources and prompts (`server/portfolio_server.py`)
- [x] MCP client that discovers and exercises the server (`client/portfolio_client.py`)
- [x] Gemini-backed chat loop over the MCP tools (`api/chat_server.py`), verified against a real key
- [x] Next.js portfolio + chat UI (`frontend/`)
- [x] Initial failure-case testing (unknown project, hallucination fix — see [docs/MCP.md](docs/MCP.md))
- [ ] More failure-case coverage (ambiguous questions, empty search)
- [ ] Public deployment (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the plan)

## Architecture

```
Next.js Portfolio + Chat UI  -->  FastAPI Chat Service  -->  Python MCP Client  -->  Python MCP Server  -->  data/portfolio.json
                                        |                                                  ^
                                        `---------------------- Gemini (tool-calling) ------'
```

The MCP server (`server/portfolio_server.py`) exposes:

- **Tools** (actions/queries): `get_skills`, `get_projects`, `get_experience`, `search_profile`
- **Resources** (stable read-only context): `portfolio://profile`, `portfolio://skills`,
  `portfolio://experience`, `portfolio://projects`
- **Prompts** (reusable interaction patterns): `recruiter_summary`, `technical_profile`,
  `project_summary` — discoverable and demonstrated by the standalone client;
  see [docs/MCP.md](docs/MCP.md) for their current status relative to the live chat

`api/chat_server.py` is a FastAPI service that keeps one persistent MCP client
session open and:

- serves `GET /api/portfolio` for the Next.js landing page by reading the
  `portfolio://` resources (no duplicated data file for the frontend),
- serves `POST /api/chat`, which runs a bounded loop letting Gemini decide
  which MCP tool(s) to call, executes them against the live MCP session, and
  returns a grounded answer plus a log of which tools were used.

The LLM provider is isolated behind `server/model_adapter.py` (a small
`ModelAdapter` interface) so swapping Gemini for another provider later means
writing one new adapter class, not touching the chat loop.

## Repository layout

```
PortfolioMCP/
├── data/
│   └── portfolio.json       # single source of truth for candidate data
├── server/
│   ├── portfolio_data.py    # loads the JSON data
│   ├── portfolio_server.py  # FastMCP server: tools, resources, prompts
│   ├── model_adapter.py     # provider-agnostic LLM interface
│   └── gemini_adapter.py    # Gemini function-calling implementation
├── client/
│   └── portfolio_client.py  # standalone MCP client for local testing
├── api/
│   └── chat_server.py       # FastAPI service: /api/portfolio, /api/chat
└── frontend/                # Next.js portfolio + chat UI
```

## Local setup

### Backend (MCP server + chat API)

1. Create and activate a virtual environment, then install dependencies:

   ```bash
   python -m venv .venv
   .venv\Scripts\activate   # Windows
   pip install -r requirements.txt
   ```

2. Copy `.env.example` to `.env` and add a free
   [Google AI Studio](https://aistudio.google.com/apikey) API key:

   ```bash
   copy .env.example .env
   ```

3. (Optional) Verify the MCP core on its own — spawns the server over stdio,
   discovers its tools/resources/prompts, and exercises a few of each:

   ```bash
   python client/portfolio_client.py
   ```

4. Start the chat API (keeps one MCP session alive for the process lifetime):

   ```bash
   uvicorn api.chat_server:app --reload --port 8000
   ```

   `GET http://localhost:8000/api/health` should list the four tools.

### Frontend (Next.js)

1. Copy `frontend/.env.local.example` to `frontend/.env.local` (defaults to
   `http://localhost:8000` for the backend).
2. Install and run:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. Open `http://localhost:3000` — the portfolio page and chat widget should
   both load from the running backend.

## What this project deliberately does not include

No NestJS backend, no database or vector store, no RAG/embeddings, no
multi-agent system, no automatic social posting, no complex auth, and no
sprawling tool surface — the goal is a small, explainable MCP demonstration,
not production infrastructure.

## Sample questions the chat should be able to answer

- "What frontend frameworks does this candidate know?"
- "Tell me about the Merchant Portal project."
- "Why would this candidate be a good fit for a React role?"
- "Has this candidate worked with Kubernetes in production?" (should say "not
  found in the data" rather than guessing, since Kubernetes only appears as a
  certification topic, not production experience)
