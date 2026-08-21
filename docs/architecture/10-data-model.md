# 10 — Data Model

Concrete schemas behind the substrate ([03](./03-reasoning-substrate.md)). The substrate is
polyglot: Neo4j for the Code Graph, TimescaleDB for the Behavioral Graph, Postgres + pgvector
for the Decision Graph, Postgres for the Team Graph. They are stitched together by a single
**stable cross-graph node ID**.

## The cross-graph node ID

Every node in every graph has a globally stable ID so the four graphs can reference each other:

```
 nodeId = "<tenant>:<graph>:<kind>:<stableKey>"
   e.g.  "acme:code:function:payments/charge.go#chargeCustomer"
         "acme:behavior:endpoint:POST /v1/charges"
         "acme:decision:pr:github/acme/payments#4471"
         "acme:team:person:asha@acme.com"
```

- `<stableKey>` is *content-stable*, not line-number-based, so it survives reformatting and moves
  (path + symbol name + signature hash). Renames are tracked as `aliasOf` edges.
- Behavioral/Decision/Team nodes reference Code nodes by this ID, which is how a query fans across
  stores without a distributed join.

---

## Code Graph — Neo4j (Cypher)

```cypher
// nodes
CREATE (f:Function {
  nodeId: 'acme:code:function:payments/charge.go#chargeCustomer',
  tenant: 'acme', name: 'chargeCustomer', path: 'payments/charge.go',
  language: 'go', signatureHash: 'a91f…', ownerTeam: 'payments',
  lastModified: datetime(), embeddingId: 'vec:fn:…', complexity: 7
});
CREATE (svc:Service { nodeId: 'acme:code:service:payments', tenant:'acme', name:'payments' });

// edges
MATCH (a:Function {nodeId:$callerId}), (b:Function {nodeId:$calleeId})
CREATE (a)-[:CALLS {count: 12}]->(b);
// other edge types: IMPORTS, INHERITS, IMPLEMENTS, TESTS, DEPLOYS_TO, ALIAS_OF
```

## Behavioral Graph — TimescaleDB

```sql
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
```

## Decision Graph — Postgres + pgvector

```sql
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
```

## Team Graph — Postgres

```sql
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
```

---

## The `chargeCustomer` worked example

The unified query from [03](./03-reasoning-substrate.md), resolved across stores:

```cypher
-- Code Graph (Neo4j): call graph + tests
MATCH (f:Function {nodeId:'acme:code:function:payments/charge.go#chargeCustomer'})
OPTIONAL MATCH (f)-[:CALLS]->(callee) OPTIONAL MATCH (caller)-[:CALLS]->(f)
RETURN f, collect(callee) AS callees, collect(caller) AS callers;
```
```sql
-- Behavioral Graph (Timescale): 7-day error rate for the endpoint it implements
SELECT avg(error_rate) AS err_7d, max(latency_p99) AS p99_7d
FROM behavior_metric
WHERE tenant='acme'
  AND code_node_id='acme:code:function:payments/charge.go#chargeCustomer'
  AND ts > now() - interval '7 days';

-- Decision Graph (Postgres): last 5 PRs that touched it
SELECT n.title, n.url, n.created_at
FROM decision_edge e JOIN decision_node n ON n.node_id = e.src_node_id
WHERE e.tenant='acme' AND e.edge_kind='touches'
  AND e.dst_node_id='acme:code:function:payments/charge.go#chargeCustomer'
ORDER BY n.created_at DESC LIMIT 5;

-- Team Graph (Postgres): owner
SELECT t.name FROM team_edge e JOIN team_node t ON t.node_id = e.src_node_id
WHERE e.tenant='acme' AND e.edge_kind='owns'
  AND e.dst_node_id LIKE 'acme:code:%charge.go%';
```

The Retrieval Orchestrator ([06](./06-agent-orchestration.md)) issues these in parallel and
assembles one `RetrievedContext` (see [`../../src/substrate/graphs.ts`](../../src/substrate/graphs.ts)).

## Tenancy, partitioning & retention

- **Every table/graph is tenant-scoped** (`tenant` column / per-tenant Neo4j database) and
  encrypted with the tenant's KMS key ([09](./09-tenancy-security.md)).
- **Partitioning** — Behavioral hypertables partition by time; large tenants shard Code Graph by
  path subtree.
- **Retention** — full behavioral time-series retained for a bounded window, then rolled up to
  aggregates; raw traces expire sooner; graph nodes persist until the entity is deleted.
- **Indexes** — graph adjacency (Neo4j native), `(tenant, node_id, ts)` on metrics, ivfflat on
  embeddings, reverse-edge indexes for "what points at this node" queries.

## Open questions / risks

- **Stable-key collisions/renames** — content-stable keys must survive refactors; alias tracking
  is fiddly and errors fragment a node's history.
- **Cross-store referential integrity** — no FK spans Neo4j → Timescale → Postgres; dangling
  cross-graph refs must be tolerated and reconciled ([02](./02-indexing-cdc.md)).
- **Embedding dimensionality lock-in** — changing the embedding model means re-embedding the whole
  Decision Graph corpus.
- **pgvector recall at scale** — ivfflat tradeoffs (recall vs speed) may push toward a dedicated
  vector store for very large tenants.
