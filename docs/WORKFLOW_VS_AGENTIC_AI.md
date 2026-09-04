# Workflow vs. agentic AI — how this project actually uses each

This doc answers a question that isn't obvious from clicking around
`/admin`: *"Everything here is a manual click — trigger, then an agent
runs, then I click again, then another agent runs, then I copy-paste.
Where's the 'workflow'? Isn't this just a pile of separate features?"*

Short answer: **the workflow isn't the clicking — it's the state and
rules that connect the clicks.** The "agentic" part is a much narrower
thing, confined to two specific spots. This doc shows exactly where each
one lives in the code, with line numbers, so it's verifiable rather than
a claim.

## The core distinction

| | Functionality | Workflow | Agent |
|---|---|---|---|
| **What it is** | One action, no memory | A sequence of steps where state/rules connect them | A step where an LLM decides *what to do next*, not a fixed script |
| **What triggers the next step** | Nothing — it's a dead end | Code-enforced rules about what's legal next | The model's own reasoning, within a tool-call budget |
| **Example if this project *didn't* have it** | A generic "write me a post" text box | Each click would be independent — no evidence trail, no approval gate, no revision memory | A fixed pipeline: `search("AI")` → `generate()`, always, no matter what's actually in the news that day |
| **What it looks like here** | A single button in `/admin` | `Draft`/`Recommendation` status + `data/runs/` + the route logic in `api/chat_server.py` | `server/agents/research_agent.py`, `server/agents/content_agent.py` |

A system can have workflow *without* agents (a fixed approval pipeline
where every step is scripted). It can have agents *without* much workflow
(a single chatbot turn). This project pairs them deliberately: **workflow
supplies the structure and the safety rails, agents supply the two moments
where genuine judgment is needed** (what's worth writing about, how to
write it well).

## Where the workflow lives

### 1. A real state machine, not just UI screens

`server/schemas.py:11-19` defines the only statuses a `Draft` is allowed
to be in:

```python
DraftStatus = Literal[
    "GENERATED",
    "VALIDATED",
    "PENDING_REVIEW",
    "APPROVED",
    "REJECTED",
    "REVISION_REQUESTED",
    "FINAL",
]
```

This is a `Literal` type, not a free string — nothing anywhere in the
codebase can set a `Draft.status` to a value outside this list without
Pydantic rejecting it. That's the workflow's vocabulary.

### 2. Illegal transitions are blocked in code, not just hidden in the UI

`api/chat_server.py:497-509` (`mark_posted`):

```python
@app.post("/api/content/{draft_id}/mark-posted")
async def mark_posted(draft_id: str, day: str | None = None) -> dict:
    ...
    if draft.status != "APPROVED":
        raise HTTPException(
            status_code=400,
            detail=f"Draft {draft_id} is not APPROVED (status={draft.status}); "
            "approve it before marking it posted.",
        )
```

You cannot mark a draft posted unless it's `APPROVED` — the server checks
this itself, independent of whatever the frontend shows or hides. If a
bug ever put a "Mark Posted" button in front of a rejected draft, this
line stops it anyway. **That's the difference between a workflow rule and
a UI convention** — a UI convention can be bypassed by a stray click or a
bug; a server-enforced rule can't.

### 3. Data threads forward automatically — you never re-type it

`api/chat_server.py:399-414` (`generate_content`):

```python
@app.post("/api/content/generate", response_model=Draft)
async def generate_content(req: GenerateDraftRequest) -> Draft:
    ...
    rec = _find_recommendation(day, req.recommendation_id)
    content = await generate_draft(
        mcp_bridge, model_adapter,
        topic=rec.topic,
        platform=rec.recommended_platform,
        style=rec.recommended_style,
        suggested_angle=rec.suggested_angle,
        supporting_facts=rec.supporting_facts,
    )
    validation = validate_draft(content, rec.recommended_platform, rec.supporting_facts)
```

The click only sends `recommendation_id`. Every other input the content
agent uses — topic, platform, style, angle, and the evidence
(`supporting_facts`) the research agent already gathered — is pulled
automatically from the stored `Recommendation` and threaded straight into
the content agent's prompt. **The workflow is doing the remembering, not
you.**

Also on line 419 (the `validate_draft(...)` call): validation isn't
something you trigger — it runs automatically, inside the same click,
every single time a draft is generated. A draft is never allowed to reach
you without a validation result attached.

### 4. State that accumulates instead of resetting

`api/chat_server.py:466-494` (`revise_draft`):

