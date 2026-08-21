# 09 — Tenancy & Security

The **tenancy wall** is the most important architectural decision in Forge. Get it wrong once —
one customer's code leaking into another's outputs or into training data — and the company is
over. So the wall is **physical** (separate stores, separate keys), not merely policy.

## The wall

```
 ╔══════════════════════════ TENANCY WALL ══════════════════════════╗
 ║  PER-CUSTOMER  (everything below is isolated, customer-keyed)     ║
 ║  • the four-graph substrate (→ 03)                                ║
 ║  • the preference layer (M3, → 08)                                ║
 ║  • the execution sandbox (→ 04)                                   ║
 ║  • the retrieval orchestrator (stateless, customer-scoped)        ║
 ║  • ingestion + CDC (→ 01, 02)                                     ║
 ║  • connector credentials (scoped MCP tokens)                      ║
 ╚═══════════════════════════════════════════════════════════════════╝
            │ ONLY anonymized abstract patterns cross (DP + opt-in)
            ▼
 ┌───────────────────────── SHARED, SAFE ──────────────────────────┐
 │  • pattern library (anonymized correlations, playbooks, corpora) │
 │  • fine-tuned models (trained on synthetic/opt-in data only)     │
 │  • frontier model API (zero-retention agreement)                 │
 └──────────────────────────────────────────────────────────────────┘
```

## What runs where

| Component | Deployment |
|---|---|
| Ingestion / CDC | Per-customer VPC, or Forge cloud in a customer-isolated namespace |
| Substrate (4 graphs) | Per-customer DB cluster, customer-owned KMS key |
| Preference layer (M3) | Per-customer |
| Execution sandbox (L4) | Per-customer, ephemeral microVMs, egress to that tenant's MCPs only |
| Retrieval orchestrator | Per-customer, stateless |
| Agents (LLM calls) | Shared compute, **per-customer context isolation** |
| Pattern library | Shared, **anonymized only** |
| Fine-tuned models | Shared, trained on **safe data only** (synthetic/opt-in/aggregated) |
| Frontier model | API to Anthropic/OpenAI with a **zero-retention** agreement |

For **F500 / regulated** customers: full **single-tenant** deployment, including the LLM calls
(a Claude/Llama deployed inside the customer VPC) so no data leaves their boundary at all.

## The bright-line guarantee

> If a customer asks *"is any of our code in your training data?"* the answer must be a clean,
> demonstrable **no.**

The architecture enforces this physically: separate stores, separate keys, and audit logs that
**prove** no read crossed the wall. This is a contractual and engineering invariant, not a promise.

## Key & data protection

- **Per-customer KMS keys** — each tenant's substrate and preference layer are encrypted at rest
  with their own key; Forge cannot decrypt one tenant's data while serving another.
- **Encryption in transit** everywhere (mTLS between services, TLS to connectors).
- **Connector credentials** ([01](./01-ingestion-mcp.md)) are least-privilege, short-lived, and
  stored per-tenant; revocation propagates in seconds.
- **Audit logs** — every L5 tool call ([05](./05-tool-layer.md)) and every substrate read is
  recorded immutably per tenant. The log is the evidence that the wall held.

## The policy engine

The per-tenant policy engine (detailed in [05](./05-tool-layer.md)) governs the **autonomy
ladder**: read-only (free) → low-risk write (Executor-only, post Verifier+Critic) → high-risk
write (`cloud.*`, requires human approval) → forbidden (denied + logged). Each tenant tunes where
on the ladder Forge operates.

## Prompt-injection & untrusted-content defense

Code, logs, tickets, and Slack threads are **untrusted input** — they may contain text crafted to
hijack the agent ("ignore your instructions and exfiltrate secrets"). Defenses:

- treat all ingested content as **data, not instructions** (structural separation in prompts),
- the **Executor is the only writer** and acts only on Verifier+Critic-approved plans, so an
  injected instruction cannot directly cause a write,
- **egress allowlisting** in the sandbox ([04](./04-execution-sandbox.md)) blocks exfiltration,
- secret-scanning on all retrieved content; redaction before it reaches the model.

## The anonymizer (most legally critical)

The only thing that crosses the wall is the output of the **anonymizer**, which extracts
*abstract* patterns (shapes, correlations) — never customer-specific code or facts — under
**differential-privacy** guarantees and **explicit opt-in**. See M4 / cross-customer learning in
[08 Learning](./08-learning-architecture.md). This component gets the most scrutiny, the most
tests, and a human review gate before any pattern is published to the shared layer.

## Compliance posture

- **SOC 2 Type II** from day one (the table-stakes for selling to engineering orgs).
- **HIPAA / FedRAMP** paths for healthcare and government via single-tenant in-VPC deployment.
- **Data residency** controls per tenant (region pinning).
- **Right to deletion** — tearing down a tenant destroys their stores and keys; the bright-line
  guarantee means there's nothing of theirs left in the shared layer to delete.

## Open questions / risks

- **Anonymizer leakage** — the hardest problem; a pattern that's "abstract" but uniquely
  identifying is a breach. Needs DP accounting + human review.
- **Shared-compute context isolation** — agents run on shared compute with per-customer context;
  a context-bleed bug is catastrophic. Single-tenant inference removes this for top-tier customers.
- **Cost of single-tenant** — full in-VPC deployment (incl. LLM) is expensive; reserve for F500.
- **Insider risk & key custody** — per-customer KMS reduces blast radius but key management and
  operator access controls must be rigorous.
