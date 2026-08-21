# Forge — Progress Tracker

> **Living document.** This file is the single source of truth for "what is done"
> vs. "what is still to do." **Update it whenever a change is made** — move items
> between the Done / In-Progress / To-Do sections, tick boxes, and add an entry to
> the Changelog at the bottom with the date.

**Last updated:** 2026-06-09
**Current phase:** Phase 0 ✅ complete · **Phase 1 in progress** (Code Graph slice done)
**Health:** `typecheck` ✅ · `test` ✅ (19 passed, 3 skipped) · `demo` ✅ · `check` (lint) — assumed green per CI

---

## 1. The big picture

Forge is an autonomous AI engineering platform built on **one shared reasoning
substrate** (the "moat") that powers multiple products: **CodeReview**, **OnCall**,
and **Migrator** (plus later TestGen, Refactor, Docs).

- **Product A (the wedge):** a pluggable MCP server (`src/mcp/engineer-mcp.ts`) any
  host (Cursor, Claude Code, CI bot) can call.
- **Product B (the business):** the always-on per-customer substrate — four graphs:
  **Code · Behavioral · Decision · Team**.

The codebase today is a **typed, compiling, tested skeleton** of the full
orchestration, plus a **real working Code Graph** vertical slice (Phase 1). Most
side-effecting activities, connectors, the sandbox, Temporal wiring, and model calls
are still typed stubs that throw `not implemented`.

7-layer model: **L1** Ingestion/MCP · **L2** Indexing & CDC · **L3** Reasoning
Substrate · **L4** Execution Sandbox · **L5** Tool Layer · **L6** Agent
Orchestration · **L7** Product Surfaces. Cross-cutting: Learning (08), Tenancy &
Security (09), Data Model (10).

---

## 2. What is DONE ✅

### Foundation / toolchain (Phase 0)
- [x] pnpm + Biome + Vitest + TypeScript-strict toolchain (`package.json`, `biome.json`, `tsconfig.json`, `vitest.config.ts`).
- [x] CI pipeline (`.github/workflows/ci.yml`): typecheck → lint/format → test → demo smoke.
- [x] `docker-compose.yml` for the local substrate stores: **Neo4j 5**, **TimescaleDB (pg16)**, **pgvector (pg16)** + healthchecks and named volumes.
- [x] Seed data: `infra/init/neo4j/code.cypher`, `infra/init/timescale/01-behavioral.sql`, `infra/init/pgvector/{01-decision,02-team,03-seed-chargecustomer}.sql`.
- [x] `.env.example`, `.nvmrc`, `.gitignore`.

### Documentation (all prose-complete)
- [x] `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`.
- [x] 13 architecture deep-dives in `docs/architecture/` (00–12, one per layer + cross-cutting + retrieval/anonymizer deep-dives).
- [x] 9 end-to-end workflow docs in `docs/workflows/`.
- [x] 9 ADRs in `docs/adr/` (0001–0008 + README).
- [x] `docs/ROADMAP.md`, `docs/RISKS.md`, `docs/GLOSSARY.md`, `docs/diagrams/README.md`.

### Real, tested logic (not stubs)
- [x] **Executor-only write invariant** (`src/agents/roles.ts`) — role/tool model; only `Executor` has `canWrite`. `assertMayWrite()` guard. Tested in `tests/roles.test.ts`.
- [x] **L5 policy / approval gate** (`src/policy/policy-engine.ts`) — `DefaultPolicyEngine`: read-only ALLOW; low-risk write Executor-only after Verifier+Critic; high-risk (`cloud.*`) REQUIRE_APPROVAL; unknown tools fail closed; tenant `forbidden` → DENY. Tested in `tests/policy-engine.test.ts` (7 tests).
- [x] **CodeReview workflow end-to-end on in-memory fakes** (`src/workflows/codereview.workflow.ts` + `src/runtime/in-memory-activities.ts`). `pnpm demo` runs it; Critic confidence-threshold visibly drops low-signal findings. Tested in `tests/codereview.e2e.test.ts`.
- [x] **OnCall autonomy-ladder logic** (`src/workflows/oncall.workflow.ts`) — human-approval gate modeled as a signal-parked workflow. Tested in `tests/oncall.test.ts` (4 tests).
- [x] **Migrator topological module ordering** (`topoOrder` in `src/workflows/migrator.workflow.ts`) — leaf-first dependency ordering. Tested in `tests/migrator-topo.test.ts`.
- [x] **InMemorySubstrateClient** (`src/substrate/in-memory.ts`) — seeded `chargeCustomer` worked example covering all four graphs; lets workflows run without DBs.

