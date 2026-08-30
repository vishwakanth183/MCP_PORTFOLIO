---
name: portfoliomcp-dev
description: Orientation and known gotchas for developing PortfolioMCP, the MCP-powered portfolio + chat project in this repo. Use this whenever working on this codebase — running or debugging the FastAPI chat server (api/chat_server.py), the Next.js frontend, the MCP server/client (server/, client/), editing data/portfolio.json, touching the Gemini adapter, or preparing to deploy. Also consult it before testing chat questions against the live Gemini API key, since the free tier has a very low daily quota that is easy to exhaust by accident. Covers real bugs already hit and fixed once (retired model names, a thought_signature replay requirement, misleading rate-limit messages, a hallucination caused by missing data) so a future session doesn't rediscover them from scratch.
---

# PortfolioMCP dev orientation

PortfolioMCP is a recruiter-facing portfolio site with an MCP-powered chat:
a visitor asks a question, an LLM (Gemini) decides which MCP tool(s) to call
against the candidate's data, and answers must be grounded only in what the
tools return — never invented.

```
Next.js Portfolio + Chat UI  -->  FastAPI Chat Service  -->  Python MCP Client  -->  Python MCP Server  -->  data/portfolio.json
                                        |                                                  ^
                                        `---------------------- Gemini (tool-calling) ------'
```

Full docs — read these for depth, this skill is only the orientation layer:

- **[README.md](../../../README.md)** — project overview, repo layout, full local setup steps for backend + frontend.
- **[docs/MCP.md](../../../docs/MCP.md)** — the MCP tools/resources/prompts this project exposes, why each exists, and how to add a new one.
- **[docs/DEPLOYMENT.md](../../../docs/DEPLOYMENT.md)** — how to deploy the whole stack on free tiers.

## Where things live

| Concern | File |
|---|---|
| MCP server (tools/resources/prompts) | `server/portfolio_server.py` |
| Candidate data (single source of truth) | `data/portfolio.json` |
| Provider-agnostic LLM interface | `server/model_adapter.py` |
| Gemini implementation | `server/gemini_adapter.py` |
| FastAPI bridge (chat loop + portfolio API) | `api/chat_server.py` |
| Standalone MCP client (no LLM, no API key needed) | `client/portfolio_client.py` |
| Next.js UI | `frontend/src/app/page.tsx`, `frontend/src/components/Chat.tsx` |

## Before touching the Gemini/chat path: protect the quota

The free Gemini tier's real constraint is a **daily** cap (as low as 20
requests/day for some models), not the per-minute one you'd expect. A single
chat turn can burn 2-4 requests (one per tool-call round), and a debugging
session that fires several test questions can exhaust a whole day's quota in
minutes — this happened once already during initial development.

- **Prefer testing the MCP layer without burning LLM quota first.** Run
  `python client/portfolio_client.py` — it exercises tools/resources/prompts
  directly over stdio with no Gemini call at all. Most bugs in tool logic,
  schemas, or `data/portfolio.json` show up here for free.
- **When you do need to test the chat loop, do it deliberately**, not in a
  rapid loop. If you must fire several requests to reproduce something,
  consider it a real cost against the user's daily quota.
- **Don't restart the user's own dev server to test a fix.** If a backend is
  already running (e.g. on port 8000 via `uvicorn --reload`), start a second
  instance on a spare port (e.g. 8001) for your own testing so you don't
  interrupt their session — `uvicorn --reload` also auto-picks up your code
  edits on their existing instance anyway.
- If you see `RESOURCE_EXHAUSTED` / 429 and waiting the suggested
  `retryDelay` doesn't help, check the `quotaId` in the error details — if it
  contains `PerDay`, waiting seconds won't fix it (see the daily-cap handling
  in `_rate_limit_message` in `api/chat_server.py`). Switching `GEMINI_MODEL`
  in `.env` to a different model (e.g. `gemini-flash-lite-latest`) uses a
  separate quota bucket and can unblock testing immediately.

## Known gotchas already fixed once (don't rediscover these)

1. **Gemini model names churn.** `gemini-2.5-flash` was retired mid-project;
   the API's own 404 error named the replacement. If a model 404s, read the
   error message — it usually tells you the current name to use.
2. **`thought_signature` must be replayed verbatim.** Newer Gemini models
   attach a `thought_signature` to function-call parts in their response. If
   you rebuild that part for the next turn without it, Gemini 400s. This is
   why `ToolCall` (in `server/model_adapter.py`) carries an opaque
   `provider_data` field, and why `gemini_adapter.py` captures
   `part.thought_signature` and reattaches it — don't reconstruct
   `types.FunctionCall` parts from scratch when replaying history.
3. **FastMCP's JSON schemas need sanitizing for Gemini.** Pydantic emits
   `anyOf: [X, null]` for `Optional[X]` fields; Gemini's function-calling
   schema doesn't accept that. See `_simplify_schema` in
   `server/gemini_adapter.py` before changing tool signatures.
4. **Missing data fields cause hallucination, not silence.** When a tool
   result is missing a field the model wants (e.g. a project with no
   `company` listed), the model may invent a plausible-sounding value
   instead of admitting it doesn't know — even with a strict grounding
   system prompt. If a failure-case test surfaces an invented fact, check
   whether `data/portfolio.json` actually has that field before assuming the
   prompt needs more warnings. Both fixes belong together: complete the data
   AND keep the prompt explicit that missing fields must be reported as
   missing, not guessed.

## Editing `data/portfolio.json`

This is the single source of truth — the MCP resources, the tools, and the
frontend's static sections all read from it (the frontend never gets its own
copy; it calls `GET /api/portfolio`, which reads the MCP `portfolio://`
resources). Never invent candidate facts (employers, dates, skills,
achievements) to fill a gap — ask the user, or leave the field empty per the
existing schema. See [docs/MCP.md](../../../docs/MCP.md) for what each
resource/tool exposes from this file.
