# End-to-End Workflow — CodeReview

**Trigger:** `pr.opened` / `pr.synchronize` webhook (GitHub/GitLab MCP, [L1](../architecture/01-ingestion-mcp.md)).
**SLA:** first comments within minutes of PR open.
**Skeleton:** [`../../src/workflows/codereview.workflow.ts`](../../src/workflows/codereview.workflow.ts).
**Engine:** durable workflow ([L6](../architecture/06-agent-orchestration.md)).

## Sequence

```
1.  pr.opened webhook ─▶ Product Surface (L7) ─▶ start codeReviewWorkflow{prId,repo,tenant}
2.  PLANNER decomposes: which dimensions to review, allocates budget
3.  RETRIEVAL ORCHESTRATOR (M2) pulls, in parallel:
      • the diff + touched files
      • touched functions + callers/callees      (Code Graph)
      • recent incidents in those files          (Behavioral Graph)
      • last PRs/RFCs touching them               (Decision Graph)
      • owner + review conventions               (Team Graph)
      • team preferences (rejected patterns, style) (M3 preference layer)
    ─▶ packs a 1M-token context window
4.  SPECIALISTS run in parallel over that context:
      • Reviewer    — conventions, readability, correctness
      • SecAuditor  — OWASP, secrets, injection, authz
      • PerfReviewer— N+1 queries, allocation patterns, hot paths
      • Architect   — does it match repo conventions / structure?
      • Tester      — coverage gaps, missing edge tests
5.  VERIFIER reruns: tests, type-check, lint, build (in the sandbox, L4)
6.  CRITIC adversarially challenges EACH finding (refute-by-default):
      a finding survives only if the Critic cannot show it's wrong/noise
7.  if VERIFIER ∧ CRITIC pass ─▶ EXECUTOR posts surviving findings as
      inline PR comments via git.pr.comment (L5)
8.  FEEDBACK: comment accepted / rejected / human-edited ─▶ M3 preference layer
```

## Swimlane

```
 Webhook   Planner   Retrieval   Specialists      Verifier   Critic    Executor
   │         │          │            │               │         │          │
 pr.opened─▶ │          │            │               │         │          │
   │      decompose─────▶ query 4 graphs + prefs     │         │          │
   │         │      ◀──── 1M-token context           │         │          │
   │         │  spawn ──▶ Reviewer/Sec/Perf/Arch/Test │         │          │
   │         │            └─ findings ──────────────▶ rerun tests/types    │
   │         │                                        └─pass──▶ refute each │
   │         │                                                  └─survivors─▶ post comments
   │         │                                                               └─▶ PR
 feedback ◀──────────────── accept/reject/edit ───────────────────────────────┘ → M3
```

## Failure handling

| Failure | Handling |
|---|---|
| Webhook missed | Periodic reconciliation sweep finds un-reviewed open PRs |
| Specialist times out | Retry with backoff; if exhausted, post partial review noting the gap |
| Verifier can't build (broken base) | Comment that the branch doesn't build; skip dynamic checks |
| Critic refutes everything | Post only high-confidence findings; log calibration signal |
| Tool/post failure | Idempotent retry (idempotency key = `pr:sha:commentHash`) — never double-post |

## What requires human approval

Nothing — CodeReview is **read + comment only**. It never writes code or merges. (Auto-fix
suggestions, if enabled, are posted as suggested diffs the human applies.) This makes CodeReview
the safest wedge product and the natural first install.

## Notes

- The **Critic gate** is what differentiates Forge from noisy linters: a finding is posted only if
  it survives an adversarial attempt to dismiss it, so signal-to-noise stays high.
- Every accepted/rejected comment trains the **per-customer preference layer** (M3,
  [08](../architecture/08-learning-architecture.md)) — the review gets sharper and quieter over
  time, learning this team's unspoken rules.

## Open questions / risks

- **Noise budget** — even with the Critic, too many comments erode trust; may need a per-PR cap.
- **Large PRs** — a 5,000-line PR may exceed even a 1M window; needs chunking + summarization.
- **Convention bootstrapping** — Day-1 reviews are generic until M3 learns the team; cold-start UX matters.
