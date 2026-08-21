# Roadmap

The phased path from "compiling skeletons" to "shipping platform." Each phase ends with something
demonstrable. Phases map to the expansion waves in [00-overview](./architecture/00-overview.md).

## Phase 0 — Foundation ✅ (this repo)

Buildable, typed, tested skeleton; design made consistent.

- Toolchain (pnpm/Biome/Vitest/TS-strict), CI, git.
- All 9 workflows + the prose-only components have typed skeletons.
- Real, tested safety logic: the Executor-only write invariant + the L5 policy gate.
- CodeReview runs end-to-end on in-memory fakes (`pnpm demo`).
- docker-compose stores + seed; ADRs, risk register, glossary, diagrams.

**Exit:** `pnpm typecheck && pnpm check && pnpm test && pnpm demo` green.

## Phase 1 — Code Graph + CodeReview on a real repo

The first vertical slice that touches a customer's world. (Replaces senior review time; Wave 1.)

- ✅ **L2: tree-sitter (web-tree-sitter, WASM) → Code Graph in Neo4j.** `pnpm index <dir>`
  parses TS/TSX into `:Code` nodes + CALLS/IMPORTS edges (idempotent MERGE). See
  `src/indexer/`. Dogfoods on Forge's own `src/`.
- ✅ **L3: real `Neo4jSubstrateClient`** — the Code-Graph methods of `SubstrateClient` query
  live Neo4j (`pnpm graph <symbol>`). See `src/substrate/stores/neo4j-client.ts`. Behavioral/
  Decision/Team methods return empty until Phase 2.
- ⬜ L1: GitHub MCP connector (read + scoped PR-comment write). *Needs a token + repo.*
- ⬜ L2: incremental Git CDC (re-index only touched files on push).
- ⬜ L3: pgvector semantic search wired into the client.
- ⬜ L6: wire workflows onto a real Temporal deployment; model calls as activities.
- ⬜ L7: `pr.opened` webhook → CodeReview posts inline comments behind the gate.
- ⬜ M3: capture accept/reject feedback into the preference layer.

**Exit:** a real PR on a test repo gets gated, useful inline comments. *(Code Graph
foundation done; the GitHub connector + Temporal wiring are the remaining work.)*

## Phase 2 — Behavioral graph + OnCall

Add runtime truth and the correlation flywheel. (Replaces PagerDuty + SRE labor.)

- L1: Datadog/Sentry MCP; L2: Log/Metric CDC linked to deploy SHA.
- L3: Behavioral Graph (TimescaleDB) + cross-graph correlation ("incident ↔ recent PR").
- L7: `alert.fired` → OnCall triage → mitigation proposal up the autonomy ladder.
- Postmortems written back into the Decision Graph (M1).

**Exit:** an injected incident is correlated to its suspect PR and a gated mitigation is proposed.

## Phase 3 — Sandbox + Migrator

Industrial modernization on durable, resumable workflows. (Replaces Accenture/TCS; Wave 1.)

- L4: Firecracker/gVisor sandbox; CoW clones, warm pools, snapshotting.
- Shadow-diff harness (OLD vs NEW over replayed prod inputs).
- Migrator parent/child workflows with `continueAsNew`; characterization-tests-first.
- M4: Migrator-LM trained on anonymized old→new pairs (via the anonymizer).

**Exit:** a small service migrates module-by-module with zero shadow-diff divergence.

## Phase 4 — Platform & expansion

- Anonymizer + shared pattern library live (DP + human gate).
- Wave-2 surfaces reuse the substrate: TestGen, Refactor, Docs.
- Single-tenant in-VPC deployment for F500/regulated; SOC 2 Type II.

**Exit:** a second product ships in weeks, not quarters — proving the substrate thesis.