```python
feedback_history = [*existing.revision_feedback, req.feedback]
content = await generate_draft(
    ...,
    revision_feedback=feedback_history,
)
...
existing.revision_feedback = feedback_history
existing.status = "VALIDATED" if validation.passed else "GENERATED"
```

If you request a second revision, the content agent's prompt includes
**both** rounds of feedback, not just the latest one — `feedback_history`
is appended to, never overwritten. A plain "regenerate" button would have
thrown the first round's notes away. This is workflow *memory*, encoded
as data (`Draft.revision_feedback: list[str]`), not a conversation the
human has to keep re-explaining.

### 5. Where all of this actually persists

Every piece of state above is backed by real files, not server memory —
so it survives between one click and the next (even across page
reloads): `server/state.py`, writing to `data/runs/<date>/recommendations.json`
and `data/runs/<date>/drafts/<id>.json`. See
[docs/AGENTIC_WORKFLOW.md](AGENTIC_WORKFLOW.md#state) for the full shape.

## Where the agentic part lives — and how it's different

The agent is a much smaller, more specific thing: **the two spots where
the next tool call isn't hardcoded**, from
`server/agents/agent_runtime.py:22-60`:

```python
async def run_agent(adapter, system_instruction, goal, tools, max_rounds=5) -> str:
    history = [Message(role="user", content=goal)]
    for round_num in range(max_rounds):
        response = adapter.generate(history, tools.specs, system_instruction)
        if not response.tool_calls:
            if response.text:
                return response.text
            raise AgentBudgetExceeded(...)
        for call in response.tool_calls:
            result_text = await tools.call(call.name, call.arguments)
            history.append(Message(role="tool", content=result_text, ...))
    raise AgentBudgetExceeded(...)
```

Notice what's *not* here: no `if topic == "AI": call search_techcrunch()`.
The loop just hands the model a goal and a list of tools, and lets it
decide — search TechCrunch or The Verge or both, read one article in
full or not, check `get_skills` or `get_projects` or neither, and when
it has enough to stop. A real research run typically makes 3-5 of these
tool-selection decisions per topic, and no two runs make the same ones.

`server/agents/research_agent.py` and `server/agents/content_agent.py`
are both thin wrappers around this same loop — same tool-selection
freedom, different goal and different tool list (the content agent only
gets PortfolioMCP tools, not news tools, since its topic is already fixed
by the human's selection).

**This is the actual test for "is this agentic":** if you can predict
every tool call in advance from the input alone, it's a script. If the
model is choosing — genuinely capable of taking a different path given
the same starting goal on a different day, because the news is
different — it's agentic. Both agents here pass that test; the workflow
gluing them to the human review steps does not (and isn't meant to).

## The concrete contrast

**If this were pure functionality (no workflow, no agent):**

> One generic "Write me a post" text box → you paste in a topic yourself
> → one LLM call → a completion appears → done. No research, no evidence
> trail, no rule about what "approved" means, no memory of past feedback.

**What's actually built:**

> Research is *evidence-gated* — every claim must trace to a
> `supporting_fact` the tools actually returned → that evidence *travels
> automatically* into content generation → every draft *must* pass
> through validation before you see it → "posted" is only reachable from
> "approved," enforced server-side, not just by hiding a button → revision
> feedback *accumulates* across rounds instead of resetting.

## FAQ

**"But I'm the one clicking every button — is a human-in-the-loop system
even a 'workflow' if nothing happens automatically end-to-end?"**

Yes — a workflow is defined by *what connects the steps*, not by *who
presses go*. A fully automatic pipeline with no state or rules
connecting its stages (cron job → script → done, no memory, no gates)
would arguably be less of a workflow than this is, despite requiring zero
clicks. Human-in-the-loop was also a deliberate design choice here, not a
missing feature — see
[docs/AGENTIC_WORKFLOW.md#human-review--publishing](AGENTIC_WORKFLOW.md#human-review--publishing)
for why nothing publishes automatically.

**"Why not make the whole thing one agent that does research, writing,
and posting end-to-end?"**

Because the two moments that need real judgment — *is this topic worth
writing about* and *is this draft good enough to publish* — are exactly
the moments a human should be checking, not delegating further. The
workflow puts a hard stop at both. See the project's explicit
"multi-agent architecture" and "automatic publishing" scope decisions in
[docs/AGENTIC_WORKFLOW.md](AGENTIC_WORKFLOW.md#why-two-agents-not-one).

## See also

- [docs/AGENTIC_WORKFLOW.md](AGENTIC_WORKFLOW.md) — the full architecture:
  tools, prompts, config, retention, scheduling, known limitations.
- [docs/MCP.md](MCP.md) — the underlying PortfolioMCP tools/resources both
  agents call into.
