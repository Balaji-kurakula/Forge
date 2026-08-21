# Glossary

One-line definitions of the Forge vocabulary. Deep dives are linked.

## Platform

- **Forge** — the platform; an autonomous AI engineering org. Repo codename `exp-x`.
- **Substrate** — the per-customer, four-graph reasoning layer; the moat ([03](./architecture/03-reasoning-substrate.md)).
- **Product A** — `engineer-mcp`, the pluggable MCP server; the wedge ([07](./architecture/07-product-surfaces.md)).
- **Product B** — the always-on per-customer substrate platform; the business.

## The 7 layers

- **L1 Ingestion/MCP** — connectors to the customer's systems ([01](./architecture/01-ingestion-mcp.md)).
- **L2 Indexing & CDC** — streaming pipeline that turns events into substrate updates ([02](./architecture/02-indexing-cdc.md)).
- **L3 Reasoning Substrate** — the four graphs ([03](./architecture/03-reasoning-substrate.md)).
- **L4 Execution Sandbox** — ephemeral microVMs where agents run code ([04](./architecture/04-execution-sandbox.md)).
- **L5 Tool Layer** — narrow, typed, policy-enforced verbs the agents call ([05](./architecture/05-tool-layer.md)).
- **L6 Agent Orchestration** — durable workflows + the agent roles ([06](./architecture/06-agent-orchestration.md)).
- **L7 Product Surfaces** — each product = a Planner entry point on a trigger ([07](./architecture/07-product-surfaces.md)).

## Cross-cutting concerns (not layers)

- **Learning (08)** — M1–M4, how knowledge accumulates ([08](./architecture/08-learning-architecture.md)).
- **Tenancy & Security (09)** — the wall, keys, audit, policy ([09](./architecture/09-tenancy-security.md)).
- **Data Model (10)** — concrete store schemas + the NodeId ([10](./architecture/10-data-model.md)).

## The four graphs

- **Code Graph** — what the code *is* (Neo4j + tree-sitter).
- **Behavioral Graph** — what it *does* at runtime (TimescaleDB + traces).
- **Decision Graph** — *why* it exists (Postgres + pgvector: PRs, RFCs, postmortems, Slack).
- **Team Graph** — *who* owns/knows what (Postgres).

## Agent roles

- **Planner** — decomposes the task, picks specialists, allocates budget.
- **Specialists** — Coder, Reviewer, Tester, Debugger, Architect, SecAuditor (all propose, none write).
- **Verifier** — runs tests/types/lints; checks claims.
- **Critic** — adversarial, refute-by-default; a result survives only if it can't be broken.
- **Executor** — the **only** role that may call write tools, and only post-gate ([ADR-0005](./adr/0005-executor-only-write-gate.md)).

## Learning modes

- **M1 Substrate Growth** — knowledge accumulates in the graphs (the main thing).
- **M2 In-Context Retrieval** — pack the right slice into the window ([11](./architecture/11-retrieval-orchestrator.md)).
- **M3 Preference Learning** — per-customer rules/examples learned from feedback.
- **M4 Model Fine-Tuning** — rare; Migrator-LM, domain languages, latency-critical loops.

## Key terms

- **The gate** — Verifier ∧ Critic must both pass before any write.
- **Tenancy wall** — physical isolation; only the anonymizer crosses ([12](./architecture/12-anonymizer.md)).
- **Anonymizer** — extracts abstract patterns under opt-in + DP + k-anonymity + human gate.
- **NodeId** — `<tenant>:<graph>:<kind>:<stableKey>`, the cross-graph join key.
- **Shadow-diff** — run OLD vs NEW over replayed prod inputs; zero divergence required (Migrator).
- **Autonomy ladder** — draft → propose → execute-with-approval → autonomous (per-tenant).
- **Activities** — the side-effecting steps durable workflows call; injected for testing ([ADR-0003](./adr/0003-activities-injection-seam.md)).
