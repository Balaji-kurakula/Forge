# 0001 — Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-06

## Context

Forge is a design-heavy project with many non-obvious choices (substrate over fine-tuning,
physical tenancy wall, durable orchestration). Without a record, the *why* is lost and choices get
relitigated.

## Decision

Keep ADRs in `docs/adr/` using a lightweight MADR format: Context, Decision, Consequences. Records
are immutable once accepted; a changed decision is a **new** ADR that supersedes the old one.

## Consequences

- New contributors can read the rationale, not just the result.
- The risk register ([../RISKS.md](../RISKS.md)) links to the ADR that resolves each open question.
- Small overhead per decision; worth it for a platform whose moat is architectural.
