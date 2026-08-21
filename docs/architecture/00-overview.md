# 00 — Overview & Design Principles

## The one-paragraph thesis

Every Forge product runs on the **same substrate**: a deep, persistent, per-customer
understanding of *the codebase, the running system, and how the team actually works*.
Build that substrate once, and every additional product — CodeReview, OnCall, Migrator,
and later TestGen, Refactor, Docs — is a 10x-cheaper feature, not a new company. You stop
selling seats and start selling **engineering capacity**. That is the reframe that turns a
billion-dollar code tool into a platform that owns *how software gets built*.

## Why the three products stack (and most "AI for X" combos don't)

They share one substrate, and they **feed** each other:

```
   CodeReview  ── sees every PR ──▶ learns repo conventions, ownership, intent
        │                                          │
   OnCall      ── sees every incident ─▶ learns runtime behavior, failure modes
        │                                          │
   Migrator    ── rewrites legacy code ─▶ generates the largest corpus of
        │                                  "old pattern → modern pattern" pairs
        └────────── all three enrich the substrate ──────────┘
```

- **CodeReview gets sharper** because OnCall has seen which patterns *actually* cause
  production incidents — so it stops nitpicking style and starts catching real bugs.
- **OnCall gets sharper** because CodeReview has seen every recent change and can say
  "this incident correlates with PR #4471 merged 20 minutes ago."
- **Migrator gets sharper** because the other two have built ground truth on *what good
  code looks like in this org*.

No point solution can match this: a PR reviewer never sees incidents; an observability
vendor never sees code intent; a consulting firm has no production feedback loop.

## The 7-layer stack

```
┌─────────────────────────────────────────────────────────────────────┐
│  L7  PRODUCT SURFACES   CodeReview · OnCall · Migrator · TestGen · …  │ → 07
├─────────────────────────────────────────────────────────────────────┤
│  L6  AGENT ORCHESTRATION   Planner→Specialists→Verifier→Critic→Exec   │ → 06
├─────────────────────────────────────────────────────────────────────┤
│  L5  TOOL LAYER (internal, typed)   code.* tests.* git.* obs.* …      │ → 05
├─────────────────────────────────────────────────────────────────────┤
│  L4  EXECUTION SANDBOX   per-customer ephemeral microVMs              │ → 04
├─────────────────────────────────────────────────────────────────────┤
│  L3  REASONING SUBSTRATE ◀ the moat                                   │ → 03
│      Code Graph · Behavioral Graph · Decision Graph · Team Graph      │
├─────────────────────────────────────────────────────────────────────┤
│  L2  INDEXING & CDC   streaming · AST re-parse · embeddings           │ → 02
├─────────────────────────────────────────────────────────────────────┤
│  L1  INGESTION (MCP)   GitHub · Datadog · Sentry · Linear · Slack …   │ → 01
└─────────────────────────────────────────────────────────────────────┘
     cross-cutting:  Learning (→ 08)   ·   Tenancy & Security (→ 09)
                     Data Model (→ 10)
```

## Core design principles

1. **Substrate-first.** The moat is the four-graph substrate ([03](./03-reasoning-substrate.md)),
   not the model. Models are the interchangeable engine; the substrate is the fuel, and the
   fuel is the customer's alone.
2. **Learning lives *around* the model, not *inside* it.** Knowledge accumulates in the
   substrate and a per-customer preference layer — hot-updatable, fresh, and auditable —
   rather than baked into weights. See [08](./08-learning-architecture.md).
3. **The Verifier + Critic gate.** Nothing is shipped until an independent Verifier (does
   it pass tests/types/lints?) *and* an adversarial Critic (can I break it?) both pass. This
   gate is the mechanism that lets an agent replace a human reviewer. See [06](./06-agent-orchestration.md).
4. **The tenancy wall is physical, not policy.** Per-customer data is isolated by separate
   stores and keys; only anonymized abstractions cross into the shared layer. "Is our code
   in your training data?" must be a demonstrable *no*. See [09](./09-tenancy-security.md).
5. **Durable, long-horizon orchestration.** A migration is a 3-month task. The workflow
   engine survives restarts, upgrades, partial failures, and human handoffs.
6. **Model-agnostic.** Own the substrate, not the model. Swap frontier models freely;
   build switching cost at the *data* layer so a frontier lab can't vertically integrate you away.

## Product A vs Product B

| | Product A — `engineer-mcp` | Product B — the substrate |
|---|---|---|
| Shape | A pluggable MCP server any IDE/CI calls | An always-on per-customer platform |
| Value | Point-in-time tasks (fix a bug, review a PR) | Deep tasks requiring history + production context |
| Role | The **wedge / trojan horse** — value in minutes | The **business** — value compounds monthly |
| Sequencing | Ship first; viral, free-tier, bottoms-up | Upsell once a team has 5+ devs on Product A |

The MCP is the trojan horse; the substrate is the business.

## Expansion waves (the real story)

| Wave | Product | Replaces | Approx. TAM |
|------|---------|----------|-------------|
| 1 | CodeReview | Senior eng review time | $30B |
| 1 | OnCall | PagerDuty + SRE labor | $50B |
| 1 | Migrator | Accenture / TCS modernization | $200B |
| 2 | TestGen | QA orgs, manual testing | $40B |
| 2 | Refactor | Tech-debt sprints | unbounded |
| 2 | Docs | Confluence + tribal knowledge | $10B |
| 3 | Architect | Staff/principal time | massive |
| 3 | Planning | "What can we ship by Q3?" | the prize |
| 4 | Autonomous engineering | Entire engineering orgs | civilization-scale |

By Wave 3 you sell features-shipped-per-quarter, not seats. That is a different pricing
curve — and where the trillion comes from.

## How to read the rest of `docs/architecture/`

Read top-to-bottom (L1 → L7) to follow data as it flows up from raw connectors to a shipped
PR: [01](./01-ingestion-mcp.md) → [02](./02-indexing-cdc.md) → [03](./03-reasoning-substrate.md)
→ [04](./04-execution-sandbox.md) → [05](./05-tool-layer.md) → [06](./06-agent-orchestration.md)
→ [07](./07-product-surfaces.md). Then the cross-cutting concerns:
[08 Learning](./08-learning-architecture.md), [09 Tenancy & Security](./09-tenancy-security.md),
[10 Data Model](./10-data-model.md). Concrete task flows are in
[`../workflows/`](../workflows/).

## Open questions / risks

- **Substrate freshness at scale** (50M LOC, 1000 commits/day, sub-second queries) is a
  Google-Search-class systems problem and the most likely place to fail silently.
- **Sandbox economics** — ephemeral VMs with prod replicas per invocation are expensive;
  the business depends on caching/snapshotting bringing unit cost down.
- **Sales-motion mismatch** — this is simultaneously bottoms-up (devs love Product A) and
  top-down ($10M Migrator deals). Few teams execute both.
- **Frontier-lab vertical integration** — mitigated by being model-agnostic and owning the
  data layer, but a standing strategic risk.
