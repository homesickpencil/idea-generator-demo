"""Small shared helpers used by the API routes, the bot, and response shaping."""

MAX_LABEL_WORDS = 15       # idea-node labels are truncated to this many words
MAX_TITLE_WORDS = 8        # the AI-generated root title
MAX_RELATION_WORDS = 25    # "how this relates to its parent" line
MAX_DIRECTIONS = 3         # AI-suggested directions shown per node
MAX_DIRECTION_WORDS = 6    # each direction label is short


def truncate_words(text, n: int) -> str:
    return " ".join(str(text or "").split()[:n])


def truncate_label(label: str) -> str:
    return truncate_words(label, MAX_LABEL_WORDS)


def truncate_title(title: str) -> str:
    return truncate_words(title, MAX_TITLE_WORDS)


def clean_directions(items) -> list[str]:
    """Coerce the LLM's directions into a short list of short, non-empty strings."""
    if not isinstance(items, list):
        return []
    out = []
    for d in items[:MAX_DIRECTIONS]:
        s = truncate_words(d, MAX_DIRECTION_WORDS).strip()
        if s:
            out.append(s)
    return out
