/**
 * engineer-mcp — Product A: the pluggable MCP server (the wedge / trojan horse).
 *
 * Mirrors docs/architecture/07-product-surfaces.md.
 *
 * Forge exposes ITSELF as an MCP server. Any host (Cursor, Claude Code, Zed, a CI
 * bot) connects and calls high-level engineering tools. Each tool kicks off a
 * durable workflow (L6) and returns a durable taskId immediately — because MCP is
 * request/response but real engineering tasks run for hours. Hosts then stream
 * progress or poll get_task(taskId).
 *
 * Product A is shallow-but-instant (rebuilds context per call). The deep, compounding
 * value lives in Product B — the always-on per-customer substrate. A is how you land;
 * B is the business.
 *
 * Skeleton only: handlers start workflows and return handles; no transport wiring.
 */

export type TaskId = string;

export interface TaskHandle {
  taskId: TaskId;
  status: "queued" | "running" | "awaiting_approval" | "done" | "failed";
}

export interface TaskState extends TaskHandle {
  progress?: string;
  artifacts?: { prUrl?: string; report?: unknown };
}

/** Common context passed by the host for every call. */
export interface McpCallCtx {
  tenantId: string;
  repo: string;
}

/**
 * The workflow client the server uses to launch durable workflows.
 * In a real deployment this is the Temporal client (start + query).
 */
export interface WorkflowClient {
  start(workflow: string, args: unknown): Promise<TaskId>;
  query(taskId: TaskId): Promise<TaskState>;
}

export class EngineerMcpServer {
  constructor(private readonly wf: WorkflowClient) {}

  // ── exposed MCP tools ───────────────────────────────────────────────────────

  /** Index a repo and return a summary (kicks off / refreshes substrate build). */
  analyzeRepo(ctx: McpCallCtx): Promise<TaskHandle> {
    return this.kick("analyzeRepoWorkflow", { ...ctx });
  }

  /** Fix a bug → bugFixWorkflow (docs/workflows/bugfix-e2e.md). */
  fixBug(ctx: McpCallCtx, issueIdOrDesc: string): Promise<TaskHandle> {
    return this.kick("bugFixWorkflow", { ...ctx, issueIdOrDesc });
  }

  /** Build a feature → featureBuildWorkflow (docs/workflows/feature-build-e2e.md). */
  addFeature(ctx: McpCallCtx, spec: string): Promise<TaskHandle> {
    return this.kick("featureBuildWorkflow", { ...ctx, spec });
  }

  /** Review a PR → codeReviewWorkflow (docs/workflows/codereview-e2e.md). */
  reviewPr(ctx: McpCallCtx, prId: number): Promise<TaskHandle> {
    return this.kick("codeReviewWorkflow", { ...ctx, prId });
  }

  /** Suggest tests for a path → testGenWorkflow. */
  suggestTests(ctx: McpCallCtx, path: string): Promise<TaskHandle> {
    return this.kick("testGenWorkflow", { ...ctx, path });
  }

  /** Adversarial edge-case enumeration (the Critic, exposed directly). */
  findEdgeCases(ctx: McpCallCtx, target: string): Promise<TaskHandle> {
    return this.kick("findEdgeCasesWorkflow", { ...ctx, target });
  }

  /** Migrate a codebase → migratorWorkflow (docs/workflows/migrator-e2e.md). */
  migrate(ctx: McpCallCtx, from: string, to: string): Promise<TaskHandle> {
    return this.kick("migratorWorkflow", { ...ctx, sourceStack: from, targetStack: to });
  }

  /** Explain an incident via Decision+Behavioral graph traversal. */
  explainIncident(ctx: McpCallCtx, incidentId: string): Promise<TaskHandle> {
    return this.kick("explainIncidentWorkflow", { ...ctx, incidentId });
  }

  // ── task lifecycle (the hours-long-task pattern) ──────────────────────────────

  /** Poll for status/artifacts of any task. Hosts may also stream progress events. */
  getTask(taskId: TaskId): Promise<TaskState> {
    return this.wf.query(taskId);
  }

  /**
   * Stream progress for long-running tasks (MCP supports streaming responses).
   * Skeleton: real impl yields events until the workflow reaches a terminal state.
   */
  async *streamTask(taskId: TaskId): AsyncGenerator<TaskState> {
    // while (!terminal) { yield await this.wf.query(taskId); await wait(...) }
    yield await this.wf.query(taskId);
  }

  private async kick(workflow: string, args: unknown): Promise<TaskHandle> {
    const taskId = await this.wf.start(workflow, args);
    return { taskId, status: "queued" };
  }
}
