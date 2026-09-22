# AI Mindmap Brainstorming Tool

> **Demo project for the SMUBIA AI Lodge deployments workshop.**
> The goal here is to *teach deployment*, not development. You mostly **read and
> deploy** this code rather than write it — so it's kept small, readable, and with as
> few moving parts as possible. Each participant deploys their **own fully
> self-contained instance**: own backend, frontend, Telegram bot, database, and LLM key.

## What it does

A **related-ideas explorer**. Type an idea or topic → the AI gives it a short title and
auto-sketches the first ring of related ideas → click a node's **dot** to branch into
more adjacent ideas (AI-suggested directions, a few thinking **lenses** like
Broader / Analogy, or your own via **Narrow down**) → click a node to open a **detail
drawer** showing how it connects, its branches, and its lineage. The map grows
left-to-right as a tree, capped at 50 nodes. Each idea is its own isolated graph.

## Two deployments

**Two frontends, one backend.** The backend is the single source of truth; the two
clients (the web UI and Telegram) both reach it. There are **two things to deploy**:

| Folder | What it is | Stack | Deploys to |
|--------|------------|-------|------------|
| [`backend/`](./backend) | The API + AI logic + database access **and** the Telegram bot webhook — all in one FastAPI app. | FastAPI · pyTelegramBotAPI (**webhook mode**) · `openai` SDK (any OpenAI-compatible LLM) · Neon Postgres | Vercel (Python runtime) |
| [`web-ui/`](./web-ui) | Browse ideas, create ideas, view & expand the mindmap. | React + Vite · React Flow · dagre | Vercel (static) |

The **Telegram bot lives inside the backend** (`backend/telegram_bot.py`): the same
deployment serves the web API and the bot's webhook, so the `/ideate` handler creates
an idea by calling the database directly — no second service, no HTTP hop. It's still
"two frontends, one backend"; the bot is just one of the frontends.

## Why a database is compulsory

Serverless functions are **stateless** — they forget everything between requests and
across redeploys. The mindmap must live in an external database (Neon) or it won't
survive the next call. That's the workshop's cleanest illustration of *why serverless
needs a database*. Same idea with the bot: **webhook** mode (event-driven function) vs
**polling** (always-on server) is the concrete server-vs-serverless lesson.

## Run it locally

Two terminals — backend and web-ui. The full create-idea → graph → expand loop works
locally without the bot (the bot needs a public URL for its webhook, so it's easiest to
test after deploying).

**Backend** (Terminal A):
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # fill in LLM_API_KEY, LLM_MODEL, DATABASE_URL
uvicorn main:app --reload   # http://localhost:8000  (API docs at /docs)
```

**Web-ui** (Terminal B):
```bash
cd web-ui
npm install
cp .env.example .env        # default VITE_BACKEND_URL=http://localhost:8000 is fine
npm run dev                 # http://localhost:5173
```

Each folder ships a `.env.example` listing exactly what it needs.

## Deploy to Vercel

Full step-by-step — deploy order, what to select per project, and which env vars go
where — is in **[`VERCEL_SETUP.md`](./VERCEL_SETUP.md)**. In short: it's **one repo,
two Vercel projects** (Root Directory `backend/` and `web-ui/`). Deploy Neon → backend
→ web-ui, set the backend's `FRONTEND_URL` and redeploy it, then click **"Set Telegram
webhook"** in the web UI.

## Ground rules (kept simple on purpose)

No auth, no multi-user, no embeddings, no cross-idea links. One person, their ideas,
their graphs. Guardrails (50-node cap per idea, label truncation) are enforced in code.
The LLM API key lives **server-side only** — never in the frontend.
