## What this changes

<!-- One or two sentences. Link the issue if there is one: Closes #123 -->

## Why

<!-- The problem being solved. If it's non-obvious, it probably needs an ADR in docs/adr/. -->

## Checks

All four must pass locally — CI runs the same four:

- [ ] `pnpm typecheck`
- [ ] `pnpm check`
- [ ] `pnpm test`
- [ ] `pnpm demo`

## Invariants

- [ ] No new role has `canWrite: true` ([ADR-0005](docs/adr/0005-executor-only-write-gate.md) —
      only the Executor writes, only after Verifier ∧ Critic).
- [ ] No per-tenant data crosses the tenancy wall except through the anonymizer
      ([ADR-0006](docs/adr/0006-physical-tenancy-wall.md)).
- [ ] Workflows call side effects through an injected activity, never directly
      ([ADR-0003](docs/adr/0003-activities-injection-seam.md)).

## Housekeeping

- [ ] Schema change? `infra/init/` **and** `src/substrate/in-memory.ts` are both updated.
- [ ] Non-obvious decision? An ADR is added to `docs/adr/`.
- [ ] `docs/progress.md` reflects the new state (status matrix + changelog entry).
