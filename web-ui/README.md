# web-ui/

React + Vite frontend. A client of `backend`. Two pages:

- **`/`** — ideas list (folder view) with a "New idea" input. Submitting one shows a
  "Generating…" overlay while the backend titles the idea and sketches the first level.
- **`/idea/:id`** — the mindmap, laid out **left-to-right** (dagre). The **root** node
  is styled distinctly with the AI title. Click a node's **dot** to open a popover of
  AI-suggested directions plus a **"Narrow down"** free-text box (it stays open until
  you pick one or click away); the picked node shows a spinner while it expands. Click a
  node's **body** to open the right **detail drawer** (relation to parent, branches,
  lineage — all from loaded data). Skeleton placeholders show while things load.

There's also a **"Set Telegram webhook"** button on the ideas list — one click POSTs
to the backend, which registers its own Telegram webhook (the bot runs inside the
backend), so nobody has to visit a URL by hand.

Graph rendering: **React Flow** + **dagre** for the layout. Do not hand-roll SVG.

## Environment variables

See `.env.example`. Only `VITE_BACKEND_URL` — the deployed backend URL.

## Local development

```bash
cd web-ui
npm install
cp .env.example .env      # point VITE_BACKEND_URL at your backend (default localhost:8000)
npm run dev               # http://localhost:5173
```

Run the backend too (see `backend/README.md`) so the API calls resolve.

## Deploy to Vercel

One of **two** Vercel projects from this repo (see the root README and `VERCEL_SETUP.md`):

1. Vercel dashboard → **Add New… → Project** → import this repo.
2. Set **Root Directory** to `web-ui`. Framework preset: **Vite** (auto-detected).
3. Add `VITE_BACKEND_URL` = your deployed backend URL.
4. **Deploy.** Note the URL.
5. Go back to the **backend** project, set `FRONTEND_URL` to this web-ui URL,
   and redeploy the backend (so CORS allows the browser calls and the bot links back).

`vercel.json` rewrites all routes to `index.html` so deep links like `/idea/<id>`
work on refresh (single-page app routing).
