-- Seed: the chargeCustomer worked example (Decision + Team graphs).
-- Mirrors docs/architecture/10-data-model.md and src/substrate/in-memory.ts.

INSERT INTO decision_node (node_id, tenant, kind, title, url, created_at) VALUES
  ('acme:decision:pr:github/acme/payments#5012', 'acme', 'pr', 'Add retry to chargeCustomer', 'https://github.com/acme/payments/pull/5012', '2026-05-28T12:00:00Z'),
  ('acme:decision:pr:github/acme/payments#4980', 'acme', 'pr', 'Refactor card validation',     'https://github.com/acme/payments/pull/4980', '2026-05-20T09:00:00Z');

-- both PRs "touch" the chargeCustomer code node (cross-graph ref into the Code Graph)
INSERT INTO decision_edge (tenant, src_node_id, dst_node_id, edge_kind) VALUES
  ('acme', 'acme:decision:pr:github/acme/payments#5012', 'acme:code:function:payments/charge.go#chargeCustomer', 'touches'),
  ('acme', 'acme:decision:pr:github/acme/payments#4980', 'acme:code:function:payments/charge.go#chargeCustomer', 'touches');

INSERT INTO team_node (node_id, tenant, kind, name) VALUES
  ('acme:team:person:asha@acme.com', 'acme', 'person', 'asha'),
  ('acme:team:team:payments',        'acme', 'team',   'payments');

-- @asha (payments team) owns the chargeCustomer code node
INSERT INTO team_edge (tenant, src_node_id, dst_node_id, edge_kind) VALUES
  ('acme', 'acme:team:person:asha@acme.com', 'acme:code:function:payments/charge.go#chargeCustomer', 'owns');
