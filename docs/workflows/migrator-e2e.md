# End-to-End Workflow — Migrator

**Trigger:** a long-running migration engagement (C-suite-initiated): "migrate `payments` from
Java 8 → 17", "Python 2 → 3", "AngularJS → React", "COBOL → Java".
**SLA:** weeks to months — **durable, resumable, progress-tracked**.
**Skeleton:** [`../../src/workflows/migrator.workflow.ts`](../../src/workflows/migrator.workflow.ts).
**Engine:** durable workflow with child workflows + `continueAsNew` ([L6](../architecture/06-agent-orchestration.md)).
**Relies on:** shadow-mode diffing in the [sandbox (L4)](../architecture/04-execution-sandbox.md).

## Two-level structure

```
 migratorWorkflow (parent, runs for weeks)
   │
   ├─ 1. SCOPE      Architect builds a module-by-module plan against the Code Graph
   │                (dependency order: leaf modules first)
   │
   ├─ 2. PER MODULE — child workflow migrateModuleWorkflow (pipelined, not lockstep):
   │        module A can be in shadow-diff while module B is still being rewritten
   │
   └─ 3. continueAsNew periodically to keep workflow history bounded over the long run
```

## Per-module sequence (`migrateModuleWorkflow`)

```
 a. CHARACTERIZE  Tester writes characterization tests that LOCK current behavior FIRST
                  (you cannot migrate safely without pinning what "correct" means today)
 b. REWRITE       Coder rewrites the module to target idioms
                  (uses Migrator-LM — the M4 fine-tune trained on cross-customer
                   old→new pairs; see ../architecture/08-learning-architecture.md)
 c. SHADOW-DIFF   run OLD and NEW side by side in the sandbox, replay 10,000 real
                  prod inputs, diff outputs:
                       input set ─┬─▶ OLD ─▶ out_old ─┐
                                  └─▶ NEW ─▶ out_new ─┴─▶ diff
 d. VERIFY        characterization tests pass on NEW; zero meaningful output divergence
 e. CRITIC        adversarial: edge inputs, locale/timezone, numeric precision, error paths
 f. if VERIFIER ∧ CRITIC pass ─▶ EXECUTOR opens a PR for this module (git.pr.open)
 g. on merge ─▶ next dependent modules unblock; anonymized old→new pairs feed the
                cross-customer migration corpus (M4, opt-in)
```

## Per-module state machine

```
 PLANNED ─▶ CHARACTERIZING ─▶ REWRITING ─▶ SHADOW_DIFF ─┬─clean─▶ VERIFY+CRITIC ─┬─pass─▶ PR_OPEN ─▶ MERGED
                                    ▲                    │                        │
                                    └──── divergences ───┘                 fail──▶ REWRITE (bounded)
                                          (Critic localizes, Coder fixes)             │
                                                                            exhausted─▶ ESCALATE_TO_HUMAN
```

## Durability (why this needs a durable engine)

- A 3-month migration **must survive** process restarts, deploys, and sandbox teardowns —
  per-module progress is checkpointed; a crash resumes from the last completed module.
- `continueAsNew` keeps the parent workflow's event history bounded across thousands of activities.
- **Progress is queryable** at any time: modules done / in-flight / blocked, % complete, ETA.
- Human handoffs (a tricky module escalated to an engineer) park the child workflow on a signal
  and resume when resolved — without losing the rest of the in-flight migration.

## Failure handling

| Failure | Handling |
|---|---|
| Shadow-diff divergence | Critic localizes the divergent input class; Coder fixes; re-diff (bounded retries) |
| Characterization tests flaky | Stabilize/quarantine before migrating; never migrate against a flaky baseline |
| Module too hard | Escalate to a human with the diff + failing inputs; rest of migration continues |
| Dependency cycle in plan | Architect re-plans; break the cycle with an adapter/shim module |
| Merge conflict (codebase moved under us) | Rebase the module onto latest base SHA, re-diff |

## Rollback strategy

Each module is its own PR, merged behind a flag where possible, so any module can be reverted
independently without unwinding the whole migration. Shadow-mode means divergences are caught
**before** merge, not in production.

## Notes

- **Behavior-preservation is the whole game.** The characterization-tests-first + shadow-diff
  loop is what makes "migrate this service" safe rather than a 9-figure leap of faith — and it's
  why Forge can charge 30% of an Accenture engagement and still win.
- Every migration enriches the cross-customer **migration-pair corpus** (anonymized, opt-in),
  which makes Migrator-LM better for the next customer — the data flywheel
  ([08](../architecture/08-learning-architecture.md)).

## Open questions / risks

- **Faithful prod-input replay** — the 10K replay set must represent real traffic; gaps mean
  missed divergences. Sourcing and refreshing it is hard.
- **Stateful modules** — code touching external state (DB, queues) is harder to shadow-diff purely.
- **Long-horizon cost** — months of sandbox + model calls; needs progress-based billing and tight budgets.
- **Plan drift** — the codebase keeps changing during a months-long migration; the plan must adapt continuously.
