# 01 — Ingestion & MCP (L1)

L1 is the boundary between Forge and the customer's world. Every external system Forge
reads from or acts on is reached through an **MCP server**. This gives a uniform auth model,
uniform capability discovery, and lets compliance-sensitive customers self-host connectors.

> L1 is *ingestion + outbound actions to third-party systems*. The narrower, typed surface
> the **agents** call is a different layer — see [05 Tool Layer](./05-tool-layer.md). L1 is
> "the wire to GitHub"; L5 is "`git.pr.open()` that the Executor agent is allowed to call."

## Why MCP specifically

- **Customers already gate these systems.** MCP rides their existing OAuth / scoped-token
  model instead of asking for broad credentials.
- **Uniform capability discovery.** Forge asks each server what tools it exposes rather than
  hard-coding 50 bespoke integrations.
- **Self-hostable for compliance.** A regulated customer can run the GitHub/Datadog MCP
  inside their own VPC; Forge connects to it over a controlled channel.

## Connector catalog

| Domain | Connectors (MCP servers) | Feeds |
|---|---|---|
| Code | GitHub, GitLab, Bitbucket, local filesystem | Code Graph, Decision Graph |
| Observability | Datadog, Sentry, Grafana, OpenTelemetry | Behavioral Graph |
| Issue tracking | Linear, Jira, GitHub Issues | Decision Graph |
| Comms | Slack, Discord, email | Decision Graph, Team Graph |
| Infra | AWS, GCP, Kubernetes, Terraform | Behavioral Graph, sandbox config |
| CI/CD | GitHub Actions, CircleCI, Jenkins | Behavioral + Decision Graph |

## Read-mostly vs write-capable MCP

Most MCP servers in the wild are **read-mostly**. Forge needs **write-capable** connectors
for outbound actions: open a PR, post a review comment, acknowledge an alert, update a
ticket, post to Slack. For each we either:

1. contribute write tools upstream, or
2. maintain a thin Forge fork that adds **strongly scoped** write tools.

Write capability is always the most tightly scoped token possible (e.g. "open PRs on
`repo:acme/payments`", not "admin:org"). All writes are mediated by the L5 policy engine and
only the **Executor** agent may trigger them (see [05](./05-tool-layer.md), [06](./06-agent-orchestration.md)).

## Auth model

- **OAuth / scoped tokens** per connector, per tenant, stored under the customer's KMS key
  (see [09](./09-tenancy-security.md)).
- **Least privilege**: read scopes for ingestion, narrowly-scoped write scopes for actions.
- **Short-lived credentials** with refresh; revocation propagates within seconds.
- **Self-hosted option**: the connector runs in the customer VPC; Forge holds only a session
  token to that connector, never the upstream credential.

## Event flow into L2

```
 Customer system        L1 connector (MCP)         L2 pipeline (→ 02)
 ─────────────          ──────────────────         ──────────────────
   git push  ──webhook──▶ GitHub MCP
                          │ normalize → CloudEvent
                          │ { tenant, type:"pr.opened",
                          │   repo, sha, payload }
                          └────────────publish─────────▶ ingestion topic
   alert fires ─webhook─▶ Datadog MCP ──normalize──────▶ ingestion topic
   poll (metrics) ◀──────  (pull connectors poll on a
                            schedule and emit deltas)
```

Two ingestion modes:

- **Push** — webhooks (PR opened, alert fired, ticket updated). Lowest latency.
- **Pull** — scheduled polling for systems without webhooks (some metrics/log APIs). The
  connector tracks a cursor and emits only deltas.

Every event is normalized to a tenant-stamped envelope before it enters L2.

## Rate limiting, backpressure & reliability

- **Per-connector rate budgets** respect upstream API limits; excess work queues.
- **Backpressure** flows from L2 — if indexing falls behind, pull connectors slow their poll
  cadence and push events buffer in the ingestion topic (durable).
- **Idempotency** — every event carries a stable key (`tenant:source:eventId`) so retries
  and webhook duplicates are de-duplicated in L2.
- **At-least-once delivery** into the topic; L2 makes processing idempotent.

## Boundary with L5

| Concern | L1 Ingestion connectors | L5 Tool Layer |
|---|---|---|
| Audience | The platform (pipeline) | The agents |
| Direction | Mostly inbound + scoped outbound | Outbound actions the agent decides on |
| Surface | Whatever the upstream MCP exposes | Narrowed, typed `code.* / git.* / obs.* …` |
| Policy | Token scoping | Per-action approval + audit (Executor-only writes) |

## Open questions / risks

- **Write-capable MCP maturity** — the ecosystem is read-heavy today; Forge may carry fork
  maintenance burden until upstream catches up.
- **Webhook gaps** — not every system has webhooks; pull polling adds latency and cost.
- **Credential blast radius** — a compromised connector token is serious; mitigated by
  least-privilege scoping, short TTLs, and per-tenant KMS isolation ([09](./09-tenancy-security.md)).
- **Schema drift** — upstream API changes can silently break normalization; needs contract
  tests against each connector.
