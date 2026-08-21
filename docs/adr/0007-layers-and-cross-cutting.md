# 0007 — 7 layers + 3 cross-cutting concerns

- **Status:** Accepted
- **Date:** 2026-06

## Context

Early docs labeled Learning and Tenancy as "L8" and "L9" in one diagram while numbering their files
08/09/10 and calling them cross-cutting elsewhere. This was inconsistent and implied they sit in the
L1→L7 data-flow stack, which they do not.

## Decision

There are exactly **7 layers (L1–L7)** that data flows up through. **Learning, Tenancy & Security,
and the Data Model are cross-cutting concerns**, documented in files 08–10. The "L" prefix is
reserved for the seven layers. Component deep-dives (Retrieval Orchestrator, Anonymizer) are
documented in files 11–12 and are explicitly *not* layers.

## Consequences

- Removed the stray `L8/L9` labels from `ARCHITECTURE.md`; aligned the README conventions section.
- Diagrams render cross-cutting concerns beside the stack, not on top of it
  (see [../diagrams/README.md](../diagrams/README.md)).
