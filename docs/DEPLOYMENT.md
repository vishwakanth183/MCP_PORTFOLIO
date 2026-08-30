# Deploying PortfolioMCP for free

This covers deploying the two pieces of this project — the Next.js frontend
and the FastAPI chat backend — on free hosting tiers. Read
[docs/MCP.md](MCP.md) first if you haven't, so the "why" behind the backend's
constraints below makes sense.

> Free-tier terms change. Verify current limits on whichever host you pick
> before committing — this guide gives you the shape of the setup, not a
> guarantee of what's free forever.

## Why this isn't a single "serverless function" deploy

`api/chat_server.py` keeps **one persistent MCP client session alive** for
the life of the process (opened once in FastAPI's `lifespan`, not per
request), and that MCP session is a **subprocess** (`server/portfolio_server.py`)
talking to the FastAPI process over stdio. That combination — long-lived
in-memory state plus subprocess spawning — doesn't fit classic
request-scoped serverless functions (e.g. Vercel Functions, AWS Lambda
behind API Gateway). It needs a host that runs your app as an actual
**process that stays up**, even if it's allowed to sleep between requests.

That's why the two halves of this app go to different kinds of hosts:

| Piece | Needs | Good free fit |
|---|---|---|
| Next.js frontend | SSR/server components, Node runtime | **Vercel** (the framework's own platform, generous free hobby tier) |
| FastAPI backend (MCP client + server) | A persistent process, subprocess spawning | **Render** free Web Service (or Fly.io / Google Cloud Run — see alternatives below) |

## Part 1 — Backend on Render

1. Push this repo to GitHub (you've been keeping it local — this is the
   point where you'll want a remote if you don't have one connected yet).
2. In the Render dashboard: **New → Web Service**, connect the repo.
3. Configure:
   - **Root Directory**: leave blank (repo root) — the backend needs the
     whole tree (`data/`, `server/`, `api/`) present, not just `api/`.
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn api.chat_server:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: Free
4. Add environment variables (Render's "Environment" tab — don't rely on a
   committed `.env`, since it's gitignored on purpose and won't be there):
   - `GEMINI_API_KEY` — your real key
   - `GEMINI_MODEL` — e.g. `gemini-flash-lite-latest` (see
     [MCP.md](MCP.md#gemini-specific-gotchas-baked-into-gemini_adapterpy) for
     why the "obvious" flash model may not be the best free-tier choice)
   - `CORS_ORIGINS` — you'll fill this in after Part 2, once you know your
     Vercel URL
5. Deploy. Once it's up, check `https://<your-service>.onrender.com/api/health`
   — it should list the four MCP tool names.

**Free-tier caveat**: Render's free web services spin down after ~15 minutes
of inactivity and take 30-60s to cold-start on the next request. For a
portfolio site with occasional visitors, that's a fine tradeoff — the first
question after a lull will just take longer to answer. If that's not
acceptable, a paid "always-on" instance removes it.

### Alternatives to Render

- **Fly.io** — deploys arbitrary containers, has a free usage allowance, but
  requires a credit card on file even for the free tier.
- **Google Cloud Run** — generous always-free quota (2M requests/month), runs
  Docker containers, scales to zero, and subprocess spawning works fine
  inside the container. Requires writing a `Dockerfile` (not included here)
  and a GCP billing account (still free under the quota, but card required).
  A reasonable next step if Render's cold starts become annoying.
- **Railway** — easy to use, but no longer offers an indefinite free tier as
  of recent pricing changes (trial credits only) — check current terms.

## Part 2 — Frontend on Vercel

1. In Vercel: **Add New → Project**, import the same repo.
2. **Root Directory**: set to `frontend` — this is a monorepo, and Vercel
   needs to know the Next.js app isn't at the repo root.
3. Framework preset should auto-detect as Next.js. Leave build/output
   settings default.
4. Add environment variable:
   - `NEXT_PUBLIC_API_URL` — your Render backend URL from Part 1, e.g.
     `https://portfoliomcp-api.onrender.com`
5. Deploy.

## Part 3 — Wire them together

Go back to Render and set `CORS_ORIGINS` to your Vercel deployment's URL
(e.g. `https://your-project.vercel.app`) — without this, the browser will
block the frontend's `POST /api/chat` calls with a CORS error even though
the backend itself is reachable. Redeploy the backend for the env var change
to take effect.

If you have a custom domain on Vercel, use that instead, and update
`CORS_ORIGINS` again if you add one later — it's an exact-origin allowlist,
not a wildcard.

## Verifying the deployed app

1. Open your Vercel URL — the portfolio page should render (profile, skills,
   experience, projects), which confirms the frontend can reach
   `GET /api/portfolio` on the backend.
2. Ask a question in the chat widget — confirms `POST /api/chat`, CORS, and
   the Gemini key all work end to end.
3. Check `https://<backend>/api/health` directly any time you want to
   confirm the backend and its MCP session are up without going through the
   UI.

## Security notes

- Never commit `.env` — it's already gitignored; double-check before any
  `git add -A` that it hasn't been accidentally staged (this project's
  history includes one near-miss where a real key ended up in
  `.env.example` instead of `.env` — always verify with `git diff` before
  committing after touching credential files).
- Set secrets via each platform's environment variable UI, not in code or
  in a committed file.
- `CORS_ORIGINS` should be your actual deployed origin(s), not `*`, once
  this is public — the `.env.example` default of `*` is fine for local dev
  only.

## What "deployed" does and doesn't mean here

The MCP server (`server/portfolio_server.py`) is **not** independently
reachable over the network in this deployment — it's a subprocess of the
backend, talking over stdio, exactly like it does locally. That's a
deliberate simplification: the plan this project follows explicitly warns
that "a publicly reachable MCP server is not automatically the same thing as
a publicly usable chat application," and for a portfolio demo, having the
MCP server as an internal implementation detail of one deployed service is
simpler and just as demonstrable — the client discovery/tool-call/resource-
read/prompt-fetch behavior all still genuinely happens, just inside one
process instead of two networked ones. If you later want the MCP server
independently reachable (e.g. so a *different* client, like Claude Desktop,
could connect to it), it would need to run over HTTP/SSE transport instead
of stdio and be deployed as its own service — a bigger change than this
weekend's scope, and not required to satisfy the "MCP client can discover
and invoke those capabilities" requirement, which the current setup already
does.
