# 0006 — The tenancy wall is physical; the anonymizer is the only crossing

- **Status:** Accepted
- **Date:** 2026-06
- **Ratifies:** [09 Tenancy & Security](../architecture/09-tenancy-security.md), [12 Anonymizer](../architecture/12-anonymizer.md)

## Context

One customer's code leaking into another's output — or into training data — is a company-ending
event. "We have a policy against it" is not enough.

## Decision

The wall is **physical, not policy**: per-customer stores and per-customer KMS keys; Forge cannot
decrypt one tenant's data while serving another. The **only** thing that crosses is the output of
the [Anonymizer](../../src/security/anonymizer.ts), which publishes abstract patterns under, in
order: explicit opt-in → DP budget → k-anonymity floor (k≥5) → a human review gate. It fails closed
at each step.

## Consequences

- The bright-line guarantee — *"is our code in your training data?" → demonstrable no* — is an
  engineering invariant backed by audit logs, not a promise.
- F500/regulated tenants get full single-tenant in-VPC deployment (incl. the LLM).
- The anonymizer is the most scrutinized component; "abstract but identifying" is its hardest
  failure mode (tracked in [RISKS](../RISKS.md)).
- Cross-customer learning is statistical patterns only — never customer facts.
