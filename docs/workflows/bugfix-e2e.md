# End-to-End Workflow — Bug Fix

**Trigger:** `engineer-mcp` `fix_bug(repo, issue_id|desc)` ([Product A](../architecture/07-product-surfaces.md)),
a linked issue, or a Chat report.
**SLA:** interactive-to-hours.
**Engine:** durable workflow ([L6](../architecture/06-agent-orchestration.md)).
Shares the same spine as [feature-build](./feature-build-e2e.md), but opens with **reproduce-first**.

## Sequence

```
1.  fix_bug(repo, "checkout returns 500 on coupon apply") ─▶ start bugFixWorkflow; returns taskId
2.  PLANNER frames the bug; allocates budget
3.  DEBUGGER REPRODUCES in the sandbox (L4):
      • pulls logs/traces for the failing path        (obs.* over Behavioral Graph)
      • builds a minimal failing test that triggers the bug
      • if it can't reproduce ─▶ gather more signal / ask the reporter (human signal)
4.  DEBUGGER LOCALIZES the root cause via the Code Graph:
      • trace the failing call path; identify the responsible function
      • Decision Graph: "was this path changed recently? by which PR?"
5.  CODER writes the fix
6.  TESTER adds a REGRESSION TEST (the reproduction from step 3, locked in)
7.  VERIFIER runs tests: the new regression test passes, nothing else breaks
8.  CRITIC (adversarial):
      • try to break the fix with adjacent inputs
      • "PREDICT WHAT'LL BREAK": run the change against the Behavioral Graph —
          callers of the changed fn + their SLOs + unusual prod inputs
      • check it doesn't REINTRODUCE a past incident pattern (Decision Graph)
9.  if VERIFIER ∧ CRITIC pass ─▶ EXECUTOR opens a PR (fix + regression test + root-cause writeup)
10. FEEDBACK: merged / changes-requested / reverted ─▶ M3 preference layer
```

## Swimlane

```
 MCP call  Planner  Debugger          Coder   Tester    Verifier  Critic    Executor
   │         │         │                │        │          │        │          │
 fix_bug───▶ frame    │                │        │          │        │          │
   │         │   reproduce+localize     │        │          │        │          │
   │         │   (can't repro?─▶ ask reporter)   │          │        │          │
   │         │         └─root cause───▶ fix──────▶ regression test   │          │
   │         │                                    └────────▶ verify  │          │
   │         │                                               └─pass──▶ break it? │
   │         │                                                  predict-breakage │
   │         │                                                        └─pass────▶ open PR
 feedback ◀──────────────────── merge/changes/revert ─────────────────────────────┘ → M3
```

## The "predict what'll break" check

Before shipping, the Critic runs the proposed change against the **Behavioral Graph**:

> *"`applyCoupon` is called by 14 services; 3 have <1ms SLOs; your change adds a DB lookup
> (+5ms p99). Two of those callers will breach SLO."*

A generic coding agent fixes the bug and ships the regression. Forge catches the **second-order
breakage** because it knows the runtime blast radius.

## Failure handling

| Failure | Handling |
|---|---|
| Can't reproduce | Gather more signal (logs/traces/repro steps); ask the reporter; don't blind-fix |
| Fix breaks other tests | Re-plan; Critic feedback guides the Coder (bounded retries) |
| Fix reintroduces a known incident pattern | Critic blocks; Coder reworks |
| Predicted SLO breach | Flag to human with the impacted callers; propose an alternative (cache/async) |
| Root cause is in a dependency | Open an issue/PR upstream or apply a guarded workaround, clearly noted |

## What requires human approval

PR open is automatic post-gate; **merge is always human**. A fix that requires a risky change
(schema, shared library, infra) escalates for confirmation first.

## Notes

- **Reproduce-first** is non-negotiable: a fix without a failing-then-passing regression test is a
  guess. The sandbox ([L4](../architecture/04-execution-sandbox.md)) is what makes reproduction real.
- This flow feeds OnCall: a bug pattern caught here strengthens the incident playbooks
  ([oncall-e2e](./oncall-e2e.md)); a fix that touches a recently-incident-prone area is flagged via
  the Decision Graph.

## Open questions / risks

- **Non-deterministic bugs** — flaky/heisenbugs resist reproduction; may need many runs or
  production-trace replay.
- **Underspecified reports** — "it's broken" needs the reporter loop; adds latency.
- **Blast-radius data freshness** — the "what'll break" check is only as good as the Behavioral
  Graph's coverage of real callers.
