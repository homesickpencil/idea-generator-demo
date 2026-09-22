-- Run this ONCE against your Neon database (SQL editor or psql).
-- It creates the two tables the backend needs. Edges are implicit via nodes.parent_id.

-- Ideas: one row per brainstorm. Each idea is an isolated graph.
CREATE TABLE IF NOT EXISTS ideas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,                -- the full original idea the student typed
    short_title TEXT,                          -- AI-generated short title (shown on the root node)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nodes: the mindmap nodes. Edges are implicit via parent_id (self-FK). It's a tree:
-- each node's parent is the node it was expanded from (null for the root).
CREATE TABLE IF NOT EXISTS nodes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id    UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    label      TEXT NOT NULL,
    category   TEXT,                                          -- LLM-chosen grouping
    parent_id  UUID REFERENCES nodes(id) ON DELETE CASCADE,   -- null for the root node
    relation   TEXT,                                          -- one line: how it relates to its parent
    directions TEXT[] NOT NULL DEFAULT '{}',                  -- AI-suggested expansion directions for this node
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nodes_idea_id_idx ON nodes(idea_id);

-- Safe to re-run on an existing database (adds the newer columns if missing):
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS short_title TEXT;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS relation   TEXT;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS directions TEXT[] NOT NULL DEFAULT '{}';
