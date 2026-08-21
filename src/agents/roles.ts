/**
 * Agent role system for Forge orchestration (L6).
 *
 * Mirrors docs/architecture/06-agent-orchestration.md.
 *
 * The hard rule encoded here: only the Executor role may call write-capable
 * tools, and only after both the Verifier and the Critic have passed.
 *
 * These are typed skeletons that encode the orchestration shape — not runtime logic.
 */

/** L5 tool namespaces an agent may be granted. See docs/architecture/05-tool-layer.md. */
export type ToolNamespace =
  | "code.read"
  | "code.edit"
  | "code.search"
  | "tests.run"
  | "tests.coverage"
  | "git.read"
  | "git.write" // branch/commit/pr.open/pr.comment — write
  | "obs.read"
  | "tickets.read"
  | "tickets.write"
  | "comms.write"
  | "cloud.write"; // rollback/scale/exec — high-risk write

/** The five canonical role groups, plus the named specialists. */
export type RoleName =
  | "Planner"
  | "Coder"
  | "Reviewer"
  | "Tester"
  | "Debugger"
  | "Architect"
  | "SecAuditor"
  | "Verifier"
  | "Critic"
  | "Executor";

export interface AgentRole {
  readonly name: RoleName;
  /** Key into the system-prompt registry for this role. */
  readonly systemPromptKey: string;
  /** L5 namespaces this role is permitted to call. */
  readonly allowedTools: readonly ToolNamespace[];
  /**
   * Whether this role may invoke write-capable tools.
   * INVARIANT: true for Executor only.
   */
  readonly canWrite: boolean;
}

export interface AgentInvocation {
  readonly role: RoleName;
  readonly taskId: string;
  readonly tenantId: string;
  /** The packed, retrieved context window (from the Retrieval Orchestrator / M2). */
  readonly context: unknown; // RetrievedContext — see ../substrate/graphs.ts
  readonly instruction: string;
  /** Hard ceiling on output tokens / tool calls for this invocation. */
  readonly budget: { tokens: number; toolCalls: number };
}

export interface AgentResult {
  readonly role: RoleName;
  /** Role-specific structured output (findings, a diff, a hypothesis, a verdict, …). */
  readonly output: unknown;
  /** True only if the role completed without exhausting its budget or erroring. */
  readonly ok: boolean;
  readonly notes?: string;
}

/**
 * Canonical role registry. allowedTools is the *maximum* grant; the per-tenant
 * policy engine (L5) may narrow it further at call time.
 */
export const ROLES: Readonly<Record<RoleName, AgentRole>> = {
  Planner: {
    name: "Planner",
    systemPromptKey: "prompt/planner",
    allowedTools: ["code.search", "obs.read", "tickets.read"],
    canWrite: false,
  },
  Coder: {
    name: "Coder",
    systemPromptKey: "prompt/coder",
    allowedTools: ["code.read", "code.search", "code.edit", "tests.run"],
    canWrite: false, // proposes edits in-sandbox; Executor commits/opens the PR
  },
  Reviewer: {
    name: "Reviewer",
    systemPromptKey: "prompt/reviewer",
    allowedTools: ["code.read", "code.search"],
    canWrite: false,
  },
  Tester: {
    name: "Tester",
    systemPromptKey: "prompt/tester",
    allowedTools: ["code.read", "code.edit", "tests.run", "tests.coverage"],
    canWrite: false,
  },
  Debugger: {
    name: "Debugger",
    systemPromptKey: "prompt/debugger",
    allowedTools: ["code.read", "code.search", "tests.run", "obs.read"],
    canWrite: false,
  },
  Architect: {
    name: "Architect",
    systemPromptKey: "prompt/architect",
    allowedTools: ["code.read", "code.search"],
    canWrite: false,
  },
  SecAuditor: {
    name: "SecAuditor",
    systemPromptKey: "prompt/secauditor",
    allowedTools: ["code.read", "code.search"],
    canWrite: false,
  },
  Verifier: {
    name: "Verifier",
    systemPromptKey: "prompt/verifier",
    allowedTools: ["code.read", "tests.run", "tests.coverage", "obs.read"],
    canWrite: false,
  },
  Critic: {
    name: "Critic",
    systemPromptKey: "prompt/critic",
    allowedTools: ["code.read", "code.search", "tests.run", "obs.read"],
    canWrite: false,
  },
  Executor: {
    name: "Executor",
    systemPromptKey: "prompt/executor",
    // The ONLY role with write namespaces.
    allowedTools: ["git.write", "tickets.write", "comms.write", "cloud.write"],
    canWrite: true,
  },
};

/** Guard used by the tool layer: refuse a write from any non-Executor role. */
export function assertMayWrite(role: RoleName): void {
  if (!ROLES[role].canWrite) {
    throw new Error(`Role ${role} attempted a write-capable tool; only Executor may write.`);
  }
}
