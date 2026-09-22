# Vercel Setup Guide

How to deploy this project — the demo for the **SMUBIA AI Lodge deployments
workshop** — to Vercel. Follow it top to bottom; the order matters because the two
services reference each other's URLs.

## The model: one repo, two Vercel projects

This is **one Git repo with two apps**. In Vercel a **Project = one app = one URL**,
and each Project has a **Root Directory** setting pointing at its subfolder. So you
import this same repo **twice**, each with a different Root Directory:

```
GitHub repo: idea-generator-demo
        ├── Project "idea-backend"  → Root Directory: backend/   (FastAPI web API + Telegram webhook)
        └── Project "idea-web"      → Root Directory: web-ui/    (Vite static site)
```

The Telegram bot is **not** a separate deployment — it lives inside the backend
(`backend/telegram_bot.py`), so the backend project serves both the web API and the
bot's webhook. There is **no root-level config** that turns one import into two apps —
the Root Directory setting is the mechanism, chosen per project during import.

## Does Vercel auto-inject env vars?

**Only its own system variables** (`VERCEL_ENV`, `VERCEL_URL`,
`VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_GIT_*`, …). **Your app's variables you set
yourself** in each project's **Settings → Environment Variables**, and a change only
takes effect on the **next deploy** (redeploy after editing). The one shortcut for
this stack: the **Neon Vercel integration** can auto-add `DATABASE_URL` to the backend
project — otherwise you paste it in manually.

## Prerequisites (once)

- A **Vercel** account and this repo pushed to **GitHub**.
- A **Neon** database (neon.tech). In its SQL editor, run `backend/schema.sql`.
  Copy the **pooled** connection string → that's `DATABASE_URL`.
- An **LLM key + model** from an OpenAI-compatible provider (OpenRouter by default:
  a key from openrouter.ai and a model slug from openrouter.ai/models).
- A **Telegram bot**: message [@BotFather](https://t.me/BotFather) → `/newbot` → copy
  the token. (Optional — skip it and leave `TELEGRAM_BOT_TOKEN` blank to run without
  the bot.)

## What to select for each project (verify even if auto-detected)

| Setting | backend | web-ui |
|---------|---------|--------|
| **Root Directory** | `backend` | `web-ui` |
| **Framework Preset** | Other | Vite (auto) |
| **Build Command** | *(none/default)* | `npm run build` (auto) |
| **Output Directory** | *(default)* | `dist` (auto) |
| **Install Command** | *(default)* | `npm install` (auto) |

The backend is zero-config: Vercel's Python runtime finds the `FastAPI` app named
`app` in `main.py`. `backend/vercel.json` sets the function timeout (60s, for the LLM
call). `web-ui/vercel.json` adds the SPA rewrite so deep links like `/idea/<id>` work.

## Environment variables — who needs what

Set these in each project's **Settings → Environment Variables**.

### backend
| Variable | Value |
|----------|-------|
| `LLM_API_KEY` | your LLM key (**secret; server-side only**) |
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` (or another OpenAI-compatible endpoint) |
| `LLM_MODEL` | an OpenRouter model slug |
| `DATABASE_URL` | Neon **pooled** connection string |
| `FRONTEND_URL` | the **web-ui** URL — used for CORS **and** the bot's `/ideate` link-back; set after web-ui is deployed |
| `TELEGRAM_BOT_TOKEN` | from @BotFather (blank to disable the bot) |

### web-ui
| Variable | Value |
|----------|-------|
| `VITE_BACKEND_URL` | the **backend** URL |

> **Why `FRONTEND_URL` is filled in later:** it's the web-ui's URL, which doesn't exist
> until the web-ui is deployed. So you deploy the backend with it blank, deploy the
> web-ui, then set `FRONTEND_URL` and redeploy the backend.

## Deploy order

1. **Neon** — create the DB, run `backend/schema.sql`, copy the pooled `DATABASE_URL`.

2. **backend** — import repo → Root Directory `backend` → add its env vars (set
   `TELEGRAM_BOT_TOKEN`; leave `FRONTEND_URL` blank for now) → **Deploy**. Note the
   URL, e.g. `https://idea-backend.vercel.app`.

3. **web-ui** — import repo → Root Directory `web-ui` → set `VITE_BACKEND_URL` =
   backend URL → **Deploy**. Note the URL, e.g. `https://idea-web.vercel.app`.

4. **Back to backend** — set `FRONTEND_URL` = web-ui URL → **Redeploy** the backend
   (env changes need a redeploy).

5. **Register the Telegram webhook** — open the web UI and click **"Set Telegram
   webhook"**. (The backend points Telegram at its own `/api/telegram/webhook`. No URL
   to copy. You can also just open `https://<backend-url>/api/telegram/set-webhook`.)

6. **Test** — in Telegram, send your bot `/ideate a subscription box for houseplants`
   and open the link it replies with. In the web UI, create an idea and expand a node.

## Redeploy reminders

- Editing an environment variable **does not** redeploy automatically — trigger a
  redeploy (Deployments → ⋯ → Redeploy, or push a commit).
- A project only rebuilds when files under its **Root Directory** change, so a web-ui
  commit won't redeploy the backend.

## Troubleshooting

- **CORS errors in the browser console** → the backend's `FRONTEND_URL` doesn't match
  the web-ui origin exactly (scheme + host, no trailing slash). Fix and redeploy.
- **"Set Telegram webhook" returns 503** → `TELEGRAM_BOT_TOKEN` isn't set on the
  backend. Set it and redeploy.
- **Bot replies with a broken link** → the backend's `FRONTEND_URL` is unset or wrong.
- **Bot doesn't reply at all** → the webhook isn't registered (click the button again).
- **Graph doesn't load / 500s** → check `DATABASE_URL` (use the **pooled** string) and
  that `schema.sql` was run.
