# Agentic content workflow

PortfolioMCP started as a recruiter-facing chat grounded in the candidate's
portfolio data. This extension reuses that same PortfolioMCP server as a
**capability layer** for a second, private workflow: researching current
tech news, finding topics genuinely connected to the candidate's real
background, drafting platform-specific content, and waiting for a human to
approve, reject, or request a revision before anything is posted.

Nothing here publishes automatically. See [Human review](#human-review--publishing) below.

![Research workflow and agents, showing connect, execute, and cleanup phases](diagrams/workflow-agents.svg)

For the conceptual "what actually makes this a workflow, and what makes
the agent parts agentic" question — with exact code citations — see
**[docs/WORKFLOW_VS_AGENTIC_AI.md](WORKFLOW_VS_AGENTIC_AI.md)**. This doc
covers the architecture; that one covers the *why it counts as each*.

## Architecture

```
scheduled-tasks cron (daily, 07:00 local)
   │
   ▼
server/agents/research_agent.py ──uses──> server/tools/news_tools.py (RSS)
   │                                └────> PortfolioMCP tools (via server/mcp_bridge.py)
   ▼
data/runs/<date>/recommendations.json   (3 structured recommendations)
   │
   ▼
/admin page (Next.js, private — not linked from the public nav)
   │  "Profile Based Research" (free-ranging) or "Search Topic" (focused
   │  keyword query) — both APPEND to today's list, not replace it, so
   │  the human curates one accumulating list with per-card "Remove"
   │  human picks a recommendation, clicks "Generate Draft"
   ▼
POST /api/content/generate (api/chat_server.py)
   │
   ▼
server/agents/content_agent.py ──uses──> PortfolioMCP tools
   │
   ▼
server/agents/validators.py (deterministic checks, no extra LLM call)
   │
   ▼
data/runs/<date>/drafts/<id>.json   (status: VALIDATED / GENERATED)
   │
   ▼
Human reviews in /admin: Approve / Reject / Request Revision
   │
   ├─ Reject          → draft deleted immediately
   ├─ Revise           → content_agent regenerates with feedback, same review loop
   └─ Approve          → draft shown as final text to copy-paste; "Mark Posted"
                          button deletes the record once the human confirms
                          it's actually posted
```

## Why two agents, not one

The research agent and content agent are two **separate, sequential**
single-agent runs, not a concurrent multi-agent system — deliberately, per
this project's existing scope decision against multi-agent architectures.
Each agent gets its own narrow goal and its own bounded tool-calling loop
(`server/agents/agent_runtime.py`, the same pattern `api/chat_server.py`
already used for the recruiter chat): the model decides which tools to call
and when it has enough information, up to a fixed round budget
(`AgentBudgetExceeded` is raised, not silently swallowed, if it runs out).

- **Research agent** (`server/agents/research_agent.py`): given only a
  goal ("find 3 content opportunities"), it decides for itself which RSS
  searches to run, which articles to read in full via `get_article`, and
  which PortfolioMCP tools to check the candidate's real background
  against. A real run typically issues 3-5 tool calls across news and
  portfolio tools before producing its 3 recommendations. `/admin` offers
  two entry points into the same agent: **"Profile Based Research"** (no
  topic — the agent free-ranges across both feeds) and **"Search Topic"**
  (a human-typed keyword passed as `topic` to `run_research()`, which
  focuses the agent's news queries on it). If a topic search's keyword
  doesn't match anything in either feed, the agent is instructed to say so
  honestly (`"No current articles matching '<topic>' were returned..."`)
  rather than force an unrelated article to fit — confirmed in a live run
  against `"kubernetes"`. Both entry points **append** to today's existing
  recommendations rather than replacing them, so the human builds up one
  list across multiple runs and prunes it with the per-card **Remove**
  button (`DELETE /api/research/recommendations/{id}`) — which deletes the
  recommendation and any draft already generated for it immediately, not
  archived, per the retention rule.
- **Content agent** (`server/agents/content_agent.py`): the topic,
  platform, and style are already fixed by the human's selection in
  `/admin`, so it doesn't get news tools — only PortfolioMCP tools, for
  pulling additional candidate detail it needs rather than inventing it.

## Tools

| Tool | Where | What |
|---|---|---|
| `search_techcrunch`, `search_verge`, `search_all_news` | `server/tools/news_tools.py` | Keyword search over each outlet's official RSS feed — no scraping, no API key |
| `get_article` | `server/tools/news_tools.py` | Fetches and extracts one article's full text by URL, for when a feed summary isn't enough |
| `get_skills`, `get_projects`, `get_experience`, `search_profile` | `server/portfolio_server.py` (existing PortfolioMCP tools, reused as-is) | The candidate's real, structured background — the grounding source for every relevance/personalization claim |

`server/agents/tool_registry.py` merges the two kinds (plain Python
functions and MCP-bridged tools) behind one `ToolSpec` list, so
`agent_runtime.py`'s loop doesn't need to know which kind of tool it's
calling — both go through the same Gemini function-calling round-trip.

## Prompts and grounding

Both agents' system prompts explicitly forbid inventing anything the tools
don't return — this is the same rule the recruiter chat already enforces,
extended to the research/content agents:

- The research agent must trace `why_it_matters` and `personal_relevance`
  back to `supporting_facts`, and is told to say a connection is
  "general/industry-level" rather than direct experience when that's the
  honest answer, instead of forcing a fit that isn't there.
- The content agent treats the recommendation's `supporting_facts` as
  ground truth and must call a PortfolioMCP tool rather than guess if it
  needs more candidate detail.
- `server/agents/validators.py` then runs a **deterministic** check (no
  extra LLM call, to save free-tier quota) that at least one supporting
  fact is reflected in the draft's actual text, plus a length check against
  the platform's target range (`server/config/platforms.py`). Failures are
  surfaced as `ValidationIssue`s in the admin UI, not silently hidden.

## Recommendation schema

```json
{
  "topic": "",
  "source": "",
  "source_url": "",
  "published_at": "",
  "why_it_matters": "",
  "personal_relevance": "",
  "suggested_angle": "",
  "recommended_platform": "linkedin | blog",
  "recommended_style": "educational | technical | storytelling | conversational",
  "confidence": 0.0,
  "supporting_facts": []
}
```

Platform requirements (`server/config/platforms.py`) and style arcs
(`server/config/styles.py`) are plain data, not code branches — adding a
new platform or style is a config edit, not a new agent path.

## State

Everything lives under `data/runs/<YYYY-MM-DD>/` as JSON files — no
database, matching this project's existing scope decision. See
`server/state.py`.

```
data/runs/2026-09-05/
├── recommendations.json     # the day's ResearchRun (3 Recommendations)
└── drafts/
    └── <draft_id>.json      # one Draft per generated/reviewed piece of content
```

**Retention: nothing is kept forever.**
- Unapproved/rejected runs and drafts are purged after 7 days
  (`state.purge_stale_runs()`, called at the start of every research run).
- An **approved** draft is kept only until the human clicks "Mark Posted"
  in `/admin` — that deletes the record immediately, on the theory that
  once it's live on LinkedIn/the blog, this project doesn't need its own
  copy.
- A **rejected** draft is deleted immediately, not archived.

`data/runs/` is git-ignored — it's ephemeral working state, not something
to commit.

## Human review & publishing

`REVISION_REQUESTED` and `APPROVED`/`REJECTED` are real states a human sets
via the `/admin` page's buttons — the workflow does not auto-approve or
auto-publish anything. Specifically:

- **Approve** shows the final draft text for the human to copy into
  LinkedIn/Medium themselves, then **Mark Posted** deletes the record once
  they confirm it's live.
- **Reject** deletes the draft immediately.
- **Request Revision** sends the human's free-text feedback back into the
  content agent, which regenerates the draft (the full feedback history is
  kept on the draft so a second round of feedback has the first round's
  context too) and re-runs validation.

Real API auto-publish to LinkedIn/Medium was considered and explicitly
deferred: LinkedIn's `w_member_social` scope needs product/scope review
(same-day to ~2 weeks, not guaranteed to land in any particular window),
and Medium has stopped issuing new integration tokens for posting to most
new accounts. Building against either would have meant either blocking on
an external review process or building against an API that might not be
obtainable at all — so this stayed a "copy-paste, then confirm" flow, with
real auto-publish left as a documented next phase once LinkedIn access is
actually in hand.

## Scheduling

A daily cron (`scheduled-tasks` MCP task `portfoliomcp-daily-research`,
07:00 local) runs `python server/agents/research_agent.py`, which purges
stale state, opens its own MCP session, runs the research agent, and saves
the day's `recommendations.json`. The `/admin` page's "Run Research Now"
button runs the same core logic (`research_agent.run_research()`) but
reuses the FastAPI process's already-open MCP session instead of spawning
a new subprocess, for a faster manual trigger during review.

## Known limitations

- **No auth on `/api/research/*` or `/api/content/*`.** This mirrors the
  rest of the project's explicit "no complex authentication" scope
  decision — don't expose this API publicly without adding some, since
  anyone who can reach it can trigger a research/content run (burning
  Gemini quota) or approve/reject drafts.
- **Deterministic validation only, not a second LLM fact-check pass** — the
  grounding check is a keyword-overlap heuristic against
  `supporting_facts`, not a semantic verification. It catches "this draft
  cites nothing from the research" but not a subtly wrong paraphrase of a
  real fact.
- **Free-tier Gemini quota** is shared with the recruiter chat and is the
  binding constraint on how often this can realistically run — see the
  quota notes in `docs/MCP.md`. `gemini-flash-lite-latest` is used
  throughout for its separate/higher quota bucket.
- **RSS-only news sources** (TechCrunch, The Verge) — broader coverage
  would mean adding more feeds to `server/tools/news_tools.py`'s `FEEDS`
  dict, not a different tool architecture.
