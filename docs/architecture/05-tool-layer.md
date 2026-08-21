# 05 — Tool Layer (L5)

L5 is the agents' **hands**: a narrow, typed set of functions the agents call to read, run, and
act. Each tool wraps an underlying L1 MCP ([01](./01-ingestion-mcp.md)) but exposes a *smaller,
agent-friendly, policy-enforced* surface. The agents never touch raw MCPs — they call L5.

> Why a separate layer? Raw MCP surfaces are broad and unsafe to hand an autonomous agent. L5
> exposes exactly the verbs the agents need, enforces approval policy, and produces a complete
> audit log of every action.

## Tool namespaces

### `code.*` — read & edit source (in the sandbox, [04](./04-execution-sandbox.md))
```ts
code.read(path: string, lines?: [number, number]): Promise<string>
code.edit(path: string, diff: UnifiedDiff): Promise<EditResult>     // write
code.search(query: string, opts?: { semantic?: boolean }): Promise<Hit[]>
```

### `tests.*` — run & measure tests
```ts
tests.run(scope: TestScope): Promise<TestReport>
tests.coverage(file: string): Promise<CoverageReport>
```

### `git.*` — version control & PRs
```ts
git.branch(name: string): Promise<void>
git.commit(message: string, paths: string[]): Promise<Sha>          // write
git.pr.open(opts: PrOptions): Promise<PrRef>                        // write
git.pr.comment(pr: PrRef, comment: InlineComment): Promise<void>    // write
```

### `obs.*` — observability (Behavioral Graph + live)
```ts
obs.logs(service: string, range: TimeRange, query?: string): Promise<LogPage>
obs.metrics(service: string, metric: string, range: TimeRange): Promise<Series>
obs.traces(traceId: string): Promise<Trace>
```

### `tickets.*` — issue tracking
```ts
tickets.search(query: string): Promise<Ticket[]>
tickets.create(ticket: NewTicket): Promise<TicketRef>               // write
```

### `comms.*` — communication
```ts
comms.post(channel: string, msg: Message): Promise<void>            // write
comms.dm(user: UserRef, msg: Message): Promise<void>                // write
```

### `cloud.*` — infrastructure actions (**heavily gated**)
```ts
cloud.exec(service: string, command: GatedCommand): Promise<ExecResult>  // write, high-risk
cloud.rollback(service: string, toSha: Sha): Promise<void>               // write, high-risk
cloud.scale(service: string, replicas: number): Promise<void>            // write, high-risk
```

## The policy / approval engine

Every tool call passes through a **per-customer policy engine** that classifies it and decides
whether it runs autonomously, requires human sign-off, or is forbidden.

```
 agent calls a tool
        │
        ▼
 ┌────────────────────┐   read-only?      ┌──────────────┐
 │  POLICY ENGINE     │──────────────────▶│   ALLOW      │ (always; audited)
 │  (per-tenant rules)│                   └──────────────┘
 │                    │   write + low-risk + Verifier&Critic passed?
 │                    │──────────────────▶│   ALLOW (Executor only) │
 │                    │   write + high-risk (cloud.*)?
 │                    │──────────────────▶│ REQUIRE HUMAN APPROVAL  │
 │                    │   forbidden by policy?
 │                    │──────────────────▶│   DENY + log            │
 └────────────────────┘
        │
        ▼
   AUDIT LOG  (who/what/when/why, immutable, per-tenant)
```

Key rules:

- **Read-only tools** (`code.read`, `code.search`, `tests.*` read paths, `obs.*`,
  `tickets.search`) run freely for any specialist, fully audited.
- **Write tools** (marked `// write` above) may be invoked **only by the Executor agent**
  ([06](./06-agent-orchestration.md)), and only after **both Verifier and Critic pass**.
- **High-risk writes** (`cloud.*`) additionally require **one-click human approval** by default;
  the autonomy level is a per-tenant policy knob (draft → propose → approve → autonomous).
- **Forbidden actions** per tenant policy are denied and logged.

## Safety mechanisms

- **Idempotency keys** on every write so retries don't double-act (open one PR, not three).
- **Dry-run mode** — write tools can produce the *intended* effect (the diff, the PR body, the
  rollback plan) without committing, for Critic inspection and human preview.
- **Scoped credentials** — L5 holds only the narrowly-scoped token for the action, sourced
  per-tenant ([09](./09-tenancy-security.md)).
- **Complete audit trail** — every call (allowed, denied, approved) is recorded immutably per
  tenant; this is what proves to a customer exactly what the agent did.

## Relationship to L1

L5 is the *internal, narrowed, governed* surface; L1 is the *external wire*. `git.pr.open()`
(L5) ultimately calls the GitHub MCP (L1), but the agent only ever sees `git.pr.open()` with
its policy, audit, and idempotency guarantees attached.

## Open questions / risks

- **Policy expressiveness vs safety** — too permissive and agents do damage; too strict and the
  product can't ship anything autonomously. The autonomy ladder must be tunable per tenant.
- **Approval fatigue** — if every action needs human approval the value evaporates; calibrating
  what's safe-by-default is a core product problem.
- **`cloud.exec` is a loaded gun** — arbitrary infra commands are the highest-risk surface;
  may need a constrained command grammar rather than free-form exec.
- **Audit completeness** — a single unlogged write path is a compliance failure; the layer must
  make it impossible to act without logging.
