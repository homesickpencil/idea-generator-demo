"""Provider-agnostic LLM calls for the related-ideas explorer.

Two calls:
  - create_idea(text): turn a seed idea into a title + first ring of related ideas.
  - expand(node, context, direction): branch a node into more adjacent ideas.

This is an *idea explorer*, not a planner: expansions are related/adjacent ideas
(neighbouring concepts, spin-offs, variations), never implementation steps.

Both return structured JSON. Uses the OpenAI SDK pointed at a configurable base URL,
so any OpenAI-compatible provider works (OpenRouter by default). No frameworks.

The API key lives here in the backend ONLY. It must never reach the frontend.
"""

import json
import os

from openai import OpenAI

SYSTEM = (
    "You are an idea-exploration partner. Someone gives you a seed idea — usually a "
    "thing they might make or do (a project, product, venture, or piece of content). "
    "You branch it into RELATED and ADJACENT ideas: neighbouring concepts, spin-offs, "
    "variations, and nearby directions worth exploring. You are NOT planning or "
    "implementing anything — no tech stacks, no build steps, no task lists. Keep every "
    "label a short idea (a few words). Reply with JSON only, no prose."
)

_CHILD_SHAPE = (
    '{"label": a related idea (max 10 words), '
    '"relation": a 2-4 word note on how it connects (e.g. "a spin-off of", '
    '"a broader take on", "adjacent to"), '
    '"category": a short theme name, '
    '"directions": [3 adjacent ideas or themes to explore from it, each max 6 words]}'
)


def _client() -> OpenAI:
    # Built at call time, not import time, so a missing LLM_API_KEY fails only the
    # request that needs it (a clean 502) instead of crashing the app on import.
    return OpenAI(
        base_url=os.environ.get("LLM_BASE_URL", "https://openrouter.ai/api/v1"),
        api_key=os.environ["LLM_API_KEY"],
    )


def _chat(user: dict) -> dict:
    resp = _client().chat.completions.create(
        model=os.environ["LLM_MODEL"],
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": json.dumps(user)},
        ],
        response_format={"type": "json_object"},
        temperature=0.8,
    )
    return json.loads(resp.choices[0].message.content)


def create_idea(text: str) -> dict:
    """Return {title, root_directions, children:[{label, relation, category, directions}]}."""
    return _chat(
        {
            "seed_idea": text,
            "instructions": (
                "Return JSON: {"
                '"title": a short name for the idea (max 6 words), '
                '"root_directions": [3 adjacent themes to explore, each max 6 words], '
                f'"children": [three related but distinct ideas branching from the seed, each {_CHILD_SHAPE}]'
                "}. The three children should be genuinely different neighbouring ideas, "
                "not steps or components of the seed."
            ),
        }
    )


def expand(expanded_node: dict, map_labels: list[str], direction: str | None = None) -> dict:
    """Return {children:[{label, relation, category, directions}]} for one node."""
    user = {
        "expand_node": {"label": expanded_node["label"]},
        "map_context": map_labels,
        "instructions": (
            "Return JSON: {"
            f'"children": [three related ideas branching from the expanded node, each {_CHILD_SHAPE}]'
            "}. Each child is a distinct adjacent idea, not a duplicate of any label in "
            "map_context, and not an implementation step."
        ),
    }
    if direction:
        user["expand_toward"] = direction
        user["instructions"] += " All three children should follow 'expand_toward'."
    return _chat(user)
