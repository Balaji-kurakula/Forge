# 03 — Reasoning Substrate (L3) — THE MOAT

This is the most important layer in Forge. The substrate is what a senior engineer at the
customer has in their head after three years: a deep, fresh, queryable model of *the code, the
running system, the decisions, and the people*. Nobody has built it as a product. Whoever does,
owns engineering.

The substrate is **four interlocking graphs** in a hybrid store (graph DB + vector DB +
time-series/columnar). They reference each other through a stable cross-graph node ID
(see [10 Data Model](./10-data-model.md)), and queries fan across all four.

```
        ┌───────────────┐  implements/tests   ┌────────────────────┐
        │  CODE GRAPH    │◀───────────────────▶│ BEHAVIORAL GRAPH    │
        │  (Neo4j +      │                     │ (TimescaleDB +      │
        │   tree-sitter) │                     │  trace store)       │
        └──────┬─────────┘                     └─────────┬──────────┘
               │ touched-by                 caused-incident│
               ▼                                           ▼
        ┌───────────────┐    owns/reviews     ┌────────────────────┐
        │ DECISION GRAPH │◀───────────────────▶│  TEAM GRAPH         │
        │ (Postgres +    │                     │  (Postgres)         │
        │  pgvector)     │                     │                     │
        └───────────────┘                     └────────────────────┘
```

---

## Code Graph — *what the code is*

- **Store:** Neo4j (graph) + pgvector for embeddings. Built/updated by tree-sitter + language
  servers via [Git CDC](./02-indexing-cdc.md).
- **Nodes:** files, classes, functions, types, modules, services.
- **Edges:** `calls`, `imports`, `inherits`, `implements`, `tests`, `deploys-to`.
- **Per-node attributes:** AST snippet, embedding, owner (CODEOWNERS + blame), last-modified,
  blame, cyclomatic complexity, public/private, language.
- **Update trigger:** every commit — incremental re-parse of touched files only.

## Behavioral Graph — *what the system does at runtime*

- **Store:** TimescaleDB (hypertables for time-series) + a trace store.
- **Nodes:** services, endpoints, DB tables, queues.
- **Edges:** `calls-runtime`, `reads`, `writes`, `depends-on`.
- **Per-edge attributes:** latency distribution (p50/p95/p99), error rate, throughput,
  saturation.
- **Linkage:** each behavioral node links back to the **Code Graph** node that *implements* it
  (the function behind an endpoint), and each metric series links to the **deploy SHA** in
  effect — so behavior attaches to an exact code version.
- **Update trigger:** continuous OpenTelemetry / APM streams via [Log/Metric CDC](./02-indexing-cdc.md).

## Decision Graph — *why the code is the way it is*

- **Store:** Postgres + pgvector (embeddings for semantic recall).
- **Nodes:** PRs, issues, RFCs, postmortems, Slack threads, design docs.
- **Edges:** `discusses`, `decided`, `reverted`, `caused-incident`.
- **Linkage:** to the Code Graph (which functions a PR touched) and the Behavioral Graph
  (which incident a change caused).
- **Why it matters:** this is what lets an agent say *"this function was added in PR #2891,
  here's the linked RFC, here's the Slack thread, here's the postmortem it was fixing"* —
  ending the 30%-of-engineering-time "archaeology" tax.
- **Update trigger:** [Ticket/Slack/PR CDC](./02-indexing-cdc.md).

## Team Graph — *who knows and owns what*

- **Store:** Postgres.
- **Nodes:** people, teams, services.
- **Edges:** `owns`, `reviews`, `was-on-call-for`, `was-paged-for`.
- **Use:** routing (who should review this PR?), escalation (who do we page?), and
  "who would know about this?" queries.
- **Update trigger:** org/ownership CDC, review history, on-call schedules.

---

## The unified cross-graph query (the payoff)

The four graphs are valuable *because they query together*. A single agent query:

> *"For function `chargeCustomer`, give me the call graph, the production error rate over the
> last 7 days, the last 5 PRs that touched it, and the engineer who owns it."*

resolves across all four in **sub-second**:

```
 chargeCustomer (Code Graph node)
   ├─ Code Graph:      callers/callees, type signature, tests
   ├─ Behavioral Graph: endpoint it implements → 7-day error rate = 0.3%, p99 = 240ms
   ├─ Decision Graph:   PRs #5012, #4980, #4871, #4802, #4790 (touched), + the RFC that birthed it
   └─ Team Graph:       owner = payments-team, primary = @asha
```

This single query is what feeds the **Retrieval Orchestrator** (M2 in
[08 Learning](./08-learning-architecture.md)), which packs it into a 1M-token context window
for the agents.

## The hybrid store strategy

No single database does all of this well, so the substrate is **polyglot** and a query planner
fans a logical query across stores:

| Concern | Store | Why |
|---|---|---|
| Structural graph traversal | Neo4j (Code), Postgres FK (Decision/Team) | cheap multi-hop edges |
| Time-series behavior | TimescaleDB + trace store | high-cardinality, time-windowed |
| Semantic recall | pgvector | "find similar functions / past incidents" |
| Cross-graph join key | stable `NodeId` ([10](./10-data-model.md)) | lets all four reference each other |

The query planner resolves the structural slice first (graph hops), then enriches with
time-series and vector lookups, then assembles a single `RetrievedContext` object.

## Freshness guarantees

Per [02](./02-indexing-cdc.md): Code Graph < 10 s after commit; Behavioral/Decision < 30 s.
Stale reads are tolerated for non-critical enrichment but the structural Code Graph used for a
review must reflect the PR's exact commit.

## The hard systems problem

Keeping all four graphs **consistent, fresh, and sub-second-queryable** across a **50M-LOC
monorepo with 1000 commits/day** is a Google-Search-class problem:

- incremental graph updates that never require a full re-parse,
- query latency that stays sub-second as the graph grows to billions of edges,
- consistency across four heterogeneous stores under continuous writes.

This is where competitors fail silently — they do indexing (Code Graph) and call it "learning,"
but never build the Behavioral or Decision graphs, so they can never explain *why* or predict
*what breaks*.

## Open questions / risks

- **Cross-store consistency** under continuous writes — no distributed transaction spans
  Neo4j + Timescale + Postgres; needs a reconciliation/outbox strategy.
- **Query-planner latency** at billion-edge scale — may need a materialized "hot context" cache
  per frequently-touched symbol.
- **Graph bloat** — retention/compaction policy for old behavioral series and stale nodes.
- **Linkage accuracy** — entity resolution (does this Slack thread really refer to *this* PR?)
  is fuzzy and errors poison the Decision Graph.
