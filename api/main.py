"""FastAPI backend — the single source of truth for the mindmap.

This ONE deployment serves both the web API and the Telegram bot webhook (the bot
handlers live in telegram_bot.py). Vercel's Python runtime auto-detects the FastAPI
instance named `app` below.
"""

import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from telebot.types import Update

import db
import llm
import service
import telegram_bot

app = FastAPI(title="AI Mindmap Backend")

# The web-ui deploys to a different origin, so CORS must allow it. One var —
# FRONTEND_URL — is the web-ui's URL: used both for CORS here and for the bot's
# link-back. CORS allows that origin only (defaults to the local Vite dev server).
# .rstrip("/") is trailing-slash protection: an origin never has a trailing slash,
# so "https://app.vercel.app/" would silently never match — we strip it.
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_methods=["*"],
    allow_headers=["*"],
)

def edges_from_nodes(nodes) -> list[dict]:
    """Derive React Flow edges from each node's parent_id (no edges table)."""
    edges = []
    for n in nodes:
        if n["parent_id"] is not None:
            child, parent = str(n["id"]), str(n["parent_id"])
            edges.append({"id": f"e-{child}", "source": parent, "target": child})
    return edges


def serialize_node(n) -> dict:
    return {
        "id": str(n["id"]),
        "label": n["label"],
        "category": n["category"],
        "parent_id": str(n["parent_id"]) if n["parent_id"] else None,
        "relation": n.get("relation"),
        "directions": n.get("directions") or [],
    }


# ----- Request bodies -----------------------------------------------------------

class CreateIdea(BaseModel):
    text: str


class ExpandRequest(BaseModel):
    idea_id: str
    node_id: str
    direction: str | None = None  # an AI-suggested label, or free-text from "Narrow down"


# ----- Health -------------------------------------------------------------------

@app.get("/")
def health():
    return {"status": "ok"}


# ----- Telegram (bot runs inside this same deployment) --------------------------

@app.post("/api/telegram/webhook")
async def telegram_webhook(request: Request):
    """Receive one Telegram update and hand it to the bot's handlers."""
    if telegram_bot.bot is None:
        raise HTTPException(503, "Telegram bot is not configured (TELEGRAM_BOT_TOKEN unset).")
    payload = await request.json()
    telegram_bot.bot.process_new_updates([Update.de_json(payload)])
    return {"ok": True}


@app.get("/api/telegram/webhook-info")
def telegram_webhook_info(request: Request):
    """Report whether Telegram's webhook already points at THIS deployment.

    Lets the web UI show a connected/disabled state instead of a re-run button.
    """
    if telegram_bot.bot is None:
        return {"configured": False, "connected": False, "url": None}
    expected = f"https://{request.headers['host']}/api/telegram/webhook"
    try:
        info = telegram_bot.bot.get_webhook_info()
        current = info.url or ""
    except Exception as e:
        raise HTTPException(502, f"Could not reach Telegram: {e}")
    return {"configured": True, "connected": current == expected, "url": current or None}


@app.get("/api/telegram/set-webhook")
@app.post("/api/telegram/set-webhook")
def set_telegram_webhook(request: Request):
    """Register the Telegram webhook without anyone touching a URL.

    The web UI's "Set Telegram webhook" button POSTs here; you can also just open
    this URL in a browser. We read our own host from the request and point Telegram
    at this deployment's /api/telegram/webhook.
    """
    if telegram_bot.bot is None:
        raise HTTPException(503, "Telegram bot is not configured (TELEGRAM_BOT_TOKEN unset).")
    webhook_url = f"https://{request.headers['host']}/api/telegram/webhook"
    telegram_bot.bot.remove_webhook()
    ok = telegram_bot.bot.set_webhook(url=webhook_url)
    return {"ok": ok, "webhook_url": webhook_url}


# ----- Ideas API ----------------------------------------------------------------

@app.post("/api/ideas", status_code=201)
def create_idea(body: CreateIdea):
    text = body.text.strip()
    if not text:
        raise HTTPException(422, "Idea text cannot be empty.")
    try:
        idea_id, root_id, title = service.create_idea(text)
    except Exception as e:
        raise HTTPException(502, f"LLM call failed: {e}")
    return {"idea_id": str(idea_id), "root_node_id": str(root_id), "title": title}


@app.get("/api/ideas")
def list_ideas():
    return [
        {
            "id": str(i["id"]),
            "title": i["short_title"] or i["title"],
            "created_at": i["created_at"],
            "node_count": i["node_count"],
        }
        for i in db.list_ideas()
    ]


@app.delete("/api/ideas/{idea_id}", status_code=204)
def delete_idea(idea_id: str):
    if not db.delete_idea(idea_id):
        raise HTTPException(404, "Idea not found.")
    return None


@app.get("/api/ideas/{idea_id}")
def get_idea(idea_id: str):
    idea = db.get_idea(idea_id)
    if idea is None:
        raise HTTPException(404, "Idea not found.")
    return {
        "id": str(idea["id"]),
        "title": idea["short_title"] or idea["title"],  # the display title
        "original_idea": idea["title"],                   # the full text the student typed
        "nodes": [serialize_node(n) for n in idea["nodes"]],
        "edges": edges_from_nodes(idea["nodes"]),
    }


@app.post("/api/expand")
def expand(body: ExpandRequest):
    # 1. Load & validate the node being expanded.
    node = db.get_node(body.node_id)
    if node is None or str(node["idea_id"]) != body.idea_id:
        raise HTTPException(404, "Node not found in this idea.")

    # 2. Guardrail: refuse once the map is full.
    count = db.count_nodes(body.idea_id)
    if count >= service.MAX_NODES:
        raise HTTPException(
            409, "This map is full (50 nodes). Start a new idea to keep brainstorming."
        )

    # 3. Call the LLM with the whole map for context + the chosen direction.
    context_labels = [n["label"] for n in db.get_nodes(body.idea_id)]
    try:
        gen = llm.expand({"label": node["label"]}, context_labels, body.direction)
    except Exception as e:
        raise HTTPException(502, f"LLM call failed: {e}")

    # 4. Guardrails in code: trim to remaining capacity, truncate, then store as
    #    children of the expanded node (it's a tree).
    children = service.prepare_children(gen.get("children"), service.MAX_NODES - count)
    inserted = db.insert_children(body.idea_id, node["id"], children)

    return {
        "new_nodes": [serialize_node(n) for n in inserted],
        "new_edges": edges_from_nodes(inserted),
    }
