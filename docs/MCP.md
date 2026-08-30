# MCP in PortfolioMCP

This document is the reference for how this project uses the Model Context
Protocol (MCP): what the server exposes, why each primitive exists, how the
pieces connect at runtime, and how to extend it. See [README.md](../README.md)
for setup and [DEPLOYMENT.md](DEPLOYMENT.md) for hosting.

## Why MCP here at all

The point of this project is to demonstrate MCP, not just to build a chatbot.
Concretely that means: a real MCP server with tools/resources/prompts, a real
MCP client that discovers and invokes them, and an LLM that is *handed* tool
access rather than having the candidate's data pasted into its prompt. The
LLM decides which tool to call for a given question; the answer is only ever
as good as what the tools return.

## The MCP server: `server/portfolio_server.py`

Built with **FastMCP** (`mcp.server.fastmcp.FastMCP`), running over **stdio**
transport — it's spawned as a subprocess by whichever client connects to it
(the demo client, or the FastAPI chat service), not run as a standalone
network service. `server/portfolio_data.py` loads `data/portfolio.json` fresh
on every call, so editing the JSON takes effect without restarting the
server.

### Tools — actions the LLM can invoke with arguments

| Tool | Argument | Returns | Why it exists |
|---|---|---|---|
| `get_skills` | `category` (optional) | skills dict, optionally filtered to one category | Lets the model answer narrow questions ("frontend skills?") without pulling the whole skills object every time. |
| `get_projects` | `name` (optional substring) | list of matching projects | Substring match so "tell me about the merchant app" resolves without exact-name matching. |
| `get_experience` | `company` (optional substring) | list of matching experience entries | Same pattern as `get_projects`, keyed on employer instead. |
| `search_profile` | `query` (required) | dict of whole *sections* (profile/skills/experience/projects/education/certifications) that contain the query string, or a "no match" message | The fallback for anything the other three don't cleanly cover — free-text search across the entire dataset. |

Design note: these are four tools, not one-per-field, deliberately — the plan
this project follows explicitly calls for "meaningful inputs/outputs rather
than one tool per field," partly because a sprawling tool surface is harder
to explain in an interview and harder for the model to pick correctly among.

### Resources — stable, read-only context

