# 12 — Anonymizer (the cross-wall gate)

The anonymizer is the **only** component permitted to move anything across the tenancy wall
([09](./09-tenancy-security.md)). It is the most legally fraught component in Forge: get it wrong
and an "abstract pattern" that is uniquely identifying becomes a customer-data breach. Skeleton:
[`../../src/security/anonymizer.ts`](../../src/security/anonymizer.ts).

> What crosses the wall is **statistical patterns, not customer facts.** "Across 500 codebases this
> React anti-pattern correlates with hydration bugs" ✅. "Customer A's `chargeCustomer` does X" ❌.

## Position

```
 ╔═══════════ TENANCY WALL ═══════════╗
 ║ per-customer substrate + prefs     ║
 ╚════════════════╤════════════════════╝
                  │  ONLY the anonymizer's output crosses
                  ▼
        extract → DP budget → k-anonymity → HUMAN REVIEW GATE → shared pattern library / M4
```

## The invariants (encoded in the skeleton)

1. **Explicit opt-in.** `extract()` refuses unless the tenant has consented. No opt-in, no extraction.
2. **Differential privacy budget.** Each extraction spends an `epsilon`; a per-tenant DP accountant
   caps cumulative spend so repeated queries can't reconstruct a record.
3. **k-anonymity floor.** A pattern needs support from at least `K_ANONYMITY_FLOOR` (=5) distinct
   tenants/observations before it is even a candidate. Below that it is dropped.
4. **Human review gate.** No pattern is published without a human reviewer signing off that it leaks
   no customer fact. `publish()` returns `{published:false}` until the gate passes.

These are checked in order; the skeleton fails closed at each step.

## What it produces

- **anti-pattern → bug correlations** (feed CodeReview's severity tuning),
- **incident playbooks** (feed OnCall),
- **migration old→new pairs** (feed Migrator-LM / M4, synthetic/aggregated only).

## The bright-line guarantee

Because the anonymizer is the sole crossing and it publishes only post-gate abstractions, the
answer to *"is our code in your training data?"* stays a demonstrable **no** — the audit log
([09](./09-tenancy-security.md)) records every extraction and publish decision.

## Open questions / risks

- **"Abstract but identifying"** — the hardest case; a pattern with k=5 can still fingerprint a
  tenant if the shape is rare. DP accounting + human review are the backstops, not a proof.
- **DP budget exhaustion** — once a tenant's epsilon is spent, extraction must stop; the cadence vs
  utility tradeoff needs tuning.
- **Reviewer load** — the human gate is a bottleneck; tooling must make "does this leak?" fast to
  judge without weakening the gate.
- **Consent revocation** — opt-out must retroactively bar future extraction and is recorded; already
  published abstractions are aggregate and not per-tenant deletable (state this in the contract).
