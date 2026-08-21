# Contributing to Forge

This repo is in **Phase 0** (see [docs/ROADMAP.md](docs/ROADMAP.md)): an architecture design plus a
typed, tested skeleton of the orchestration. Most of `src/` is intentionally stubbed (functions
throw `not implemented`); a few safety-critical pieces are real.

## Prerequisites

- **Node ≥ 20** (the repo is developed on 24; CI runs 20).
- **pnpm** via Corepack: `corepack enable`.
- **Docker** (optional) — only for the local substrate stores (`pnpm db:up`).

## The dev loop

```bash
pnpm install
pnpm typecheck     # tsc --noEmit (strict)
pnpm check         # Biome lint + format check
pnpm lint:fix      # apply Biome fixes
pnpm test          # Vitest run
pnpm demo          # CodeReview workflow end-to-end on in-memory fakes
```

All four of `typecheck`, `check`, `test`, `demo` must pass before a change is done. CI mirrors them.

## Local substrate stores (optional)

```bash
cp .env.example .env
pnpm db:up         # Neo4j + TimescaleDB + Postgres/pgvector (needs Docker)
# seed the Code Graph once:
docker compose exec -T neo4j cypher-shell -u neo4j -p forge-dev-neo4j < infra/init/neo4j/code.cypher
pnpm db:down       # stop + wipe volumes
```

The Postgres-based stores auto-apply `infra/init/*` on first boot. The default dev loop
(`test`/`demo`) uses the in-memory client and needs **no** databases.

## Conventions

- **TypeScript:** strict, ESM, no emit. Keep the `_`-prefixed param idiom for unimplemented stubs.
- **Workflows:** take activities as an injected `overrides: Partial<Activities> = {}` last arg
  ([ADR-0003](docs/adr/0003-activities-injection-seam.md)). Never hard-call side effects in a
  workflow body — go through an activity so it can be retried/replayed.
- **The write invariant is sacred:** only the Executor writes, only post Verifier∧Critic
  ([ADR-0005](docs/adr/0005-executor-only-write-gate.md)). Don't add `canWrite: true` to another role.
- **Docs:** layers are L1–L7; Learning/Tenancy/Data-Model are cross-cutting (08–10), not layers
  ([ADR-0007](docs/adr/0007-layers-and-cross-cutting.md)).
- **Decisions:** anything non-obvious gets an ADR in `docs/adr/`; open questions go in
  [docs/RISKS.md](docs/RISKS.md).

## Where things live

| Want to… | Look in |
|---|---|
| Add/realize a workflow | `src/workflows/*.workflow.ts` |
| Add an activity (side effect) | `src/activities/index.ts` |
| Touch the role/tool model | `src/agents/roles.ts`, `src/policy/` |
| Implement the substrate | `src/substrate/` (interfaces + in-memory client) |
| Change store schemas | `infra/init/` **and** keep `src/substrate/in-memory.ts` in sync |
