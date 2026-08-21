# End-to-End Workflow — Explain Incident

**Trigger:** `engineer-mcp` `explain_incident(repo, incident)` ([Product A](../architecture/07-product-surfaces.md)).
**SLA:** seconds-to-minutes.
**Skeleton:** [`../../src/workflows/explainincident.workflow.ts`](../../src/workflows/explainincident.workflow.ts).
**Engine:** durable workflow ([L6](../architecture/06-agent-orchestration.md)). Read-only.

A pure traversal of the **Decision + Behavioral** graphs — the "why did this happen" query that
ends the archaeology tax.

## Sequence

```
1.  explain_incident(repo, incidentId) ─▶ start explainIncidentWorkflow{incidentId,repo,tenant}
2.  RETRIEVAL ORCHESTRATOR (M2) pulls the incident slice:
      • Behavioral Graph: the metric/error timeline, the affected endpoint, the deploy SHA
      • Decision Graph:   the suspect PR, its RFC/Slack thread, the postmortem (if any)
      • Code Graph:       the function the endpoint implements + recent touches
      • Team Graph:       who owned/was paged for it
3.  DEBUGGER assembles the narrative: timeline → suspect change → linked discussion → fix
4.  return { incidentId, explanation }   (no writes)
```

## What requires human approval

Nothing — read-only graph traversal.

## Notes

- This is the **cross-product flywheel** ([00](../architecture/00-overview.md)) made queryable:
  it works because CodeReview indexed the change and OnCall recorded the incident.
- The same correlation logic powers OnCall's live triage ([oncall-e2e](./oncall-e2e.md)); here it
  runs after the fact for understanding rather than mitigation.

## Open questions / risks

- **Linkage accuracy** — entity resolution (does this Slack thread really refer to *this* incident?)
  is fuzzy; a wrong link produces a confident-but-wrong story.
- **Sparse history** — incidents before the substrate matured have thin Decision-Graph links.
