# Forge — The AI Engineering Org

[![CI](https://github.com/Balaji-kurakula/forge/actions/workflows/ci.yml/badge.svg)](https://github.com/Balaji-kurakula/forge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg)](.nvmrc)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](tsconfig.json)
[![Status: Phase 1](https://img.shields.io/badge/status-Phase%201%20(pre--alpha)-orange.svg)](docs/ROADMAP.md)

> **Pre-alpha.** This is an architecture design plus a typed, tested skeleton — not a working
> product. Read [Status](#status) before you judge what's here.

> An autonomous engineering platform that plugs into any codebase, understands it
> deeply, and ships work: fixes bugs, builds features, reviews PRs, responds to
> incidents, and migrates legacy systems — getting demonstrably smarter every month.

Forge stacks three flagship products on **one shared reasoning substrate**:

| Product | Replaces | What it does |
|---|---|---|
| **CodeReview** | Senior-engineer review time | Staff-level PR review across correctness, security, perf, architecture |
| **OnCall** | PagerDuty + SRE labor | Autonomous incident triage → hypothesis → fix → postmortem |
| **Migrator** | Accenture / TCS engagements | Industrial-scale legacy modernization (COBOL, Java 8→17, Py2→3, AngularJS→React) |

The wedge is a small, pluggable MCP server (**Product A**). The business is the
always-on, per-customer **substrate** (**Product B**) that point-in-time tools can't replicate.

---

## Repository layout

```
forge/                            (repo codename: exp-x)
├── README.md                     ← you are here
├── ARCHITECTURE.md               ← top-level architecture index (start here)
├── CONTRIBUTING.md               ← install / typecheck / lint / test / demo / db
├── SECURITY.md · CODE_OF_CONDUCT.md · LICENSE (MIT)
├── package.json · tsconfig.json · biome.json · vitest.config.ts · docker-compose.yml
├── .github/                      ← CI workflow, issue/PR templates, Dependabot
├── docs/
│   ├── architecture/             ← one doc per layer (L1–L7) + cross-cutting (08–10) + deep-dives (11–12)
│   ├── workflows/                ← end-to-end task flows (sequence + failure handling)
│   ├── adr/                      ← architecture decision records
│   ├── diagrams/                 ← shared mermaid / ASCII diagrams
│   ├── progress.md               ← living status: component matrix + changelog
│   ├── ROADMAP.md · RISKS.md · GLOSSARY.md
├── infra/init/                   ← seed SQL (timescale, pgvector) + Cypher (neo4j)
├── src/
│   ├── workflows/                ← durable workflow definitions (Temporal-style, TS)
│   ├── activities/               ← side-effecting steps the workflows call
│   ├── agents/                   ← agent role definitions + the write invariant
│   ├── substrate/                ← four-graph interfaces, retrieval (M2), prefs (M3)
│   │   ├── in-memory.ts          ← seeded fake client (chargeCustomer)
│   │   └── stores/neo4j-client.ts← real Neo4j-backed Code Graph client (Phase 1)
│   ├── indexer/                  ← tree-sitter extractor + Neo4j Code Graph writer (Phase 1)
│   ├── cli/                      ← `pnpm index` / `pnpm graph`
│   ├── policy/                   ← L5 policy engine + audit log (real, tested logic)
│   ├── sandbox/                  ← L4 execution-sandbox interface
│   ├── security/                 ← the anonymizer (cross-wall gate; doc 09/12)
│   ├── mcp/                      ← the public engineer-mcp server (Product A)
│   ├── runtime/                  ← in-memory fake activities for local runs
│   └── demo/                     ← `pnpm demo` — CodeReview end-to-end on fakes
└── tests/                        ← Vitest: the gate, autonomy ladder, policy, extractor, Neo4j
```

## Canonical conventions (used by every doc)

- **Platform codename:** `Forge`. Repo codename: `exp-x`.
- **7 layers, fixed numbering:** L1 Ingestion/MCP · L2 Indexing & CDC · L3 Reasoning
  Substrate · L4 Execution Sandbox · L5 Tool Layer · L6 Agent Orchestration · L7 Product Surfaces.
  **Learning, Tenancy & Security, and the Data Model are cross-cutting concerns** (docs 08–10),
  not numbered layers.
- **The four graphs (the moat):** Code Graph · Behavioral Graph · Decision Graph · Team Graph.
- **Agent roles:** Planner → Specialists → Verifier → Critic → Executor.
- **Four learning modes:** M1 Substrate Growth · M2 In-Context Retrieval · M3 Preference
  Learning · M4 Model Fine-Tuning.
- **The tenancy wall:** per-customer data is physically isolated; only anonymized
  patterns cross into the shared layer.

## Quickstart

```bash
corepack enable                 # provides pnpm
pnpm install
pnpm typecheck                  # tsc --noEmit
pnpm check                      # Biome lint + format
pnpm test                       # Vitest — the gate, autonomy ladder, policy, invariants
pnpm demo                       # CodeReview end-to-end on in-memory fakes
pnpm db:up                      # local substrate stores (needs Docker); pnpm db:down to tear down

# Phase 1 — real Code Graph (needs pnpm db:up):
pnpm index src                  # parse TS into the Neo4j Code Graph (tree-sitter)
pnpm graph codeReviewWorkflow   # query a symbol's neighborhood via the real SubstrateClient
```

## Status

**Phase 0 complete; Phase 1 in progress.** This repo holds the full architecture + end-to-end
workflow design plus a typed, compiling, tested skeleton of the orchestration. Connectors,
sandbox, Temporal, and the agent model calls are still stubs that throw `not implemented`.

What's **real** today: the Executor-only write invariant, the L5 policy gate, the CodeReview
workflow end-to-end on in-memory fakes (`pnpm demo`), and — new in Phase 1 — a working
**Code Graph**: `pnpm index` parses TypeScript with tree-sitter into Neo4j, and a real
`Neo4jSubstrateClient` queries it (`pnpm graph`). The Behavioral/Decision/Team graphs and the
GitHub connector are the next Phase-1 work — see [`docs/ROADMAP.md`](docs/ROADMAP.md).

Start with [`ARCHITECTURE.md`](ARCHITECTURE.md). For a component-by-component breakdown of what
is real versus stubbed, see [`docs/progress.md`](docs/progress.md).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the dev loop and conventions. Two invariants are
non-negotiable and every PR is checked against them:

1. **Only the Executor writes**, and only after Verifier ∧ Critic
   ([ADR-0005](docs/adr/0005-executor-only-write-gate.md)).
2. **Per-tenant data stays behind the tenancy wall**; only anonymized patterns cross
   ([ADR-0006](docs/adr/0006-physical-tenancy-wall.md)).

Security issues go through GitHub's private advisory reporting, not public issues — see
[`SECURITY.md`](SECURITY.md).

## A note on the credentials in this repo

`.env.example`, `docker-compose.yml`, and `infra/init/` contain plaintext passwords such as
`forge-dev-neo4j`. These are **local-only dev defaults bound to `localhost`** and guard nothing.
Real deployments source credentials from a KMS-backed secret store per
[`docs/architecture/09-tenancy-security.md`](docs/architecture/09-tenancy-security.md).

## License

[MIT](LICENSE) © 2026 Kurakula Balaji.
