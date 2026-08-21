# Forge — System Architecture

This is the top-level index. Each layer and cross-cutting concern has a dedicated
deep-dive under [`docs/architecture/`](docs/architecture/). End-to-end task flows live
under [`docs/workflows/`](docs/workflows/).

---

## The one-paragraph thesis

Every Forge product runs on the same substrate: a deep, persistent, per-customer
understanding of *the codebase, the running system, and how the team actually works*.
Build that substrate once and every additional product (CodeReview, OnCall, Migrator,
and later TestGen, Refactor, Docs) is a 10x-cheaper feature, not a new company. You
stop selling seats and start selling **engineering capacity** — that is the trillion-
dollar reframe.

---

## The 7-layer stack

```
┌─────────────────────────────────────────────────────────────────────┐
│  L7  PRODUCT SURFACES                                                 │  docs/architecture/07
│      CodeReview · OnCall · Migrator · TestGen · Docs · Chat           │
│      (each = a Planner entry point bound to a webhook / MCP call)     │
├─────────────────────────────────────────────────────────────────────┤
│  L6  AGENT ORCHESTRATION                                              │  docs/architecture/06
│      Planner → Specialists → Verifier → Critic → Executor             │
│      durable workflow engine (Temporal-style), survives restarts      │
├─────────────────────────────────────────────────────────────────────┤
│  L5  TOOL LAYER (internal, typed)                                     │  docs/architecture/05
│      code.* · tests.* · git.* · obs.* · tickets.* · comms.* · cloud.* │
│      narrow agent-facing surface + policy/approval enforcement        │
├─────────────────────────────────────────────────────────────────────┤
│  L4  EXECUTION SANDBOX                                                 │  docs/architecture/04
│      per-customer ephemeral microVMs · repo clone · test replica      │
├─────────────────────────────────────────────────────────────────────┤
│  L3  REASONING SUBSTRATE  ◀── the moat                                │  docs/architecture/03
│      Code Graph · Behavioral Graph · Decision Graph · Team Graph      │
├─────────────────────────────────────────────────────────────────────┤
│  L2  INDEXING & CDC                                                    │  docs/architecture/02
│      streaming pipeline · AST re-parse · embeddings · trace linking   │
├─────────────────────────────────────────────────────────────────────┤
│  L1  INGESTION CONNECTORS (MCP lives here)                            │  docs/architecture/01
│      GitHub · GitLab · Datadog · Sentry · Linear · Slack · AWS · …    │
└─────────────────────────────────────────────────────────────────────┘
  ▲ cross-cutting concerns (not layers): Learning (08) · Tenancy & Security (09) · Data Model (10)
```

## Reading order

1. [00 — Overview & principles](docs/architecture/00-overview.md)
2. [01 — Ingestion & MCP (L1)](docs/architecture/01-ingestion-mcp.md)
3. [02 — Indexing & CDC (L2)](docs/architecture/02-indexing-cdc.md)
4. [03 — Reasoning Substrate (L3, the moat)](docs/architecture/03-reasoning-substrate.md)
5. [04 — Execution Sandbox (L4)](docs/architecture/04-execution-sandbox.md)
6. [05 — Tool Layer (L5)](docs/architecture/05-tool-layer.md)
7. [06 — Agent Orchestration (L6)](docs/architecture/06-agent-orchestration.md)
8. [07 — Product Surfaces (L7)](docs/architecture/07-product-surfaces.md)
9. [08 — Learning Architecture](docs/architecture/08-learning-architecture.md)
10. [09 — Tenancy & Security](docs/architecture/09-tenancy-security.md)
11. [10 — Data Model](docs/architecture/10-data-model.md)

Component deep-dives (not layers):

12. [11 — Retrieval Orchestrator (M2)](docs/architecture/11-retrieval-orchestrator.md)
13. [12 — Anonymizer (the cross-wall gate)](docs/architecture/12-anonymizer.md)

## Decisions, risks & roadmap

- [Architecture Decision Records](docs/adr/) — why the key choices were made
- [Risk register](docs/RISKS.md) — every open question with its chosen mitigation
- [Roadmap](docs/ROADMAP.md) — the phased path from skeletons to a shipping platform
- [Glossary](docs/GLOSSARY.md) — Forge vocabulary in one place

## End-to-end workflows

- [CodeReview E2E](docs/workflows/codereview-e2e.md) — `pr.opened` → review posted
- [OnCall E2E](docs/workflows/oncall-e2e.md) — `alert.fired` → mitigated + postmortem
- [Migrator E2E](docs/workflows/migrator-e2e.md) — migration plan → shadow-verified PRs
- [Feature Build E2E](docs/workflows/feature-build-e2e.md) — spec → shipped feature
- [Bug Fix E2E](docs/workflows/bugfix-e2e.md) — bug report → verified fix PR
- Product-A surfaces: [Analyze Repo](docs/workflows/analyze-repo-e2e.md) · [TestGen](docs/workflows/testgen-e2e.md) · [Find Edge Cases](docs/workflows/find-edge-cases-e2e.md) · [Explain Incident](docs/workflows/explain-incident-e2e.md)

## Implementation skeletons

Durable workflow definitions and agent/activity stubs live under [`src/`](src/).
These are typed skeletons that encode the orchestration shape — not production code.
A few pieces are real, deterministic logic (the role/write invariant in
[`src/agents/roles.ts`](src/agents/roles.ts) and the policy gate in
[`src/policy/policy-engine.ts`](src/policy/policy-engine.ts)); the CodeReview workflow runs
end-to-end against in-memory fakes via `pnpm demo`. See [CONTRIBUTING.md](CONTRIBUTING.md).
