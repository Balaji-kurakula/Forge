# 06 — Agent Orchestration (L6)

L6 is the spine of Forge. It takes a task from a product surface ([07](./07-product-surfaces.md)),
decomposes it, runs specialists, and ships a result — but only after an independent verifier and
an adversarial critic both pass. The skeletons in [`../../src/workflows`](../../src/workflows)
and [`../../src/agents`](../../src/agents) implement the shape described here.

## The five canonical roles

```
   task
    │
    ▼
 ┌─────────┐     spawns      ┌──────────────────────────────────────────┐
 │ PLANNER │────────────────▶│ SPECIALISTS (parallel)                    │
 └─────────┘                 │  Coder · Reviewer · Tester · Debugger ·    │
    │ decompose              │  Architect · SecAuditor                    │
    │                        └───────────────────┬──────────────────────┘
    │                                            │ proposed work
    │                                            ▼
    │                                      ┌────────────┐
    │                                      │  VERIFIER  │ runs tests/lints/types,
    │                                      └─────┬──────┘ simulates, checks claims
    │                                            │ pass?
    │                                            ▼
    │                                      ┌────────────┐
    │                                      │  CRITIC    │ adversarial: tries to break it,
    │                                      └─────┬──────┘ refute-by-default
    │                          BOTH pass ────────┤
    │                                            ▼
    │                                      ┌────────────┐
    └─────────────────────────────────────▶│  EXECUTOR  │ the ONLY role allowed to
                                           └────────────┘ call write-tools (L5)
```

| Role | Responsibility | May write? |
|---|---|---|
| **Planner** | Receives the task, decomposes it, decides which specialists to spawn and in what shape | no |
| **Coder** | Implements code changes | no (proposes; Executor commits) |
| **Reviewer** | Checks against repo conventions, readability, correctness | no |
| **Tester** | Writes/extends tests, finds coverage gaps | no |
| **Debugger** | Reproduces issues, pulls logs/traces, localizes root cause | no |
| **Architect** | Decomposes features, checks design fit against the Code Graph | no |
| **SecAuditor** | OWASP, secrets, injection, authz issues | no |
| **Verifier** | Runs the work against tests/lints/types; simulates incidents | no |
| **Critic** | Adversarially tries to break the proposed solution | no |
| **Executor** | Performs the actual side effects (open PR, post comment, roll back) | **yes** |

### The critical rule

> **The Verifier AND the Critic must both pass before the Executor acts.**

This is the human-replacement mechanism — the system is its own code review. The Critic runs in
**refute-by-default** mode: a finding or a fix survives only if the Critic *cannot* break it.
This is what keeps plausible-but-wrong work from shipping.

## The Retrieval Orchestrator hand-off

When the Planner starts a task it asks the **Retrieval Orchestrator** (M2 in
[08 Learning](./08-learning-architecture.md)) for everything relevant: it queries all four
graphs ([03](./03-reasoning-substrate.md)) plus the per-tenant preference layer (M3) and the
shared pattern library, ranks the results, and packs a **1M-token context window**. Specialists
reason over that retrieved slice rather than over a model that "knows" the codebase.

## The durable workflow engine

Orchestration runs on a **Temporal-style durable workflow engine** because real tasks are long:
a CodeReview is minutes, an incident is minutes-to-hours, a **migration is months**.

- **Durability** — workflow state is persisted; a process crash, deploy, or VM teardown does
  not lose progress. The workflow resumes from its last checkpoint.
- **Determinism** — workflow code is deterministic; all side effects go through **activities**
  ([../../src/activities](../../src/activities)) so they can be retried and replayed.
- **Retries & timeouts** — every activity (run tests, query obs, call a model) has retry and
  timeout policy; transient failures self-heal.
- **Human-in-the-loop signals** — the workflow can *wait* for a human approval signal (e.g.
  OnCall's one-click approve) without holding a thread; it parks and resumes on the signal.
- **Checkpointing & continueAsNew** — long workflows (migrations) checkpoint per module and use
  `continueAsNew` to keep history bounded over a multi-week run.
- **Versioning** — workflows can be safely upgraded mid-flight via versioned branches.

## State machine (per task)

```
 PLANNING ─▶ RETRIEVING ─▶ SPECIALISTS_RUNNING ─▶ VERIFYING ─┬─pass─▶ CRITIQUING ─┬─pass─▶ EXECUTING ─▶ DONE
                                                  │           │                   │
                                          fail──▶ REPLAN ◀────┘            fail──▶ REPLAN
                                                  │ (bounded retries)               │
                                                  └──────────── exhausted ──▶ ESCALATE_TO_HUMAN
            (any step) ── needs approval ──▶ AWAITING_APPROVAL ──signal──▶ (resume)
```

Failures don't silently drop: exhausted retries **escalate to a human** with full context.

## Concurrency, fan-out & budgets

- **Specialist fan-out** is bounded per task (a Planner can't spawn unbounded agents).
- **Token + compute budget** per task; the Planner allocates it and the engine enforces a hard
  ceiling, killing runaway loops.
- **Sandbox slots** ([04](./04-execution-sandbox.md)) are pooled per tenant; tasks queue when
  the pool is saturated.

## Open questions / risks

- **Critic calibration** — too aggressive and nothing ships (false refutes); too lax and bugs
  slip through. Needs per-tenant tuning and measurement against real merge/revert outcomes.
- **Determinism vs LLM nondeterminism** — model calls are nondeterministic; they must be wrapped
  as activities whose *results* are recorded so replay is deterministic.
- **Long-horizon cost** — a months-long migration accrues cost across thousands of activities;
  needs careful budgeting and progress-based billing.
- **Escalation UX** — when the system escalates to a human, it must hand over enough context that
  the human isn't starting from zero.
