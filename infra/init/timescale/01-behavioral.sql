-- Behavioral Graph (L3) — TimescaleDB. Schema from docs/architecture/10-data-model.md.
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- service/endpoint topology (mirrors graph edges, keyed by cross-graph nodeId)
CREATE TABLE behavior_edge (
  tenant        text NOT NULL,
  src_node_id   text NOT NULL,         -- e.g. acme:behavior:service:checkout
  dst_node_id   text NOT NULL,         -- e.g. acme:behavior:endpoint:POST /v1/charges
  edge_kind     text NOT NULL,         -- calls_runtime | reads | writes | depends_on
  PRIMARY KEY (tenant, src_node_id, dst_node_id, edge_kind)
);

-- time-series metrics, linked to the implementing code node AND the deploy SHA
CREATE TABLE behavior_metric (
  tenant        text NOT NULL,
  node_id       text NOT NULL,         -- behavioral node
  code_node_id  text,                  -- the Code Graph fn that implements it
  deploy_sha    text NOT NULL,         -- attaches behavior to an exact code version
  ts            timestamptz NOT NULL,
  latency_p50   double precision,
  latency_p99   double precision,
  error_rate    double precision,
  throughput    double precision
);
SELECT create_hypertable('behavior_metric', 'ts');
CREATE INDEX ON behavior_metric (tenant, node_id, ts DESC);

-- seed: the chargeCustomer worked example
INSERT INTO behavior_edge VALUES
  ('acme', 'acme:behavior:service:checkout', 'acme:behavior:endpoint:POST /v1/charges', 'calls_runtime');

INSERT INTO behavior_metric (tenant, node_id, code_node_id, deploy_sha, ts, latency_p50, latency_p99, error_rate, throughput) VALUES
  ('acme', 'acme:behavior:endpoint:POST /v1/charges', 'acme:code:function:payments/charge.go#chargeCustomer', 'deadbeef', now(), 35, 240, 0.003, 1200);
