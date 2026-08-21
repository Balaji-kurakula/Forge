# 0005 — Executor-only writes behind the Verifier∧Critic gate

- **Status:** Accepted
- **Date:** 2026-06
- **Ratifies:** [06 Agent Orchestration](../architecture/06-agent-orchestration.md), [05 Tool Layer](../architecture/05-tool-layer.md)

## Context

An autonomous agent that can write (open PRs, roll back prod) is only safe if a wrong or
injected action cannot reach a side effect. This is the mechanism that lets Forge replace a human
reviewer rather than just assist one.

## Decision

Two invariants, enforced in code:

1. **Only the Executor role may invoke write-capable tools.** All specialists *propose*; the
   Executor *acts*. Guarded by `assertMayWrite` in [`src/agents/roles.ts`](../../src/agents/roles.ts).
2. **A write runs only after BOTH the Verifier and the Critic pass.** The Critic runs
   refute-by-default. High-risk writes (`cloud.*`) additionally require human approval unless the
   tenant opted into an autonomous envelope.

Both are encoded in the deterministic [`DefaultPolicyEngine`](../../src/policy/policy-engine.ts)
and covered by tests (`tests/roles.test.ts`, `tests/policy-engine.test.ts`).

## Consequences

- A prompt-injected "exfiltrate secrets" instruction cannot directly cause a write — it would have
  to pass an independent Verifier and an adversarial Critic, and (for infra) a human.
- The policy engine fails **closed**: unclassified tools are denied.
- Critic calibration becomes a first-class tuning problem (too strict → nothing ships); tracked in
  [RISKS](../RISKS.md).
