# End-to-End Workflow — Find Edge Cases

**Trigger:** `engineer-mcp` `find_edge_cases(repo, path|fn)` ([Product A](../architecture/07-product-surfaces.md)).
**SLA:** interactive-to-minutes.
**Skeleton:** [`../../src/workflows/findedgecases.workflow.ts`](../../src/workflows/findedgecases.workflow.ts).
**Engine:** durable workflow ([L6](../architecture/06-agent-orchestration.md)). Read-only — returns cases.

This is the **Critic in adversarial mode, exposed directly** (see [feature-build](./feature-build-e2e.md)).

## Sequence

```
1.  find_edge_cases(repo, target) ─▶ start findEdgeCasesWorkflow{target,repo,tenant}; returns taskId
2.  RETRIEVAL ORCHESTRATOR (M2) pulls the target fn + its signature + callers
3.  CRITIC enumerates edge cases from three sources:
      • Enumeration       — boundary values, empty/null, overflow, unicode, concurrency
      • Property-based    — generate inputs, assert invariants hold
      • Production reality — query the Behavioral Graph for unusual inputs prod has ACTUALLY seen
4.  return { cases }   (no writes)
```

## What requires human approval

Nothing — read-only enumeration.

## Notes

- The **production-reality** source is what a generic tool can't do: edge cases grounded in real
  traffic, not hypotheticals ([Behavioral Graph](../architecture/03-reasoning-substrate.md)).
- Feeds [bug-fix](./bugfix-e2e.md) and [feature-build](./feature-build-e2e.md) as their Critic pass.

## Open questions / risks

- **Combinatorial blow-up** — enumeration must be ranked/bounded so the output stays actionable.
- **Behavioral coverage** — production-derived cases are only as good as the graph's coverage of
  real callers and inputs.
