-- Team Graph (L3) — Postgres. Schema from docs/architecture/10-data-model.md.
CREATE TABLE team_node (
  node_id text PRIMARY KEY,            -- acme:team:person:asha@acme.com | :team:payments
  tenant  text NOT NULL,
  kind    text NOT NULL,               -- person | team | service
  name    text
);

CREATE TABLE team_edge (
  tenant      text NOT NULL,
  src_node_id text NOT NULL,
  dst_node_id text NOT NULL,           -- may reference code/behavioral nodes
  edge_kind   text NOT NULL,           -- owns | reviews | was_on_call_for | was_paged_for
  PRIMARY KEY (tenant, src_node_id, dst_node_id, edge_kind)
);
CREATE INDEX ON team_edge (tenant, dst_node_id);
