# 07 — Product Surfaces (L7)

L7 is thin. Each product is **a Planner entry point bound to a trigger** — the heavy lifting all
happens in L6 orchestration ([06](./06-agent-orchestration.md)) over the shared substrate
([03](./03-reasoning-substrate.md)). Same engine, different entry points, different SLAs.

```
 trigger                         surface         → Planner invocation
 ───────                         ───────           ───────────────────
 pr.opened (webhook)          ─▶ CodeReview      ─▶ review workflow      (→ ../workflows/codereview-e2e.md)
 alert.fired (webhook)        ─▶ OnCall          ─▶ incident workflow    (→ ../workflows/oncall-e2e.md)
 migration plan (long-run)    ─▶ Migrator        ─▶ migrator workflow    (→ ../workflows/migrator-e2e.md)
 Slack / IDE message          ─▶ Chat            ─▶ ad-hoc workflow
 engineer-mcp tool call       ─▶ Product A       ─▶ relevant workflow
```

## Flagship products

### CodeReview
- **Trigger:** `pr.opened` / `pr.synchronize` webhook.
- **SLA:** first comments within minutes of PR open.
- **Specialists:** Reviewer (conventions), SecAuditor (OWASP/secrets/injection), a perf reviewer
  (N+1, allocations), Architect (fits repo conventions via Code Graph), Tester (coverage gaps).
- **Output:** inline PR comments, posted by the Executor via `git.pr.comment`.
- **Pricing:** ~$50/dev/month. Full flow: [codereview-e2e](../workflows/codereview-e2e.md).

### OnCall
- **Trigger:** `alert.fired` webhook from Datadog/PagerDuty/Sentry.
- **SLA:** triage within minutes; mitigation gated on human approval.
- **Specialists:** Debugger (logs/metrics/traces + correlate to recent PRs), Verifier (hypothesis
  check), Critic (blast-radius check).
- **Output:** a mitigation proposal (rollback/scale/restart) executed on approval, then a
  postmortem written into the Decision Graph.
- **Pricing:** $5K–50K/month per org. Full flow: [oncall-e2e](../workflows/oncall-e2e.md).

### Migrator
- **Trigger:** a long-running migration plan (C-suite-initiated engagement).
- **SLA:** weeks-to-months; durable, resumable, progress-tracked.
- **Specialists:** Architect (plan), characterization Tester, Coder (Migrator-LM), shadow-diff
  Verifier, Critic.
- **Output:** a stream of behavior-preserving, shadow-verified PRs, module by module.
- **Pricing:** $5M–50M per engagement. Full flow: [migrator-e2e](../workflows/migrator-e2e.md).

### Later waves
TestGen, Refactor, Docs (Wave 2); Architect, Planning (Wave 3) — each ships in months because
the substrate is already built (see [00 expansion waves](./00-overview.md)).

## Product A — the `engineer-mcp` server (the wedge)

Forge exposes *itself* as an MCP server. Cursor, Claude Code, Zed, or a CI bot connect and call
high-level engineering tools. Under the hood, each tool is a **Planner invocation** over the
substrate. Skeleton: [`../../src/mcp/engineer-mcp.ts`](../../src/mcp/engineer-mcp.ts).

Exposed tools:

```
 analyze_repo(repo)                 → index + summary of the codebase
 fix_bug(repo, issue_id|desc)       → bug-fix workflow      (→ ../workflows/bugfix-e2e.md)
 add_feature(repo, spec)            → feature-build workflow (→ ../workflows/feature-build-e2e.md)
 review_pr(repo, pr_id)             → codereview workflow
 suggest_tests(repo, path)          → test-gen workflow
 find_edge_cases(repo, path|fn)     → adversarial Critic enumeration
 migrate(repo, from, to)            → migrator workflow
 explain_incident(repo, incident)   → Decision+Behavioral graph traversal
```

### The hours-long-task problem

MCP is **request/response**, but real engineering tasks run for **hours**. The server solves this
with **durable task IDs + streaming progress**:

```
 host: fix_bug(repo, "checkout 500s")
   └─▶ engineer-mcp starts a durable workflow, returns { taskId } immediately
 host: streams progress events (MCP supports streaming)  ◀── "reproducing…", "fix drafted…"
 host: get_task(taskId)  ── poll any time ──▶ { status, artifacts, prUrl? }
```

The host never blocks on a multi-hour call; it gets a task handle and polls or streams.

### Why A is the trojan horse for B

Product A delivers value in minutes with a trivial install — devs adopt it bottoms-up. But an
MCP-only tool rebuilds context every call, so it can only do *shallow* tasks (write a function,
fix an obvious bug). The *deep* tasks (migrate this service, debug a 3-week-old flaky test, plan
the quarter's refactors) need the always-on substrate — **Product B**. So: land with A, then
upsell the team into B once they trust Forge with their code and want the compounding value.

## Open questions / risks

- **MCP streaming maturity** — long-task ergonomics depend on host support for streaming +
  polling; not all hosts implement it well.
- **Shallow-vs-deep expectation gap** — users of Product A may expect Product-B depth; messaging
  must set the right expectation and make the upsell natural.
- **Trigger reliability** — missed webhooks mean missed reviews/incidents; needs reconciliation
  (periodic sweep for PRs/alerts that didn't fire a webhook).
- **SLA variance** — the same engine serves a minutes-SLA review and a months-SLA migration;
  scheduling must not let big jobs starve interactive ones.
