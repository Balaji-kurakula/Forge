# Shared diagrams

Canonical mermaid versions of the diagrams the architecture docs reference. Keep these the source
of truth; the inline ASCII in each doc is a convenience copy.

## The 7-layer stack (+ cross-cutting concerns)

```mermaid
flowchart TB
  L7["L7 · Product Surfaces — CodeReview · OnCall · Migrator · TestGen · Docs · Chat"]
  L6["L6 · Agent Orchestration — Planner → Specialists → Verifier → Critic → Executor"]
  L5["L5 · Tool Layer — code.* tests.* git.* obs.* tickets.* comms.* cloud.*"]
  L4["L4 · Execution Sandbox — per-customer ephemeral microVMs"]
  L3["L3 · Reasoning Substrate ◀ the moat — Code · Behavioral · Decision · Team graphs"]
  L2["L2 · Indexing & CDC — streaming, AST re-parse, embeddings"]
  L1["L1 · Ingestion (MCP) — GitHub · Datadog · Sentry · Linear · Slack · AWS"]
  L7 --> L6 --> L5 --> L4 --> L3 --> L2 --> L1
  X["cross-cutting: Learning (08) · Tenancy & Security (09) · Data Model (10)"]
  X -.-> L3
```

## The four-graph substrate (L3)

```mermaid
flowchart LR
  CODE["Code Graph\n(Neo4j + tree-sitter)"]
  BEH["Behavioral Graph\n(TimescaleDB + traces)"]
  DEC["Decision Graph\n(Postgres + pgvector)"]
  TEAM["Team Graph\n(Postgres)"]
  CODE <-- "implements / tests" --> BEH
  CODE <-- "touched-by" --> DEC
  BEH <-- "caused-incident" --> DEC
  CODE <-- "owns / reviews" --> TEAM
  BEH <-- "was-paged-for" --> TEAM
```

## The agent role flow (L6)

```mermaid
flowchart TB
  T[task] --> P[Planner]
  P --> S["Specialists (parallel)\nCoder · Reviewer · Tester · Debugger · Architect · SecAuditor"]
  S --> V[Verifier]
  V -- pass --> C[Critic]
  V -- fail --> RP[Replan / Escalate]
  C -- pass --> E["Executor (only writer)"]
  C -- fail --> RP
  E --> D[Done]
```

## The tenancy wall (09)

```mermaid
flowchart TB
  subgraph PER["PER-CUSTOMER (isolated, customer-keyed)"]
    SUB["four-graph substrate"]
    PREF["preference layer (M3)"]
    SBX["execution sandbox"]
  end
  ANON{{"Anonymizer\n(DP + opt-in + human gate)"}}
  subgraph SHARED["SHARED, SAFE"]
    LIB["pattern library (anonymized)"]
    FT["fine-tuned models (synthetic/opt-in)"]
  end
  PER --> ANON --> SHARED
```