| URI | Content |
|---|---|
| `portfolio://profile` | name, headline, summary, location, years of experience, links |
| `portfolio://skills` | full skills-by-category object |
| `portfolio://experience` | full experience array |
| `portfolio://projects` | full projects array |
| `portfolio://target_roles` | list of roles the candidate is targeting (powers the frontend's rotating hero text) |

Resources exist for the same data as some of the tools, but the *use case*
differs: a resource is something a client reads because it wants the whole,
stable picture (e.g. rendering a portfolio page), while a tool is something a
model calls with a specific question in mind (e.g. "just the frontend
skills"). `api/chat_server.py`'s `GET /api/portfolio` endpoint is a concrete
example — the Next.js landing page renders entirely from these four
resources, not from a separate copy of the JSON file, so the visible site
(not just the demo client) exercises the resource layer.

### Prompts — reusable interaction patterns

| Prompt | Argument | Purpose |
|---|---|---|
| `recruiter_summary` | none | Guides a concise, factual recruiter-facing summary, sourced from tools/resources only. |
| `technical_profile` | none | Guides a technical, engineering-audience profile grouped by stack/domain. |
| `project_summary` | `project_name` | Guides an explanation of one specific project — problem, role, tech, outcome. |

**Current status — read this before assuming prompts drive the live chat:**
these three prompts are real MCP prompts, discoverable via
`session.list_prompts()` and demonstrated end-to-end in
`client/portfolio_client.py` (fetches `recruiter_summary`). The production
chat path in `api/chat_server.py`, however, uses its own hardcoded
`SYSTEM_INSTRUCTION` string for every question rather than selecting one of
these three prompts per request. That's a reasonable simplification for a
weekend build (one general-purpose grounding instruction covers all question
types adequately), but it means the *prompts* primitive is fully built and
demonstrable, just not yet wired into request routing. A natural extension:
detect intent (e.g. "summarize this candidate for a recruiter" →
`recruiter_summary`) and fetch the matching MCP prompt instead of the fixed
instruction — see "Extending this" below.

## The two MCP clients

There are two independent things that connect to `portfolio_server.py`:

1. **`client/portfolio_client.py`** — a standalone demonstration client. Its
   whole job is to prove the MCP layer works on its own, without any LLM or
   web UI involved: connect, list tools/resources/prompts, call two tools,
   read one resource, fetch one prompt. Run it any time you want to check
   the MCP layer in isolation (and it costs zero LLM API quota).
2. **`api/chat_server.py`'s `McpBridge`** — opens one persistent MCP session
   for the lifetime of the FastAPI process (see its `lifespan` context
   manager), rather than spawning a fresh server subprocess per request. This
   is the client actually used by the deployed chat and the portfolio page.

Both use `mcp.client.stdio.stdio_client` + `mcp.ClientSession` against the
same `portfolio_server.py` script — there's exactly one server
implementation, exercised by two different clients for two different
purposes.

## How a chat question actually flows

```
1. Browser POSTs { message, history } to /api/chat
2. chat_server builds provider-agnostic Message history
3. GeminiAdapter.generate(history, tools, system_instruction)
     - converts MCP ToolSpec list -> Gemini FunctionDeclaration list
       (sanitizing FastMCP's pydantic JSON Schema first — see gotcha below)
     - calls Gemini with automatic_function_calling DISABLED
       (the loop below is intentionally manual, not delegated to the SDK,
       so every tool call can be logged and grounded against the real
       MCP session rather than a Python function the SDK invokes itself)
4. Gemini returns either:
     a) tool_calls  -> chat_server executes each via mcp_bridge.call_tool(),
                        appends results to history, goes back to step 3
                        (bounded by MAX_TOOL_ROUNDS)
     b) final text   -> returned to the browser as { reply, tool_calls }
5. Frontend shows the reply, plus an expandable "MCP tools used" detail
   built from the tool_calls log — so a recruiter can literally see which
   MCP tool answered their question.
```

`server/model_adapter.py` defines the provider-agnostic shapes (`ToolSpec`,
`ToolCall`, `Message`, `ModelResponse`) so this loop in `chat_server.py`
never imports anything Gemini-specific — swapping providers means writing a
new class satisfying `ModelAdapter`, not touching the loop.

### Gemini-specific gotchas baked into `gemini_adapter.py`

- **Schema sanitizing.** FastMCP/pydantic emit `anyOf: [{"type": "string"},
  {"type": "null"}]` for `Optional[str]` parameters. Gemini's function-calling
  schema doesn't accept `anyOf` — `_simplify_schema` collapses it to the
  non-null type before building each `FunctionDeclaration`.
- **`thought_signature` replay.** Newer Gemini models attach a
  `thought_signature` to each function-call response part, and require it
  echoed back verbatim on the next turn or they reject the request. This is
  why `ToolCall` carries an opaque `provider_data` field (Gemini-specific,
  ignored by any other adapter) and why the history-to-Gemini-contents
  conversion reattaches it rather than rebuilding a bare `FunctionCall`.
- **Free-tier quota is tighter than it looks.** The stated per-minute limit
  is not the real constraint — some models cap free usage at as few as 20
  requests/**day**. `_rate_limit_message` checks the 429's `quotaId` for
  `PerDay` vs a real short-lived per-minute block, because Gemini's
  `retryDelay` field is misleading once the daily bucket is empty (it still
  reports a short delay even though waiting won't help).

## Extending this

**Add a new tool** in `server/portfolio_server.py`: write a function
decorated `@mcp.tool()`, return JSON-serializable data, and give it a
docstring — that docstring becomes the tool's `description` that the LLM
sees, so make it describe *when to call this* as much as *what it returns*.
No changes needed in `chat_server.py` or `gemini_adapter.py` — tools are
listed dynamically via `session.list_tools()` and converted generically.

**Add a new resource**: same idea with `@mcp.resource("portfolio://...")`.
If the frontend should render it, add a fetch to `GET /api/portfolio` in
`chat_server.py` and a matching field in `frontend/src/lib/api.ts`'s
`PortfolioData` type.

**Actually route to a prompt per intent**: in `chat_server.py`, before
calling `model_adapter.generate`, classify the incoming message (a cheap
model call, or simple keyword matching for something like "recruiter
summary") and fetch the matching prompt via
`mcp_bridge._session.get_prompt(name, arguments)` instead of the fixed
`SYSTEM_INSTRUCTION`. Keep the fallback to the general instruction for
questions that don't match a specific prompt.
