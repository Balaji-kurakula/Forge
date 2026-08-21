# 0004 — Polyglot substrate + stable cross-graph NodeId

- **Status:** Accepted
- **Date:** 2026-06
- **Ratifies:** [03 Reasoning Substrate](../architecture/03-reasoning-substrate.md), [10 Data Model](../architecture/10-data-model.md)

## Context

No single database serves graph traversal, time-series behavior, and semantic recall well. The four
graphs must still query together in sub-second.

## Decision

Use a **polyglot** store — Neo4j (Code), TimescaleDB (Behavioral), Postgres+pgvector (Decision),
Postgres (Team) — stitched by one **stable, content-addressed cross-graph node ID**:

```
nodeId = "<tenant>:<graph>:<kind>:<stableKey>"
```

`<stableKey>` is path + symbol + signature hash (not line numbers), so it survives reformatting and
moves; renames become `alias_of` edges. A query planner fans a logical query across stores and
assembles one `RetrievedContext`.

## Consequences

- Cross-graph references work without a distributed join.
- No transaction spans the stores → need an outbox/reconciliation strategy and tolerance for
  temporarily dangling cross-graph refs (tracked in [RISKS](../RISKS.md)).
- Changing the embedding model forces re-embedding the Decision corpus.
- The typed logical surface lives in [`src/substrate/graphs.ts`](../../src/substrate/graphs.ts);
  the seeded [`InMemorySubstrateClient`](../../src/substrate/in-memory.ts) implements it for local runs.
