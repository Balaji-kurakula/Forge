/**
 * OnCall durable workflow (L7 surface → L6 orchestration).
 *
 * Implements docs/workflows/oncall-e2e.md.
 * Triggered by an alert.fired webhook. Mitigation is gated on human approval by default.
 *
 * Temporal-style skeleton. The human-approval gate is modeled as a workflow that
 * PARKS on a signal (no thread held) and resumes when the signal arrives.
 *
 * Activities are injected (ADR-0003): pass a Partial<Activities> of fakes to drive
 * the autonomy ladder in tests without real side effects.
 */

import * as defaultActivities from "../activities";
import type { Activities } from "./codereview.workflow";

/** Per-tenant policy: how far OnCall may act autonomously (the autonomy ladder). */
export type AutonomyRung =
  | "draft_postmortem" // rung 1 — read only
  | "propose_fix" // rung 2 — suggest, human executes
  | "execute_with_approval" // rung 3 — one-click approve, then act (default)
  | "autonomous"; // rung 4 — act within an envelope, notify after

export interface OnCallInput {
  alertId: string;
  service: string;
  tenantId: string;
  autonomy: AutonomyRung;
}

export interface MitigationPlan {
  kind: "rollback" | "scale" | "restart" | "flag_off";
  rationale: string;
  suspectPr?: number; // correlated from Decision/Code graphs
  blastRadius: string;
  evidence: unknown;
}

interface ApprovalSignal {
  approved: boolean;
  by: string;
}

// In Temporal: defineSignal/defineQuery. Skeleton placeholders:
let _approval: ApprovalSignal | undefined;
export function approveSignal(sig: ApprovalSignal): void {
  _approval = sig;
}

const RANGE = { from: "-30m", to: "now" } as const;

export async function onCallWorkflow(
  input: OnCallInput,
  overrides: Partial<Activities> = {},
): Promise<{ outcome: string }> {
  const acts = { ...defaultActivities, ...overrides };

  // 3. Debugger gathers obs context and correlates to recent deploys/PRs.
  const [logs, metrics] = await Promise.all([
    acts.obsLogs(input.service, RANGE, "status:error"),
    acts.obsMetrics(input.service, "error_rate", RANGE),
  ]);

  // 3–4. Form hypothesis + propose mitigation (runs the Debugger specialist).
  const plan = (await acts.runSpecialist({
    role: "Debugger",
    taskId: `oc:${input.alertId}`,
    tenantId: input.tenantId,
    context: { logs, metrics } as unknown as never,
    instruction:
      "Diagnose the alert, correlate to recent PRs (Decision+Code graph), propose a MitigationPlan.",
  })) as MitigationPlan;

  // Rung 1: never act — just write the postmortem draft and stop.
  if (input.autonomy === "draft_postmortem") {
    const id = await acts.writePostmortem(input.tenantId, input.alertId, {
      plan,
      draft: true,
    });
    return { outcome: `postmortem_drafted:${id}` };
  }

  // 5. Verify the hypothesis against a metric.
  const verified = await acts.verify({
    taskId: `oc:${input.alertId}`,
    tenantId: input.tenantId,
    proposedWork: plan,
  });
  // 6. Critic checks blast radius / rollback safety.
  const critiqued = await acts.critique({
    taskId: `oc:${input.alertId}`,
    tenantId: input.tenantId,
    proposedWork: plan,
  });
  if (!verified.pass || !critiqued.pass) {
    return { outcome: "re_plan_or_escalate" };
  }

  // Rung 2: propose only — surface the plan to humans, don't execute.
  if (input.autonomy === "propose_fix") {
    await acts.commsPost(`oncall-${input.service}`, { plan, note: "proposed mitigation" });
    return { outcome: "fix_proposed" };
  }

  // 7. Rung 3: request one-click approval and PARK on the signal.
  if (input.autonomy === "execute_with_approval") {
    await acts.commsPost(`oncall-${input.service}`, { plan, action: "approve?" });
    // In Temporal: await condition(() => _approval !== undefined)
    if (!_approval?.approved) return { outcome: "awaiting_or_denied_approval" };
  }

  // 8. Executor applies the mitigation (Executor-only write tools).
  await applyMitigation(plan, input.service, acts);

  // 9. Monitor recovery; 10. write the postmortem into the Decision Graph (M1).
  // In Temporal: poll the metric in a loop with a deadline, re-escalate if not recovered.
  const id = await acts.writePostmortem(input.tenantId, input.alertId, {
    plan,
    resolved: true,
  });
  return { outcome: `mitigated_and_documented:${id}` };
}

async function applyMitigation(
  plan: MitigationPlan,
  service: string,
  acts: Activities,
): Promise<void> {
  switch (plan.kind) {
    case "rollback":
      return acts.cloudRollback(service, `pr:${plan.suspectPr}`);
    case "scale":
      return acts.cloudScale(service, /* replicas */ 0);
    case "restart":
      await acts.cloudExec(service, "restart");
      return;
    case "flag_off":
      await acts.cloudExec(service, "flag off");
      return;
  }
}
