# End-to-End Workflow — Analyze Repo

**Trigger:** `engineer-mcp` `analyze_repo(repo)` ([Product A](../architecture/07-product-surfaces.md)).
**SLA:** seconds for a summary on an already-indexed repo; **hours** for a cold-start backfill.
**Skeleton:** [`../../src/workflows/analyzerepo.workflow.ts`](../../src/workflows/analyzerepo.workflow.ts).
**Engine:** durable workflow ([L6](../architecture/06-agent-orchestration.md)). Read-only.

## Sequence

```
1.  analyze_repo(repo) ─▶ start analyzeRepoWorkflow{repo,tenant}; returns taskId
2.  ensure ingestion + CDC (L2) is building the substrate for this repo
      • warm repo → backfill (clone, full tree-sitter parse, historical PRs/incidents) — hours
      • already indexed → incremental, seconds
3.  RETRIEVAL ORCHESTRATOR (M2) pulls the current Code Graph slice (+ owners, hotspots)
4.  ARCHITECT summarizes: services, entry points, complexity hotspots, ownership, risk areas
5.  return { repo, summary }  (no writes)
```

## What requires human approval

Nothing — read-only indexing + summary.

## Notes

- This is usually the **first** call a new tenant makes; it kicks off substrate growth (M1).
- Day-1 summaries are generic; they sharpen as the four graphs fill in (see the maturation
  timeline in [08](../architecture/08-learning-architecture.md)).

## Open questions / risks

- **Backfill blast radius** — a 50M-LOC monorepo backfill must not starve incremental updates for
  existing tenants ([02](../architecture/02-indexing-cdc.md)).
- **Summary staleness** — a summary is a point-in-time snapshot; re-run after large merges.
