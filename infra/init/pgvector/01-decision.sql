-- Decision Graph (L3) — Postgres + pgvector. Schema from docs/architecture/10-data-model.md.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE decision_node (
  node_id     text PRIMARY KEY,        -- acme:decision:pr:github/acme/payments#4471
  tenant      text NOT NULL,
  kind        text NOT NULL,           -- pr | issue | rfc | postmortem | slack_thread | design_doc
  title       text,
  body        text,
  url         text,
  created_at  timestamptz,
  embedding   vector(1536)             -- pgvector: semantic recall
);

CREATE TABLE decision_edge (
  tenant      text NOT NULL,
  src_node_id text NOT NULL,
  dst_node_id text NOT NULL,           -- may point INTO the code graph (cross-graph ref)
  edge_kind   text NOT NULL,           -- discusses | decided | reverted | caused_incident | touches
  PRIMARY KEY (tenant, src_node_id, dst_node_id, edge_kind)
);

CREATE INDEX ON decision_node USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON decision_edge (tenant, dst_node_id);   -- "what decisions touched this fn?"
