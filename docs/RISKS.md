# Risk register

Consolidates the "Open questions / risks" from every architecture and workflow doc into one place,
each with a chosen mitigation and status. `Open` = acknowledged, not yet designed away. `Mitigated`
= a concrete approach is decided (often in an ADR). `Accepted` = a standing risk we run with.

## Substrate & indexing (L2/L3)

| # | Risk | Mitigation | Status |
|---|---|---|---|
| R1 | Freshness at 50M LOC / 1000 commits/day with sub-second queries | Incremental tree-sitter re-parse of touched files only; per-path sub-partitioning; materialized hot-context cache | Open |
| R2 | Cross-store consistency (no txn spans Neo4j+Timescale+PG) | Outbox + reconciliation; tolerate dangling cross-graph refs; idempotent upserts ([ADR-0004](./adr/0004-polyglot-substrate-nodeid.md)) | Mitigated |
| R3 | Hot partitions on a monorepo | Sub-partition by path subtree | Open |
| R4 | Embedding cost & dimensionality lock-in | Bounded re-embed on change; treat model swap as a corpus migration | Accepted |
| R5 | Stable-key collisions / rename tracking | Content-addressed `stableKey` + `alias_of` edges | Mitigated |
| R6 | Linkage accuracy (does this thread refer to this PR?) | Entity-resolution confidence scores; surface low-confidence links | Open |

## Sandbox (L4)

| # | Risk | Mitigation | Status |
|---|---|---|---|
| R7 | Sandbox compute dominates COGS | CoW clones, base-image caching, snapshot/restore, warm pools, per-task budgets | Mitigated |
| R8 | Prod replicas never perfectly match prod | Shadow-diff over real replayed inputs; document residual gap | Accepted |
| R9 | Egress exfiltration via a compromised dep | Per-tenant egress allowlist (MCPs only); secret-scan retrieved content | Mitigated |
| R10 | Long-running migration ties up a VM | Checkpoint/restore tied to durable orchestration | Open |

## Tool layer & orchestration (L5/L6)

| # | Risk | Mitigation | Status |
|---|---|---|---|
| R11 | Policy too permissive (damage) or too strict (ships nothing) | Per-tenant autonomy ladder; fail-closed policy engine ([ADR-0005](./adr/0005-executor-only-write-gate.md)) | Mitigated |
| R12 | Approval fatigue | Calibrate safe-by-default; only `cloud.*` needs approval | Open |
| R13 | `cloud.exec` is a loaded gun | Prefer a constrained command grammar over free-form exec | Open |
| R14 | Audit completeness (one unlogged write = compliance failure) | All writes route through L5; immutable per-tenant log | Mitigated |
| R15 | Critic calibration (false refutes vs misses) | Measure against real merge/revert outcomes; per-tenant tuning | Open |
| R16 | LLM nondeterminism vs deterministic replay | Wrap model calls as activities; record results for replay ([ADR-0003](./adr/0003-activities-injection-seam.md)) | Mitigated |

## Learning & tenancy (08/09/12)

| # | Risk | Mitigation | Status |
|---|---|---|---|
| R17 | Anonymizer leakage ("abstract but identifying") | Opt-in → DP budget → k≥5 → human gate, fail-closed ([ADR-0006](./adr/0006-physical-tenancy-wall.md)) | Mitigated |
| R18 | Shared-compute context bleed | Per-customer context isolation; single-tenant inference for top tier | Open |
| R19 | Preference-layer drift / contradiction | Weight decay + conflict resolution | Open |
| R20 | Cold-start value before substrate matures | High Day-1 generic competence; clear maturation messaging | Accepted |

## Product surfaces (L7) & retrieval (11)

| # | Risk | Mitigation | Status |
|---|---|---|---|
| R21 | Review noise erodes trust | Critic gate + per-PR cap; M3 quiets over time | Mitigated |
| R22 | Large PRs / huge blast radius exceed 1M window | Hierarchical summarization, not truncation; log what was dropped | Open |
| R23 | Missed webhooks → missed reviews/incidents | Periodic reconciliation sweep | Mitigated |
| R24 | SLA variance (minutes review vs months migration) on one engine | Scheduling that prevents big jobs starving interactive ones | Open |
| R25 | Retrieval packing/ranking calibration | Diversity-aware packing; snapshot pinned for replay ([ADR-0004](./adr/0004-polyglot-substrate-nodeid.md)) | Open |

## Business / strategic

| # | Risk | Mitigation | Status |
|---|---|---|---|
| R26 | Frontier-lab vertical integration | Model-agnostic; own the data layer | Accepted |
| R27 | Sales-motion mismatch (bottoms-up + $10M deals) | Product A wedge → Product B upsell | Accepted |
