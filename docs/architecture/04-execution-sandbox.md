# 04 — Execution Sandbox (L4)

Agents don't just *think* — they must **run code** to verify their work. The difference
between an agent that *suggests* a fix and one that *ships* a fix is whether it can run the
tests, watch them fail, iterate, and only open the PR when green. L4 is where that loop closes.

## What the sandbox is

A **per-customer, ephemeral microVM** that holds everything an agent needs to execute and
verify a task:

- A **live clone of the repo** at any commit (checked out to the task's base SHA).
- A **replica of the test suite** and its toolchain (language runtimes, build deps).
- Optionally, a **shadow staging environment** with synthetic data (for integration/shadow runs).
- **Network egress restricted** to *that customer's* MCPs only — no open internet, no
  cross-tenant reachability.

Isolation tech: **Firecracker microVMs** (or **gVisor** sandboxes) — strong isolation, boot in
**< 1 second**, torn down after each task.

## Lifecycle

```
 task assigned
     │
     ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 1. ACQUIRE   pull a warm microVM from the per-tenant pool    │ < 1s
 │ 2. HYDRATE   CoW-clone repo @baseSHA + mount cached deps     │
 │ 3. RUN       agent calls tests.run / code.edit / cloud.exec  │  ← the loop
 │              ↑ iterate: edit → run → observe → edit          │
 │ 4. CAPTURE   collect test results, diffs, artifacts, traces  │
 │ 5. TEARDOWN  destroy VM; nothing persists outside artifacts  │
 └─────────────────────────────────────────────────────────────┘
```

The **edit → run → observe → iterate** loop in step 3 is the core value: the agent gets real
feedback (compiler errors, failing tests, runtime traces) instead of guessing.

## Sandbox economics

Running a fresh VM with a full repo + prod replica for every invocation is expensive. The
business depends on driving unit cost down:

- **Copy-on-write filesystems** — clone a 10 GB repo in milliseconds; only changed blocks cost.
- **Base-image caching** — per-repo, per-toolchain base images with deps pre-installed and
  test caches warm, so step 2 is near-instant.
- **Snapshotting** — snapshot the VM right after hydrate; restore from snapshot instead of
  rebuilding.
- **Warm pools** — keep a small pool of pre-booted VMs per active tenant to hide boot latency.
- **Right-sizing & budgets** — each task carries a compute budget ([06](./06-agent-orchestration.md));
  runaway loops are killed.

You will burn money here — that's fine, it's part of the moat. But caching is what keeps the
gross margin viable.

## Security isolation

- One VM per task; no shared mutable state between tasks or tenants.
- Egress allowlist = that tenant's MCP endpoints only ([01](./01-ingestion-mcp.md)).
- Secrets (tokens for the tenant's MCPs) injected at runtime, scoped, never written to the
  image, and revoked on teardown. See [09 Tenancy & Security](./09-tenancy-security.md).
- All commands the agent runs go through the **L5 Tool Layer** ([05](./05-tool-layer.md)),
  which logs and policy-checks `cloud.exec` and other write actions.

## Shadow-mode diffing (Migrator)

For [Migrator](../workflows/migrator-e2e.md), the sandbox runs **old and new code side by side**
and diffs outputs across **10,000 replayed real production inputs**:

```
 prod input replay set (10K) ──┬──▶ OLD module ──▶ output_old ──┐
                               └──▶ NEW module ──▶ output_new ──┴─▶ diff
                                                                    │
                          divergences → Critic investigates ───────┘
```

Only a behavior-preserving rewrite (zero meaningful divergence) passes the Verifier+Critic gate.
This is what makes "migrate this service" safe rather than a leap of faith.

## Open questions / risks

- **Cost at scale** — without aggressive caching, sandbox compute can dominate COGS.
- **Replicating prod faithfully** — synthetic data and shadow envs never perfectly match prod;
  some bugs only appear with real data/scale.
- **Toolchain sprawl** — every language/build system needs a maintained base image.
- **Long-running sandboxes** — a multi-hour migration module ties up a VM; needs
  checkpoint/restore so a teardown mid-task doesn't lose progress (ties to durable
  orchestration in [06](./06-agent-orchestration.md)).
- **Egress exfiltration** — a compromised dependency could attempt to phone home; the egress
  allowlist is the primary defense and must be airtight.
