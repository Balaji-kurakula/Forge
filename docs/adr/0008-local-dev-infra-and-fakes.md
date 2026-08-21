# 0008 — Local dev via docker-compose + in-memory fakes

- **Status:** Accepted
- **Date:** 2026-06

## Context

Phase 0 should let a developer run something real without standing up the full polyglot substrate,
while still making the eventual real stores trivial to bring up.

## Decision

Two complementary paths:

1. **In-memory fakes** — [`InMemorySubstrateClient`](../../src/substrate/in-memory.ts) (seeded with
   the `chargeCustomer` example) + fake activities drive the CodeReview workflow end-to-end with
   zero external dependencies (`pnpm test`, `pnpm demo`). This is the default dev loop.
2. **docker-compose** — `pnpm db:up` starts Neo4j, TimescaleDB, and Postgres+pgvector. The two
   Postgres-based stores auto-apply schema + seed from `infra/init/*`; Neo4j is seeded with one
   `cypher-shell` command. Connection strings live in `.env.example`.

The real DB-backed `SubstrateClient` is deliberately deferred (Phase 1, see [ROADMAP](../ROADMAP.md)).

## Consequences

- Tests/demo are fast and hermetic — no Docker required for the default loop.
- Schemas in `infra/init/` are the executable form of [10 Data Model](../architecture/10-data-model.md);
  they and `src/substrate/in-memory.ts` must stay in sync with the worked example.
- CI runs the fakes path only; the compose stack is for local/integration use.
