# 02 — Indexing & Change Data Capture (L2)

Raw connector events ([01](./01-ingestion-mcp.md)) are useless on their own. L2 turns the
event stream into **substrate updates** ([03](./03-reasoning-substrate.md)) in near-real-time
— fresh within *seconds* of a change, not hours. This is a **streaming pipeline**, not a
nightly batch crawler.

## Why streaming, not batch

A batch crawler that re-indexes the repo every hour means the agent reasons over stale code.
For CodeReview to comment on a PR the moment it opens, and for OnCall to correlate an incident
to a deploy that happened 20 minutes ago, the substrate must reflect reality within seconds.
The pipeline runs on **Kafka or Pulsar** with per-tenant partitioning.

```
 ingestion topic           processors (per stream type)         substrate (→ 03)
 ───────────────           ────────────────────────────         ────────────────
                      ┌──▶ Git CDC ───────────────────────────▶ Code Graph
  CloudEvents ────────┼──▶ Log/Metric CDC ───────────────────▶ Behavioral Graph
  (tenant-stamped)    ├──▶ Ticket/Slack/PR CDC ──────────────▶ Decision Graph
                      └──▶ Ownership/Org CDC ─────────────────▶ Team Graph
                                  │
                           Embedding service (shared model, per-tenant store)
```

## Git CDC

On every commit / push event:

1. **Fetch the diff** for touched paths (via L1 code connector or sandbox clone).
2. **AST re-parse** of touched files with **tree-sitter** (language-agnostic). Only changed
   files are re-parsed, not the whole repo.
3. **Dependency-graph diff** — recompute call/import/inherit edges for changed symbols and
   patch the Code Graph incrementally.
4. **Ownership recompute** — update CODEOWNERS-derived and blame-derived ownership on touched
   nodes; feed the Team Graph.
5. **Blame + last-modified** stamped on each node.
6. **Embed** changed function/file bodies for semantic search.

## Log / Metric CDC

- Streams from Datadog / Sentry / OpenTelemetry land continuously.
- Each metric/trace/error is **linked to the deploy SHA** in flight at that time, so the
  Behavioral Graph edges (latency dist, error rate, throughput) attach to the *exact* code
  version. This is what enables "this incident correlates with PR #4471."
- High-cardinality raw telemetry is downsampled/rolled up before storage; full traces are
  retained for a bounded window.

## Ticket / Slack / PR CDC

- Every ticket, PR description, review comment, RFC, postmortem, and Slack thread is
  **embedded** and **linked** to the files / services / PRs it mentions (entity extraction +
  reference resolution).
- This is what later lets the Decision Graph answer *why* code exists.

## Embedding pipeline

A shared embedding model produces vectors written into **per-tenant** vector stores (pgvector
for Decision Graph; see [10](./10-data-model.md)). The model is shared; the vectors and the
text never leave the tenant boundary ([09](./09-tenancy-security.md)).

## Correctness properties

- **Idempotency** — processing keyed on `tenant:source:eventId`; duplicates (webhook retries,
  topic re-delivery) are no-ops. Graph writes are upserts.
- **Ordering** — per-entity ordering preserved via partition key (e.g. all events for one
  repo land on one partition). Cross-entity ordering is not assumed.
- **Exactly-once *effect*** — at-least-once delivery + idempotent upserts = exactly-once
  observable result.
- **Schema versioning** — each event carries a schema version; processors handle N and N-1.

## Initial onboarding (backfill) & replay

- **Cold start** for a new repo is a **backfill**: clone, full tree-sitter parse, build the
  initial Code Graph, ingest historical PRs/issues/incidents. This takes **hours per repo**
  (vs seconds for incremental updates) and runs as a bounded, resumable job.
- **Replay** — the durable topic lets the pipeline rebuild any graph from scratch by
  replaying events, e.g. after a schema migration or processor bug fix.

## Freshness SLOs (targets)

| Update | Target latency |
|---|---|
| Code Graph after commit | < 10 s p95 |
| Behavioral Graph after metric/trace | < 30 s p95 |
| Decision Graph after PR/Slack/ticket | < 30 s p95 |
| Full backfill of a new repo | hours (bounded, resumable) |

## Open questions / risks

- **Hot partitions** — a monorepo with 1000 commits/day can overwhelm a single partition;
  needs sub-partitioning by path subtree.
- **Cross-graph consistency** — a commit and its linked PR may land out of order; the
  substrate must tolerate temporarily dangling links and reconcile.
- **Embedding cost & drift** — re-embedding on every change is costly; model upgrades force
  re-embedding the corpus.
- **Backfill blast radius** — onboarding a 50M-LOC monorepo is a heavy, long job that must not
  starve incremental updates for existing tenants.
