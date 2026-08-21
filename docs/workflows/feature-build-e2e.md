# End-to-End Workflow — Feature Build

**Trigger:** `engineer-mcp` `add_feature(repo, spec)` ([Product A](../architecture/07-product-surfaces.md))
or a Chat message describing a feature.
**SLA:** interactive-to-hours depending on scope.
**Engine:** durable workflow ([L6](../architecture/06-agent-orchestration.md)).

## Sequence

```
1.  add_feature(repo, spec) ─▶ start featureBuildWorkflow{spec,repo,tenant}; returns taskId
2.  PLANNER parses the spec; if ambiguous ─▶ emit a human-clarification signal and PARK
3.  ARCHITECT decomposes the feature against the Code Graph:
      • which modules/services to touch, what interfaces to add
      • checks fit with existing conventions & past design decisions (Decision Graph)
4.  RETRIEVAL ORCHESTRATOR (M2) packs context: relevant modules, similar past features,
      team conventions (M3), the affected callers (Code Graph)
5.  CODERS implement in parallel on feature branches (one per sub-component)
6.  TESTER writes tests for the new behavior (unit + integration)
7.  INTEGRATION in the sandbox (L4): assemble branches, build, run the full suite
8.  VERIFIER: tests pass, types/lint/build clean
9.  CRITIC (adversarial) — including the find_edge_cases pass:
      • enumerate boundary inputs; run property-based tests
      • "this fn is called by 14 services — does the new arg break any?"  (Code Graph)
      • "3 of those callers have <1ms SLOs — does this add latency?"      (Behavioral Graph)
      • query Behavioral Graph: "what unusual inputs has prod actually seen here?"
10. if VERIFIER ∧ CRITIC pass ─▶ EXECUTOR opens a PR (git.pr.open) with summary + test results
11. FEEDBACK: PR merged / changes-requested / human edits ─▶ M3 preference layer
```

## Swimlane

```
 MCP call  Planner   Architect   Coders     Tester    Verifier  Critic    Executor
   │         │          │           │          │          │        │          │
 add_feature─▶ parse    │           │          │          │        │          │
   │       (ambiguous?)─clarify?─▶ [PARK on human signal]  │       │          │
   │         │      decompose──────▶ implement  │          │        │          │
   │         │          │           branches───▶ write tests│       │          │
   │         │          │                       integrate──▶ verify │          │
   │         │          │                                    └─pass─▶ edge cases│
   │         │          │                                             └─pass───▶ open PR
 feedback ◀────────────────── merge/changes/edits ──────────────────────────────┘ → M3
```

## The `find_edge_cases` capability

The Critic in adversarial mode is also exposed directly as `find_edge_cases` ([Product A](../architecture/07-product-surfaces.md)).
It combines three sources:

1. **Enumeration** — boundary values, empty/null, overflow, unicode, concurrency.
2. **Property-based testing** — generate inputs, assert invariants hold.
3. **Production reality** — query the Behavioral Graph for the *unusual inputs prod has actually
   seen* on this path, so the edge cases are real, not hypothetical.

## Failure handling

| Failure | Handling |
|---|---|
| Ambiguous spec | Park on a human-clarification signal before writing any code |
| Branches conflict on integration | Architect re-sequences; integrate incrementally |
| Tests fail / Critic finds a break | Re-plan affected sub-component (bounded retries) → else escalate |
| Spec implies breaking a public API | Flag to human with the impacted callers (Code Graph) before proceeding |
| Budget exhausted | Open a draft PR with progress + a clear "remaining work" note |

## What requires human approval

Opening the PR is automatic (post Verifier+Critic), but **merging is always human**. Specs that
imply breaking changes, schema migrations, or new external dependencies trigger an explicit human
confirmation before implementation.

## Notes

- The "does it break the 14 callers / SLOs?" check is only possible because of the **Behavioral +
  Code graphs** — a generic coding agent can't see runtime blast radius.
- Cross-links: the bug-fix flow ([bugfix-e2e](./bugfix-e2e.md)) shares the same spine with a
  reproduce-first opening; CodeReview ([codereview-e2e](./codereview-e2e.md)) reviews the PR this
  workflow opens.

## Open questions / risks

- **Spec quality** — vague specs produce wrong features; the clarification loop is essential but
  adds latency.
- **Large features** — multi-week features should be decomposed into a plan like Migrator, not one
  workflow.
- **Convention conformance** — generated code must match team style (M3) or it generates review noise.
