# End-to-End Workflow — OnCall

**Trigger:** `alert.fired` webhook (Datadog / PagerDuty / Sentry MCP, [L1](../architecture/01-ingestion-mcp.md)).
**SLA:** triage within minutes; mitigation gated on human approval (by default).
**Skeleton:** [`../../src/workflows/oncall.workflow.ts`](../../src/workflows/oncall.workflow.ts).
**Engine:** durable workflow ([L6](../architecture/06-agent-orchestration.md)).

## The autonomy ladder (wedge strategy)

OnCall earns trust one rung at a time — the per-tenant policy ([L5](../architecture/05-tool-layer.md))
sets the level:

```
 Rung 1: DRAFT POSTMORTEM    (read-only; zero risk — the wedge)
 Rung 2: PROPOSE FIX         (suggests rollback/scale/restart, human executes)
 Rung 3: EXECUTE WITH APPROVAL (one-click human approval, then Forge acts)
 Rung 4: AUTONOMOUS          (acts within a policy envelope, notifies after)
```

## Sequence

```
1.  alert.fired webhook ─▶ Product Surface (L7) ─▶ start onCallWorkflow{alertId,service,tenant}
2.  PLANNER classifies severity, allocates budget, picks autonomy rung
3.  DEBUGGER gathers context via obs.* (L5) over the Behavioral Graph:
      • logs/metrics/traces for the service + time window
      • error-rate / latency deltas vs baseline
      • CORRELATE to recent deploys & PRs:
          "error spike began 18:42; PR #4471 merged 18:22 → prime suspect"
                                        (Decision Graph + Code Graph)
      • Team Graph: who owns this service / who's on call
4.  DEBUGGER forms a HYPOTHESIS + proposes a mitigation
      (rollback PR #4471 | scale up replicas | restart pods | feature-flag off)
5.  VERIFIER checks the hypothesis against a metric
      ("if PR #4471 is the cause, the failing endpoint is one it touched" → confirm)
6.  CRITIC challenges: blast radius? is rollback safe (migrations? data)? side effects?
7.  EXECUTOR requests ONE-CLICK HUMAN APPROVAL (rung 3) with the full plan + evidence
      └─ workflow PARKS on an approval signal (durable; no thread held)
8.  on approval ─▶ EXECUTOR acts via cloud.rollback / cloud.scale / git.* (L5)
9.  MONITOR recovery — watch the metric until it returns to baseline (or re-escalate)
10. write POSTMORTEM into the Decision Graph (timeline, cause, fix, follow-ups)
                                        ↑ enriches the substrate (M1) + playbooks
```

## Swimlane

```
 Webhook   Planner   Debugger        Verifier   Critic    Human     Executor
   │         │          │              │          │          │          │
 alert───▶   │          │              │          │          │          │
   │     classify──────▶ pull obs +    │          │          │          │
   │         │          correlate PRs  │          │          │          │
   │         │          └─hypothesis──▶ check vs metric       │          │
   │         │                          └─pass──▶ blast radius?          │
   │         │                                     └─pass──▶ approve? ◀──┤ plan+evidence
   │         │                                                │ click──▶ execute mitigation
   │         │                                                │          └─▶ rollback/scale
   │      monitor ◀──────────── metric back to baseline ──────────────────┘
   │      postmortem ─▶ Decision Graph (M1)
```

## Failure handling

| Failure | Handling |
|---|---|
| Wrong hypothesis (Verifier fails) | Re-plan with the disconfirming evidence; widen the search |
| No human approves in time | Escalate up the Team Graph on-call chain; never auto-act below the configured rung |
| Mitigation doesn't recover the metric | Re-escalate, revert the mitigation, page a human with full context |
| Correlation ambiguous (many recent PRs) | Present ranked suspects; ask the human to disambiguate |
| Alert storm | Deduplicate related alerts into one incident workflow |

## What requires human approval

Any **write** (`cloud.rollback`, `cloud.scale`, `git.revert`) requires one-click human approval by
default (rung 3). Only an explicitly-configured policy envelope allows rung-4 autonomous action,
and even then it notifies a human immediately after.

## Notes

- The killer capability is **correlation**: because CodeReview already indexed every recent change
  ([Code/Decision graphs](../architecture/03-reasoning-substrate.md)), OnCall can name the suspect
  PR in seconds — something a pure observability tool can't do. This is the cross-product flywheel
  ([00](../architecture/00-overview.md)) in action.
- Every resolved incident teaches the Behavioral Graph which patterns cause production failures,
  which in turn makes **CodeReview** catch them pre-merge.

## Open questions / risks

- **Rollback safety** — rollbacks across DB migrations are dangerous; the Critic must model
  data/state, not just code.
- **Approval latency** — at 3am, waiting for a human costs uptime; the rung tradeoff is a real
  product tension.
- **Correlation false positives** — "merged recently" ≠ "caused it"; ranking must be evidence-based.
- **Alert quality** — garbage alerts in → garbage incidents out; needs alert-dedup and noise filtering.