### Phase 1 — real Code Graph slice ✅
- [x] **L2 tree-sitter extractor** (`src/indexer/extract.ts`) — parses TS/TSX with web-tree-sitter (WASM, no native build); extracts function/class symbols, intra-file CALLS edges, file IMPORTS edges. Tested in `tests/extract.test.ts` (3 tests).
- [x] **L2 Neo4j writer** (`src/indexer/neo4j-writer.ts`) — idempotent MERGE of `:Code` nodes + CALLS/IMPORTS edges, tenant-scoped, best-effort call resolution, unresolved-call counting.
- [x] **L3 real `Neo4jSubstrateClient`** (`src/substrate/stores/neo4j-client.ts`) — Code-Graph methods (`getCodeNode`, `neighbors`, `queryContext`, seed resolution) query live Neo4j. Behavioral/Decision/Team methods return empty (Phase 2).
- [x] **CLIs**: `pnpm index <dir>` (`src/cli/index-repo.ts`) and `pnpm graph <symbol>` (`src/cli/query-codegraph.ts`). Dogfoods on Forge's own `src/`.
- [x] **Neo4j integration test** (`tests/neo4j-integration.test.ts`) — gated on `FORGE_TEST_NEO4J`; skipped in CI (no DB). 3 tests, currently skipped locally.

---

## 3. IN PROGRESS / partially done 🟡

These have a **typed skeleton or interface** but no working runtime — the contract is
encoded, the logic throws `not implemented` or returns empty.

- 🟡 **L6 Agent orchestration runtime** — roles/invariants are real, but `runSpecialist`, `verify`, `critique` are stubs in `src/activities/index.ts` (no model calls).
- 🟡 **L5 Tool layer activities** (`src/activities/index.ts`) — every `code.*`, `tests.*`, `git.*`, `obs.*`, `tickets.*`, `comms.*`, `cloud.*` activity is a typed stub that throws.
- 🟡 **Retrieval Orchestrator (M2)** (`src/substrate/retrieval.ts`) — interface + budget/ranking types defined; packing logic is skeleton.
- 🟡 **Preference Layer (M3)** (`src/substrate/preferences.ts`) — types and rule model defined; no feedback capture/application logic.
- 🟡 **Audit log** (`src/policy/audit-log.ts`) — `InMemoryAuditLog` reference exists; production append-only/tamper-evident store not built.
- 🟡 **Product-surface workflows** (skeletons that wire activities but depend on the stubbed activity layer): `bugfix`, `featurebuild`, `testgen`, `findedgecases`, `explainincident`, `analyzerepo`.
- 🟡 **MCP server** (`src/mcp/engineer-mcp.ts`) — handler shapes/TaskHandle defined; **no transport wiring**, returns handles only.

---

## 4. TO DO ⬜ (by phase)

### Phase 1 — finish the CodeReview-on-a-real-repo slice
- [ ] **L1: GitHub MCP connector** — read + scoped PR-comment write. *Needs a token + test repo.*
- [ ] **L2: incremental Git CDC** — re-index only files touched on push.
- [ ] **L3: pgvector semantic search** wired into the SubstrateClient (`semanticSearch` currently returns `[]`).
- [ ] **L6: real Temporal deployment** — wire workflows onto Temporal; model calls become activities.
- [ ] **L7: `pr.opened` webhook** → CodeReview posts inline comments behind the policy gate.
- [ ] **M3: capture accept/reject feedback** into the preference layer (`onCommentFeedback` → real `applyPreferences`).
- [ ] **Exit criterion:** a real PR on a test repo gets gated, useful inline comments.

### Phase 2 — Behavioral graph + OnCall
- [ ] L1: Datadog/Sentry MCP connectors.
- [ ] L2: Log/Metric CDC linked to deploy SHA.
- [ ] L3: Behavioral Graph backed by **TimescaleDB**; cross-graph correlation ("incident ↔ recent PR").
- [ ] L3: Decision Graph + Team Graph backed by **Postgres/pgvector** (`behaviorFor`, `decisionsTouching`, `ownerOf` currently return empty).
- [ ] L7: `alert.fired` → OnCall triage → mitigation proposal up the autonomy ladder.
- [ ] M1: Postmortems written back into the Decision Graph (`writePostmortem` is a stub).
- [ ] **Exit criterion:** an injected incident is correlated to its suspect PR and a gated mitigation is proposed.

### Phase 3 — Sandbox + Migrator
- [ ] **L4: real execution sandbox** (`src/sandbox/sandbox.ts` is interface-only) — Firecracker/gVisor microVMs, CoW clones, warm pools, snapshotting, allowlisted egress.
- [ ] Shadow-diff harness (OLD vs NEW over replayed prod inputs).
- [ ] Migrator parent/child workflows with `continueAsNew`; characterization-tests-first.
- [ ] M4: Migrator-LM trained on anonymized old→new pairs (via the anonymizer).
- [ ] **Exit criterion:** a small service migrates module-by-module with zero shadow-diff divergence.

