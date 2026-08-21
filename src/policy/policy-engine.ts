/**
 * Policy / Approval engine (L5) — the gate that makes autonomous action safe.
 *
 * Mirrors docs/architecture/05-tool-layer.md and ADR-0005.
 *
 * Unlike most skeletons in this repo, the DefaultPolicyEngine is REAL, deterministic
 * logic — the safety invariant is too important to leave unimplemented:
 *
 *   • read-only tools           → ALLOW (always; still audited)
 *   • low-risk write tools      → ALLOW only for the Executor role AND only after
 *                                  BOTH the Verifier and the Critic have passed
 *   • high-risk writes (cloud.*)→ REQUIRE_APPROVAL (human one-click), even post-gate,
 *                                  unless the tenant has opted into an autonomous envelope
 *   • tenant-forbidden tools    → DENY
 *
 * See src/agents/roles.ts for the role/tool model and ROLES[role].canWrite.
 */

import { ROLES, type RoleName, type ToolNamespace } from "../agents/roles";

export type PolicyDecision = "allow" | "require_approval" | "deny";

/** Read-only namespaces: free for any specialist, always audited. */
const READ_ONLY: ReadonlySet<ToolNamespace> = new Set([
  "code.read",
  "code.search",
  "tests.run",
  "tests.coverage",
  "git.read",
  "obs.read",
  "tickets.read",
]);

/** Low-risk write namespaces: Executor-only, post Verifier+Critic. */
const LOW_RISK_WRITE: ReadonlySet<ToolNamespace> = new Set([
  "code.edit",
  "git.write",
  "tickets.write",
  "comms.write",
]);

/** High-risk write namespaces: additionally require human approval by default. */
const HIGH_RISK_WRITE: ReadonlySet<ToolNamespace> = new Set(["cloud.write"]);

/** Result of the Verifier+Critic gate for the work this tool call belongs to. */
export interface GateState {
  verifierPassed: boolean;
  criticPassed: boolean;
}

export interface ToolCall {
  tenant: string;
  role: RoleName;
  tool: ToolNamespace;
  gate: GateState;
  args?: unknown;
  /** Stable idempotency key for write calls (open one PR, not three). */
  idempotencyKey?: string;
}

export interface PolicyVerdict {
  decision: PolicyDecision;
  reason: string;
}

/** Per-tenant policy configuration (the autonomy ladder knobs). */
export interface TenantPolicy {
  /** Tools this tenant forbids entirely. */
  forbidden?: ReadonlySet<ToolNamespace>;
  /** If true, high-risk writes may run without human approval (rung 4). Default false. */
  autonomousHighRisk?: boolean;
}

export interface PolicyEngine {
  classify(call: ToolCall, policy?: TenantPolicy): PolicyVerdict;
}

/** The reference implementation of the gate. Pure and deterministic — see tests. */
export class DefaultPolicyEngine implements PolicyEngine {
  classify(call: ToolCall, policy: TenantPolicy = {}): PolicyVerdict {
    if (policy.forbidden?.has(call.tool)) {
      return { decision: "deny", reason: `tool ${call.tool} is forbidden by tenant policy` };
    }

    if (READ_ONLY.has(call.tool)) {
      return { decision: "allow", reason: "read-only tool" };
    }

    const isWrite = LOW_RISK_WRITE.has(call.tool) || HIGH_RISK_WRITE.has(call.tool);
    if (!isWrite) {
      // Unknown/unclassified namespace — fail closed.
      return { decision: "deny", reason: `unclassified tool ${call.tool}; failing closed` };
    }

    // Writes: only the Executor may write.
    if (!ROLES[call.role].canWrite) {
      return {
        decision: "deny",
        reason: `role ${call.role} may not write; only Executor may invoke write tools`,
      };
    }

    // Writes require BOTH the Verifier and the Critic to have passed.
    if (!call.gate.verifierPassed || !call.gate.criticPassed) {
      return {
        decision: "deny",
        reason: "write blocked: Verifier and Critic must both pass before any write",
      };
    }

    // High-risk writes additionally require human approval unless tenant opted into autonomy.
    if (HIGH_RISK_WRITE.has(call.tool) && !policy.autonomousHighRisk) {
      return {
        decision: "require_approval",
        reason: `high-risk ${call.tool} needs human approval`,
      };
    }

    return { decision: "allow", reason: "Executor write, gate passed" };
  }
}
