---
name: portfoliomcp-dev
description: Orientation and known gotchas for developing PortfolioMCP, the MCP-powered portfolio + chat project in this repo. Use this whenever working on this codebase — running or debugging the FastAPI chat server (api/chat_server.py), the Next.js frontend, the MCP server/client (server/, client/), editing data/portfolio.json, touching the Gemini adapter, styling nested scrollable containers, or deploying/debugging the live Vercel+Render deployment. Also consult it before testing chat questions against the live Gemini API key, since the free tier has a very low daily quota that is easy to exhaust by accident. Covers real bugs already hit and fixed once (retired model names, a thought_signature replay requirement, misleading rate-limit messages, a hallucination caused by missing data, Render blocking outbound SMTP entirely, a Vercel monorepo misdetection, and a stale-cached-GitHub-credential push failure) so a future session doesn't rediscover them from scratch.
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
| Next.js UI (main layout, sticky chat sidebar) | `frontend/src/app/page.tsx`, `frontend/src/components/Chat.tsx` |
| Certifications horizontal scroller (prev/next buttons, highlight logic) | `frontend/src/components/CertificationsScroller.tsx` |
| Contact form UI + delivery endpoint | `frontend/src/components/ContactForm.tsx`, `POST /api/contact` in `api/chat_server.py` |
| Candidate avatar (real supplied image, not generated) | `frontend/public/avatar.png`, rendered by `frontend/src/components/CodingAvatar.tsx` |
| Favicon (V monogram, matches theme gradient) | `frontend/src/app/icon.svg` / `icon.png` / `favicon.ico` |

## Live deployment

- Repo: `github.com/vishwakanth183/MCP_PORTFOLIO` (push as the `vishwakanth183` GitHub identity — see the git-push gotcha below if it 403s)
- Frontend (Vercel): `mcp-portfolio-ten.vercel.app` — Root Directory **must** be `frontend`, not the repo root
- Backend (Render): `vishwakanth-portfolio.onrender.com` — free tier, spins down after ~15 min idle (30-60s cold start on next request)

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
5. **Render's free tier has no outbound route to SMTP servers at all** —
   not just a slow/blocked port, a genuine network-level refusal. Confirmed
   by testing both ports: 587 hung for exactly the connect `timeout` value
   then failed, and 465 failed immediately with `OSError: [Errno 101]
   Network is unreachable` on every resolved address. This is why the
   contact form (`POST /api/contact`) sends via Resend's HTTP API
   (`https://api.resend.com/emails`, plain HTTPS) instead of `smtplib` —
   don't reintroduce raw SMTP for anything meant to run on Render. If you
   see a contact-form request take exactly as long as its timeout and then
   502, suspect this class of bug first, on any host, before assuming bad
   credentials.
6. **Resend's sandbox sender can only deliver to the Resend account's own
   email.** Without a verified custom domain, `onboarding@resend.dev` 403s
   with `"You can only send testing emails to your own email address
   (...)"` if `CONTACT_EMAIL` doesn't match the address the Resend API key's
   account was signed up with. Fix is to sign up (or use an existing
   account) with the *same* email you want mail delivered to, not a
   different one — not a code change.
7. **Nested scrollable containers don't reliably hide native scrollbar
   arrows in this dev environment** — only the root `html` element honors
   `::-webkit-scrollbar-button { display: none }`. The certifications
   strip, the chat message list, and the sticky sidebar all kept showing
   native stepper arrows despite that rule, so all three use `.thin-scrollbar`
   (hides the scrollbar entirely; wheel/trackpad still work) instead of a
   styled-but-visible variant. Don't reuse the styled `html` treatment on a
   non-root element without re-verifying live.
8. **A CSS Grid column won't shrink below its content's intrinsic width by
   default.** Putting the certifications horizontal-scroll strip inside the
   two-column layout's left column made the whole grid track (and the page)
   balloon to thousands of pixels wide instead of scrolling within its own
   box. Fix: `minmax(0,1fr)` on the grid-template-columns track *and*
   `min-w-0` on the grid item(s) containing wide/scrollable content —
   needed both, not just one.
9. **Vercel auto-detects the top-level `api/` folder as a Python serverless
   function if Root Directory isn't set.** This is a monorepo with a Next.js
   app under `frontend/` *and* a FastAPI service under `api/` at the repo
   root — Vercel's Python runtime detection finds `api/chat_server.py` and
   tries to deploy *that* instead of the Next.js app unless Project
   Settings → Root Directory is explicitly set to `frontend`. The FastAPI
   service is meant for Render, never Vercel.
10. **A trailing slash in `NEXT_PUBLIC_API_URL` produces a double-slash 404.**
    `${API_BASE_URL}/api/portfolio` doesn't collapse
    `.../onrender.com//api/portfolio`, and FastAPI won't route it. Fixed
    defensively in `frontend/src/lib/api.ts` (strips trailing slashes at the
    source), but worth knowing if a *different* double-slash 404 shows up
    somewhere this fix doesn't cover.
11. **A `git push` 403 with correct `git config user.email` can still be a
    stale cached credential.** Windows Credential Manager (Git Credential
    Manager) can hold a *different* GitHub account's token under a generic
    `git:https://github.com` target and silently reuse it regardless of the
    local git config. If push is denied to an account you know has access,
    check `cmdkey /list | findstr github` and `cmdkey /delete` the stale
    entries (don't guess which one — list first) to force a fresh
    interactive login as the right account.

## Editing `data/portfolio.json`

This is the single source of truth — the MCP resources, the tools, and the
frontend's static sections all read from it (the frontend never gets its own
copy; it calls `GET /api/portfolio`, which reads the MCP `portfolio://`
resources). Never invent candidate facts (employers, dates, skills,
achievements) to fill a gap — ask the user, or leave the field empty per the
existing schema. See [docs/MCP.md](../../../docs/MCP.md) for what each
resource/tool exposes from this file.
