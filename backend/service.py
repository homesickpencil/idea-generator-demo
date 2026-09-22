"""Business logic shared by the HTTP routes AND the Telegram bot.

Keeping the create/expand flow here (not in main.py) means both entry points go
through the same code — the bot can't drift out of sync with the API again.
"""

import db
import llm
from util import (
    MAX_RELATION_WORDS,
    clean_directions,
    truncate_label,
    truncate_title,
    truncate_words,
)

MAX_NODES = 50  # hard cap per idea (enforced in code, not just the prompt)


def prepare_children(items, limit: int) -> list[dict]:
    """Clean the LLM's children into storable rows, capped to `limit` and guarded."""
    out = []
    if not isinstance(items, list):
        return out
    for ch in items[: max(0, limit)]:
        if not isinstance(ch, dict):
            continue
        label = truncate_label(str(ch.get("label", "")).strip())
        if not label:
            continue
        out.append(
            {
                "label": label,
                "relation": truncate_words(ch.get("relation", ""), MAX_RELATION_WORDS) or None,
                "category": ch.get("category") or None,
                "directions": clean_directions(ch.get("directions")),
            }
        )
    return out


def create_idea(text: str):
    """One LLM call → title + auto-expanded first level, stored.

    Returns (idea_id, root_id, title). Used by POST /api/ideas and the bot's /ideate.
    """
    gen = llm.create_idea(text)
    title = truncate_title(gen.get("title") or text)
    root_directions = clean_directions(gen.get("root_directions"))
    children = prepare_children(gen.get("children"), MAX_NODES - 1)  # room for the root
    idea_id, root_id = db.create_idea(text, title, root_directions, children)
    return idea_id, root_id, title
