# 08 — Learning Architecture

"Learning" means four different things in Forge, and getting them right (and in the right order)
is what separates a real product from a demo. Most "AI for code" tools confuse these or skip the
first three and jump to fine-tuning. **The first three give you 90% of the value.**

```
┌────────────────────────────────────────────────────────────┐
│ M1: SUBSTRATE GROWTH      (always on, per-customer)         │
│ M2: IN-CONTEXT RETRIEVAL  (per-task, per-customer)          │
│ M3: PREFERENCE LEARNING   (per-customer, accumulating)      │
│ M4: MODEL FINE-TUNING     (rare, careful, optional)         │
└────────────────────────────────────────────────────────────┘
```

## The big picture (and the tenancy wall)

```
        ┌──────────────────────────────────────────────────────────┐
        │           CUSTOMER ENVIRONMENT (via MCP, scoped)          │
        │   GitHub · Datadog · Linear · Slack · Sentry · AWS · …    │
        └───────────────────────────┬──────────────────────────────┘
                                    │  ingest + CDC (→ 02)
                                    ▼
 ╔═══════════════════════════════ TENANCY WALL ═══════════════════════════════╗
 ║  PER-CUSTOMER ISOLATED STORE (own KMS keys, audit log)                      ║
 ║                                                                             ║
 ║  ┌────────── M1: SUBSTRATE ──────────┐   ┌──── M3: PREFERENCE LAYER ─────┐ ║
 ║  │ Code · Behavioral · Decision ·     │   │ style rules · conventions ·   │ ║
 ║  │ Team graphs (→ 03)                 │   │ severity weights · opt. LoRA  │ ║
 ║  └────────────────────────────────────┘   └───────────────────────────────┘ ║
 ╚═════════════════════════════════════════════════════════════════════════════╝
                                    │  ONLY anonymized patterns cross (DP + opt-in)
                                    ▼
        ┌──────────────────────────────────────────────────────────┐
        │  SHARED, SAFE LAYER                                        │
        │  Pattern library (anti-pattern→bug correlations,           │
        │  incident playbooks, migration-pair corpora)               │
        │  M4: small fine-tunes — Migrator-LM, Reviewer-LM, Critic-LM │
        │  + frontier model API (zero-retention agreement)           │
        └──────────────────────────────────────────────────────────┘
```

Everything **left of the wall** is per-customer. Only **anonymized abstractions** cross to the
right. See [09 Tenancy & Security](./09-tenancy-security.md) for how the wall is enforced.

---

## M1 — Substrate Growth (*the main thing*)

Every interaction makes the four graphs ([03](./03-reasoning-substrate.md)) richer:

- every PR adds Code Graph nodes/edges + a Decision Graph entry,
- every incident adds to the Behavioral Graph and links to the code that caused it,
- every Slack thread / postmortem / RFC is embedded and linked,
- every review comment teaches *what this team considers a problem*.

This is **not** model learning — it's **knowledge accumulation in a structured store** the model
reads at inference time. After six months, the agent has a model of the system that no human on
the team has, because no human read every PR, thread, incident, and line of code. **This is the
moat** — and it's the boring answer most people don't want, because they want fine-tuning to be
the moat. It isn't.

## M2 — In-Context Retrieval (*how it uses what it learned*)

When an agent gets a task it doesn't ask the model "do you know our codebase?" — it **retrieves**
the right slice and packs it into the context window.

**Worked example — "fix the flaky test in `checkout_test.go`":**
1. Retrieve: the test file; the function under test; the last 5 PRs touching it; the 3 most
   recent incidents in checkout; the team's testing-conventions doc; two similar flaky tests
   fixed in the past *with their PRs*.
2. Pack all of that into a **1M-token context window**.
3. Reason over it.

The model doesn't *know* your codebase — it reads exactly the right slice for every task. This is
where 1M context + the substrate combine into something new.

**Why M2 beats fine-tuning for most cases:** retrieved context is **fresh** (your code from 5
minutes ago), **updateable** (no retraining), and **auditable** (you can see exactly what the
agent looked at). The Retrieval Orchestrator that does this is part of L6
([06](./06-agent-orchestration.md)).

## M3 — Preference Learning (*the per-customer personality*)

