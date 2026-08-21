# 11 — Retrieval Orchestrator (M2)

The Retrieval Orchestrator is how Forge *uses* what it learned. It is **not** a new layer — it
is the component (part of L6, [06](./06-agent-orchestration.md)) that implements learning mode
**M2** ([08](./08-learning-architecture.md)). Skeleton:
[`../../src/substrate/retrieval.ts`](../../src/substrate/retrieval.ts).

> The model does not "know" your codebase. For every task, the orchestrator retrieves exactly the
> right slice of the substrate and packs it into the context window. Fresh, updateable, auditable.

## Where it sits

```
 Planner ──asks──▶ Retrieval Orchestrator ──fans out──▶ four graphs (L3) + preference layer (M3)
                          │                                + shared patterns (post-wall)
                          ▼
                   rank → pack (≤ budget) → RetrievedContext ──▶ Specialists reason over it
```

## The pipeline

1. **Resolve the anchor.** A `TaskRef` (symbol / path / PR / incident / free-text) is resolved to
   a set of seed `NodeId`s via the Code Graph and semantic search over the Decision Graph.
2. **Fan-out query.** A single logical query expands across all four graphs (the `chargeCustomer`
   example in [03](./03-reasoning-substrate.md) / [10](./10-data-model.md)): structural neighbors,
   recent behavior, touching decisions, owners.
3. **Enrich with M3.** Fold in the per-tenant preference layer — banned suggestions, severity
   weights, style rules, few-shot examples — and any anonymized shared patterns relevant to the task.
4. **Rank.** Score candidates by `recency × graph-proximity × semantic-similarity × feedback-weight`.
5. **Pack.** Greedily fill the context window up to `budget.maxTokens` (target 1M), keeping the
   highest-value items and summarizing the tail when it would overflow.

## Why pack instead of fine-tune

| Property | Retrieved context (M2) | Fine-tuning (M4) |
|---|---|---|
| Freshness | code from 5 minutes ago | stale until retrain |
| Updateability | instant (no training) | retraining cadence |
| Auditability | you can see exactly what was read | opaque weights |

## Determinism (for workflow replay)

The orchestrator must be **deterministic given a substrate snapshot** so the durable workflow
([06](./06-agent-orchestration.md)) can replay. Ranking ties are broken by stable `NodeId`; the
snapshot version is recorded so a replay reads the same slice.

## Open questions / risks

- **Packing strategy** — greedy-by-score vs diversity-aware (avoid five near-duplicate PRs); the
  tail-summarization step is where signal is most easily lost.
- **Ranking calibration** — the feedback-weight term couples M2 to M3; a bad preference rule can
  starve genuinely relevant context.
- **Budget pressure on huge tasks** — a 5,000-file blast radius can exceed even a 1M window; needs
  hierarchical summarization, not truncation.
- **Snapshot vs freshness** — pinning a snapshot for replay determinism fights the < 10 s freshness
  SLO ([02](./02-indexing-cdc.md)); the structural slice must reflect the task's exact commit.