### Phase 4 — Platform & expansion
- [ ] **Anonymizer** (`src/security/anonymizer.ts` is interface-only) — DP guarantees + k-anonymity + explicit opt-in + human review gate; shared pattern library live.
- [ ] Wave-2 surfaces reuse the substrate: TestGen, Refactor, Docs.
- [ ] Single-tenant in-VPC deployment for F500/regulated; SOC 2 Type II.
- [ ] **Exit criterion:** a second product ships in weeks, not quarters.

---

## 5. Component status matrix

| Layer / Component | File(s) | Status |
|---|---|---|
| L1 Ingestion / MCP connectors | `src/mcp/engineer-mcp.ts` | 🟡 shape only, no transport |
| L2 Extractor (tree-sitter) | `src/indexer/extract.ts` | ✅ real + tested |
| L2 Neo4j writer | `src/indexer/neo4j-writer.ts` | ✅ real |
| L2 Incremental Git CDC | — | ⬜ to do |
| L3 Code Graph client | `src/substrate/stores/neo4j-client.ts` | ✅ real (Code methods) |
| L3 Behavioral / Decision / Team | (neo4j-client returns empty) | ⬜ Phase 2 |
| L3 In-memory substrate | `src/substrate/in-memory.ts` | ✅ seeded fake |
| L3 Retrieval Orchestrator (M2) | `src/substrate/retrieval.ts` | 🟡 skeleton |
| L3 Preference Layer (M3) | `src/substrate/preferences.ts` | 🟡 skeleton |
| L4 Execution Sandbox | `src/sandbox/sandbox.ts` | 🟡 interface only |
| L5 Policy gate | `src/policy/policy-engine.ts` | ✅ real + tested |
| L5 Audit log | `src/policy/audit-log.ts` | 🟡 in-memory ref only |
| L5 Tool activities | `src/activities/index.ts` | 🟡 stubs throw |
| L6 Roles / write invariant | `src/agents/roles.ts` | ✅ real + tested |
| L6 Agent runtime (model calls) | `src/activities/index.ts` | 🟡 stubs |
| L7 CodeReview workflow | `src/workflows/codereview.workflow.ts` | ✅ runs on fakes |
| L7 OnCall workflow | `src/workflows/oncall.workflow.ts` | 🟡 ladder logic tested, activities stubbed |
| L7 Migrator workflow | `src/workflows/migrator.workflow.ts` | 🟡 topo tested, rest skeleton |
| L7 Other workflows | `bugfix`, `featurebuild`, `testgen`, `findedgecases`, `explainincident`, `analyzerepo` | 🟡 skeleton |
| Anonymizer (cross-wall) | `src/security/anonymizer.ts` | 🟡 interface only |
| Temporal deployment | — | ⬜ to do |

**Legend:** ✅ real working logic · 🟡 typed skeleton / partial · ⬜ not started

---

## 6. How to verify current state

```bash
pnpm install            # or: npx <tool> if pnpm unavailable
pnpm typecheck          # tsc --noEmit          → green
pnpm check              # Biome lint + format   → green
pnpm test               # Vitest                → 19 passed, 3 skipped (neo4j)
pnpm demo               # CodeReview e2e on fakes

# Phase 1 (needs Docker):
pnpm db:up
pnpm index src                          # parse TS into Neo4j Code Graph
pnpm graph extractFromSource            # query a symbol's neighborhood
FORGE_TEST_NEO4J=1 pnpm test            # runs the 3 skipped Neo4j integration tests
pnpm db:down
```

> Note: in this environment `pnpm` was not on PATH; tools were run via `npx <tool>`
> (vitest/tsc) directly out of `node_modules/.bin`. Tests and typecheck both pass.

---

## 7. Test inventory (22 tests across 7 files)

| File | Tests | Covers |
|---|---|---|
| `tests/roles.test.ts` | 2 | Executor-only write invariant |
| `tests/policy-engine.test.ts` | 7 | L5 gate decisions |
| `tests/codereview.e2e.test.ts` | 1 | CodeReview Verifier+Critic gate on fakes |
| `tests/oncall.test.ts` | 4 | OnCall autonomy ladder / approval signal |
| `tests/migrator-topo.test.ts` | 2 | Leaf-first module ordering |
| `tests/extract.test.ts` | 3 | tree-sitter symbol/call/import extraction |
| `tests/neo4j-integration.test.ts` | 3 (skipped) | Real writer + client vs live Neo4j |

---

## Changelog

- **2026-06-09** — Initial progress tracker created. Audited full repo: Phase 0
  complete, Phase 1 Code Graph slice complete (extractor + Neo4j writer + client +
  CLIs). Verified `typecheck` green and `test` green (19 passed / 3 skipped). Captured
  component status matrix and remaining Phase 1–4 to-do.