This is where the system genuinely *adapts to your team*:

- reviewer feedback → signal: "the team rejected 8 PRs suggesting `lodash`; stop suggesting it";
- resolved incidents → which patterns matter: "forgetting context cancellation causes goroutine
  leaks here — flag aggressively";
- accepted vs rejected suggestions → ranking: "this team values test coverage over micro-perf";
- style: "this team uses early-return, not nested if-else".

Implemented as a **per-customer preference layer**:
- **structured rules** learned from feedback (deterministic, instantly updatable),
- **few-shot examples** retrieved into prompts (cheap, fast),
- **optional small LoRA** trained on the customer's accepted PRs (big customers only; weeks to be
  worth it).

After a few months the agent behaves like a senior engineer *on that specific team*.

## M4 — Model Fine-Tuning (*rarely the right answer*)

For ~95% of customers you don't fine-tune; M1–M3 win. Fine-tuning is worth it when:

- **Migrator** — a Java-8→17 model trained on millions of real migration pairs (cross-customer,
  synthetic/opt-in) genuinely beats a prompted model;
- **Domain languages** — COBOL or a proprietary DSL benefits from a small fine-tune;
- **Latency-critical loops** — a small fine-tuned model is ~10x cheaper for autocomplete-style use.

**Almost never fine-tune on a single customer's code** — overfitting, leakage risk, and constant
retraining as code evolves. Substrate + retrieval is more flexible and more defensible.

## Does it learn *across* customers?

The most important question — the answer determines whether you're a product or a liability.

- **Default: No.** Customer A's code, decisions, incidents, and preferences are siloed. Crypto
  isolation, audit logs, data residency. See [09](./09-tenancy-security.md).
- **Carefully: Yes — only on safe abstractions** *above* their code:
  - "across 500 codebases, this React anti-pattern correlates with hydration bugs" ✅
  - "across 200 incidents, alerts mentioning 'connection pool' resolve 4x faster if you check DB
    metrics first" ✅
  - "Customer A's `chargeCustomer` has these issues…" ❌ never leaves Customer A
  - synthetic/aggregated training data with differential-privacy guarantees ✅ (explicit opt-in).

Cross-customer learning is **statistical patterns**, not customer facts. Get this wrong and you
have a company-ending data-leak incident.

## The four data flows that close the loop

1. **Ingest → Substrate** (continuous, per-customer) — CDC writes the four graphs (M1).
2. **Task → Retrieval → Context** (per-invocation) — Retrieval Orchestrator fuses M1+M2+M3 into
   the 1M-token window.
3. **Action → Feedback → Preference Layer** (closes the loop) — PR merged/reverted, alert
   ack'd right/wrong, human edits → labeled examples in the customer's preference layer (M3).
4. **Pattern extraction → Shared layer** (carefully) — an anonymizer pulls *abstract* patterns
   across the wall, with consent + DP, into the shared pattern library and M4 training sets.

## Maturation timeline (a customer's POV)

| When | What the agent can do |
|---|---|
| **Day 1** | Competent but generic; substrate still building. Simple bugs, basic reviews. |
| **Week 2** | Code Graph complete — traces deps, refactors touch the right callsites, knows owners. |
| **Month 2** | Decision Graph caught up — answers "why does this exist", stops re-suggesting rejected ideas. |
| **Month 6** | Behavioral Graph rich — correlates code to prod behavior, catches incident-causing patterns pre-merge. |
| **Year 1** | Preference layer dialed in — PRs read like a senior engineer on the team; new hires onboard through it. |
| **Year 2** | Knows the codebase better than anyone on the team — switching cost is existential. |

*Getting demonstrably more useful every month with no effort from the customer* is the only
marketing pitch you need.

## Open questions / risks

- **Anonymization rigor** — the line between "safe abstract pattern" and "leaked customer fact" is
  subtle; the anonymizer is the most legally fraught component ([09](./09-tenancy-security.md)).
- **Preference-layer drift** — learned rules can ossify or contradict; needs decay + conflict
  resolution.
- **LoRA staleness** — a per-customer adapter goes stale as code evolves; retraining cadence vs
  cost tradeoff.
- **Cold-start value** — Day-1 usefulness must be high enough to retain customers through the
  weeks before the substrate matures.
