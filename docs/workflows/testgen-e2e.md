# End-to-End Workflow — TestGen

**Trigger:** `engineer-mcp` `suggest_tests(repo, path)` ([Product A](../architecture/07-product-surfaces.md)).
**SLA:** interactive-to-minutes.
**Skeleton:** [`../../src/workflows/testgen.workflow.ts`](../../src/workflows/testgen.workflow.ts).
**Engine:** durable workflow ([L6](../architecture/06-agent-orchestration.md)).

## Sequence

```
1.  suggest_tests(repo, path) ─▶ start testGenWorkflow{path,repo,tenant}; returns taskId
2.  RETRIEVAL ORCHESTRATOR (M2) pulls the file, its callers/callees, and coverage gaps
3.  TESTER proposes unit + edge tests targeting the uncovered branches
4.  VERIFIER runs the proposed tests in the sandbox (L4): they must compile and pass
5.  CRITIC checks the tests actually assert behavior (not vacuous), refute-by-default
6.  if VERIFIER ∧ CRITIC pass ─▶ EXECUTOR opens a PR with the new tests (git.pr.open)
7.  FEEDBACK: merged / changes-requested ─▶ M3 preference layer
```

## What requires human approval

PR open is automatic post-gate; **merge is always human**.

## Notes

- Coverage gaps are ranked by the Behavioral Graph: paths that prod actually exercises (and that
  have caused incidents) are prioritized over dead branches.
- Shares the spine with [feature-build](./feature-build-e2e.md); the difference is the Tester leads.

## Open questions / risks

- **Vacuous tests** — generated tests that pass without asserting anything; the Critic's job is to
  reject these.
- **Flaky generation** — tests touching time/IO must be stabilized or quarantined before proposal.
