"""Database access for the mindmap backend.

Serverless functions are stateless, so we don't keep a global connection pool.
Each call opens a short-lived connection to Neon, runs its queries, and closes.
All queries use parameterised SQL (never string interpolation) to avoid injection.
"""

import os

import psycopg
from psycopg.rows import dict_row

_NODE_COLS = "id, idea_id, label, category, parent_id, relation, directions"


def _connect():
    # Read DATABASE_URL at call time, not import time: a missing/wrong value then
    # fails one request cleanly (a JSON 500 that still carries CORS headers) instead
    # of crashing the whole app on import and 500-ing every route without headers.
    # dict_row makes each row behave like a dict: row["label"] instead of row[0].
    return psycopg.connect(os.environ["DATABASE_URL"], row_factory=dict_row)


def create_idea(text: str, short_title: str, root_directions: list[str], children: list[dict]):
    """Create an idea, its root node, and the auto-expanded first-level children.

    `children` items: {label, relation, category, directions}. Returns (idea_id, root_id).
    """
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO ideas (title, short_title) VALUES (%s, %s) RETURNING id",
            (text, short_title),
        )
        idea_id = cur.fetchone()["id"]

        cur.execute(
            "INSERT INTO nodes (idea_id, label, directions) VALUES (%s, %s, %s) RETURNING id",
            (idea_id, short_title, root_directions),
        )
        root_id = cur.fetchone()["id"]

        for ch in children:
            cur.execute(
                "INSERT INTO nodes (idea_id, label, category, parent_id, relation, directions) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (idea_id, ch["label"], ch.get("category"), root_id,
                 ch.get("relation"), ch.get("directions") or []),
            )
        conn.commit()
    return idea_id, root_id


def list_ideas():
    """All ideas with a node count, newest first (folder view)."""
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT i.id, i.title, i.short_title, i.created_at, count(n.id) AS node_count "
            "FROM ideas i LEFT JOIN nodes n ON n.idea_id = i.id "
            "GROUP BY i.id ORDER BY i.created_at DESC"
        )
        return cur.fetchall()


def get_idea(idea_id: str):
    """One idea with its nodes attached, or None if it doesn't exist."""
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, title, short_title, created_at FROM ideas WHERE id = %s", (idea_id,)
        )
        idea = cur.fetchone()
        if idea is None:
            return None
        cur.execute(
            f"SELECT {_NODE_COLS} FROM nodes WHERE idea_id = %s ORDER BY created_at", (idea_id,)
        )
        idea["nodes"] = cur.fetchall()
    return idea


def get_node(node_id: str):
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(f"SELECT {_NODE_COLS} FROM nodes WHERE id = %s", (node_id,))
        return cur.fetchone()


def get_nodes(idea_id: str):
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(f"SELECT {_NODE_COLS} FROM nodes WHERE idea_id = %s", (idea_id,))
        return cur.fetchall()


def delete_idea(idea_id: str) -> bool:
    """Delete an idea (its nodes cascade). Returns True if a row was removed."""
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM ideas WHERE id = %s", (idea_id,))
        deleted = cur.rowcount
        conn.commit()
    return deleted > 0


def count_nodes(idea_id: str) -> int:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM nodes WHERE idea_id = %s", (idea_id,))
        return cur.fetchone()["n"]


def insert_children(idea_id: str, parent_id, children: list[dict]):
    """Insert expanded child nodes under `parent_id`. Returns the inserted rows."""
    inserted = []
    with _connect() as conn, conn.cursor() as cur:
        for ch in children:
            cur.execute(
                "INSERT INTO nodes (idea_id, label, category, parent_id, relation, directions) "
                f"VALUES (%s, %s, %s, %s, %s, %s) RETURNING {_NODE_COLS}",
                (idea_id, ch["label"], ch.get("category"), parent_id,
                 ch.get("relation"), ch.get("directions") or []),
            )
            inserted.append(cur.fetchone())
        conn.commit()
    return inserted
