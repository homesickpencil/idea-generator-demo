# backend/

FastAPI app — the single source of truth. Serves the **web API** *and* the **Telegram
bot webhook** in one deployment. Talks to Neon Postgres and an OpenAI-compatible LLM.
The `web-ui` and Telegram are both clients of this service.

## Files

| File | What it does |
|------|--------------|
| `main.py` | The FastAPI app (`app`) and all routes. Vercel's Python runtime looks for `app` here. |
| `db.py` | Neon queries. One short-lived connection per request (serverless = stateless). |
| `llm.py` | Provider-agnostic LLM call (OpenAI SDK → any OpenAI-compatible endpoint). |
| `telegram_bot.py` | The Telegram bot handlers (optional — active only if `TELEGRAM_BOT_TOKEN` is set). `/ideate` creates an idea by calling `db` directly. |
| `util.py` | Small shared helpers (label truncation) used by both the API and the bot. |
| `schema.sql` | The two tables. Run once against Neon. |

## API

| Method & path | Purpose |
|---------------|---------|
| `POST /api/ideas` | Body `{ "text": "..." }`. One LLM call: generates a short title and auto-expands the first level. Returns `{ idea_id, root_node_id, title }`. |
| `GET /api/ideas` | List ideas (display title + node count). |
| `GET /api/ideas/{id}` | One idea's full graph: `title`, `original_idea`, `nodes` (each with `relation` + `directions`), derived `edges`. |
| `POST /api/expand` | Grow a node. Body `{ "idea_id", "node_id", "direction"? }` (`direction` = an AI label or free-text from "Narrow down"). New children attach to that node. |
| `POST /api/telegram/webhook` | Where Telegram delivers updates (registered for you by set-webhook). |
| `GET/POST /api/telegram/set-webhook` | Registers this deployment's webhook with Telegram. The web UI button POSTs here; you can also open it in a browser. |

The graph is a **tree**: each node's parent is the node it was expanded from. Every
node carries AI-suggested `directions` and a `relation` line ("how it relates to its
parent"), both precomputed at expansion so the detail drawer needs no extra calls.

Guardrails enforced in code: 50-node hard cap per idea, labels truncated to 15
words, titles/directions/relations length-capped.

## The Telegram bot lives here

There's no separate bot service. `telegram_bot.py` sets up the bot and its `/ideate`
handler, and `main.py` wires the webhook routes. Because it's the same process, the
`/ideate` handler creates an idea by calling `db.create_idea(...)` directly — no HTTP
hop. If `TELEGRAM_BOT_TOKEN` is unset, the bot is disabled and the Telegram routes
return `503`; the rest of the API works normally.

## Environment variables

See `.env.example`. Required: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`,
`DATABASE_URL` (Neon **pooled** string), and `FRONTEND_URL` (the web-ui URL — used
both for CORS and the bot's `/ideate` link-back). For the bot, also set
`TELEGRAM_BOT_TOKEN` (leave blank to disable it).

## Local development

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # then fill it in
uvicorn main:app --reload # http://localhost:8000  (docs at /docs)
```

## Deploy to Vercel

One of **two** Vercel projects built from the same repo (see the root README and
`VERCEL_SETUP.md`). To deploy this service:

1. First set up Neon and run `schema.sql` against it.
2. Vercel dashboard → **Add New… → Project** → import this repo.
3. Set **Root Directory** to `backend`. Framework preset: **Other**.
4. Add the environment variables from `.env.example` (leave `FRONTEND_URL` blank until
   the web-ui exists).
5. **Deploy.** Note the URL — the web-ui points at it.
6. After the web-ui is deployed, set `FRONTEND_URL` to the web-ui URL and redeploy.

`vercel.json` sets `maxDuration: 60` so the LLM call on `/api/expand` doesn't time out.
