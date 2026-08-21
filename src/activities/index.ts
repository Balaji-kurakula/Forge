/**
 * Temporal-style activities — the side-effecting steps that durable workflows call.
 *
 * Mirrors docs/architecture/05-tool-layer.md (L5) and docs/architecture/06-agent-orchestration.md (L6).
 *
 * Workflow code is deterministic; ALL side effects live here so they can be
 * retried, timed out, and replayed. Each activity is a typed stub that throws
 * "not implemented" — this file encodes the contract, not the logic.
 *
 * Write-capable activities (marked WRITE) are callable in a workflow only on the
 * Executor's behalf, after the Verifier+Critic gate. The L5 policy engine enforces this.
 */

import type { RoleName } from "../agents/roles";
import type { NodeId, RetrievedContext, TaskRef, TimeRange } from "../substrate/graphs";

const NI = (name: string): never => {
  throw new Error(`activity not implemented: ${name}`);
};

// ── Retrieval (M2) ──────────────────────────────────────────────────────────────
/** Unified cross-graph query → packed context window. Wraps SubstrateClient.queryContext. */
export async function retrieveContext(_ref: TaskRef): Promise<RetrievedContext> {
  return NI("retrieveContext");
}

// ── Agent invocations (L6) ──────────────────────────────────────────────────────
export interface SpecialistInput {
  role: RoleName;
  taskId: string;
  tenantId: string;
  context: RetrievedContext;
  instruction: string;
}
/** Run a single specialist/role agent over the retrieved context. */
export async function runSpecialist(_input: SpecialistInput): Promise<unknown> {
  return NI("runSpecialist");
}

export interface VerifyInput {
  taskId: string;
  tenantId: string;
  proposedWork: unknown; // diffs, comments, mitigation plan, …
}
/** Verifier: run tests/lints/types, simulate, check claims. Returns pass/fail + evidence. */
export async function verify(_input: VerifyInput): Promise<{ pass: boolean; evidence: unknown }> {
  return NI("verify");
}

export interface CritiqueInput {
  taskId: string;
  tenantId: string;
  proposedWork: unknown;
}
/** Critic: adversarially try to break the work (refute-by-default). */
export async function critique(
  _input: CritiqueInput,
): Promise<{ pass: boolean; survivingFindings: unknown[]; refuted: unknown[] }> {
  return NI("critique");
}

/** Fold the per-customer preference layer (M3) into agent inputs/outputs. */
export async function applyPreferences(_tenantId: string, _work: unknown): Promise<unknown> {
  return NI("applyPreferences");
}

// ── L5 tools: code.* ─────────────────────────────────────────────────────────────
export async function codeRead(_path: string, _lines?: [number, number]): Promise<string> {
  return NI("code.read");
}
export async function codeSearch(_query: string, _semantic?: boolean): Promise<unknown[]> {
  return NI("code.search");
}
/** WRITE — applies a diff in the task's sandbox working tree. */
export async function codeEdit(_path: string, _unifiedDiff: string): Promise<unknown> {
  return NI("code.edit");
}

// ── L5 tools: tests.* ────────────────────────────────────────────────────────────
export async function testsRun(
  _scope: string,
): Promise<{ passed: number; failed: number; log: string }> {
  return NI("tests.run");
}
export async function testsCoverage(_file: string): Promise<{ pct: number }> {
  return NI("tests.coverage");
}

// ── L5 tools: git.* (WRITE) ──────────────────────────────────────────────────────
export async function gitBranch(_name: string): Promise<void> {
  return NI("git.branch");
}
export async function gitCommit(_message: string, _paths: string[]): Promise<string> {
  return NI("git.commit");
}
/** WRITE — Executor-only. Idempotency key prevents duplicate PRs. */
export async function gitOpenPr(_opts: {
  branch: string;
  title: string;
  body: string;
  idempotencyKey: string;
}): Promise<{ url: string; number: number }> {
  return NI("git.pr.open");
}
/** WRITE — Executor-only. Posts an inline review comment. */
export async function gitPrComment(
  _pr: number,
  _comment: { path: string; line: number; body: string },
): Promise<void> {
  return NI("git.pr.comment");
}

// ── L5 tools: obs.* (read) ───────────────────────────────────────────────────────
export async function obsLogs(
  _service: string,
  _range: TimeRange,
  _query?: string,
): Promise<unknown> {
  return NI("obs.logs");
}
export async function obsMetrics(
  _service: string,
  _metric: string,
  _range: TimeRange,
): Promise<unknown> {
  return NI("obs.metrics");
}

// ── L5 tools: tickets.* ──────────────────────────────────────────────────────────
export async function ticketsSearch(_query: string): Promise<unknown[]> {
  return NI("tickets.search");
}
/** WRITE */
export async function ticketsCreate(_ticket: unknown): Promise<{ ref: string }> {
  return NI("tickets.create");
}

// ── L5 tools: comms.* (WRITE) ────────────────────────────────────────────────────
export async function commsPost(_channel: string, _msg: unknown): Promise<void> {
  return NI("comms.post");
}

// ── L5 tools: cloud.* (WRITE, high-risk — requires human approval by policy) ──────
export async function cloudExec(_service: string, _command: string): Promise<unknown> {
  return NI("cloud.exec");
}
export async function cloudRollback(_service: string, _toSha: string): Promise<void> {
  return NI("cloud.rollback");
}
export async function cloudScale(_service: string, _replicas: number): Promise<void> {
  return NI("cloud.scale");
}

// ── Substrate writes (postmortems, etc.) ─────────────────────────────────────────
export async function writePostmortem(
  _tenantId: string,
  _incidentId: string,
  _doc: unknown,
): Promise<NodeId> {
  return NI("writePostmortem");
}
