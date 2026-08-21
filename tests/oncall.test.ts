import { describe, expect, it } from "vitest";
import type { Activities } from "../src/workflows/codereview.workflow";
import {
  type MitigationPlan,
  approveSignal,
  onCallWorkflow,
} from "../src/workflows/oncall.workflow";

function makeOnCallRig() {
  const calls = { comms: 0, rollback: 0, postmortem: 0 };
  const plan: MitigationPlan = {
    kind: "rollback",
    rationale: "error spike correlates with PR #4471",
    suspectPr: 4471,
    blastRadius: "low",
    evidence: {},
  };
  const activities: Partial<Activities> = {
    async obsLogs() {
      return {};
    },
    async obsMetrics() {
      return {};
    },
    async runSpecialist() {
      return plan;
    },
    async verify() {
      return { pass: true, evidence: {} };
    },
    async critique() {
      return { pass: true, survivingFindings: [], refuted: [] };
    },
    async commsPost() {
      calls.comms++;
    },
    async cloudRollback() {
      calls.rollback++;
    },
    async writePostmortem() {
      calls.postmortem++;
      return "acme:decision:postmortem:1";
    },
  };
  return { activities, calls };
}

const base = { alertId: "a1", service: "payments", tenantId: "acme" } as const;

describe("onCallWorkflow — the autonomy ladder", () => {
  it("rung 1 (draft_postmortem): drafts only, never acts", async () => {
    const { activities, calls } = makeOnCallRig();
    const res = await onCallWorkflow({ ...base, autonomy: "draft_postmortem" }, activities);
    expect(res.outcome).toMatch(/^postmortem_drafted/);
    expect(calls.comms).toBe(0);
    expect(calls.rollback).toBe(0);
  });

  it("rung 2 (propose_fix): proposes via comms, does not execute", async () => {
    const { activities, calls } = makeOnCallRig();
    const res = await onCallWorkflow({ ...base, autonomy: "propose_fix" }, activities);
    expect(res.outcome).toBe("fix_proposed");
    expect(calls.comms).toBe(1);
    expect(calls.rollback).toBe(0);
  });

  // Runs BEFORE any approveSignal(true) so the module-level approval state is still unset.
  it("rung 3 (execute_with_approval): parks without an approval signal", async () => {
    const { activities, calls } = makeOnCallRig();
    const res = await onCallWorkflow({ ...base, autonomy: "execute_with_approval" }, activities);
    expect(res.outcome).toBe("awaiting_or_denied_approval");
    expect(calls.rollback).toBe(0);
  });

  it("rung 3 (execute_with_approval): executes once approved", async () => {
    const { activities, calls } = makeOnCallRig();
    approveSignal({ approved: true, by: "asha" });
    const res = await onCallWorkflow({ ...base, autonomy: "execute_with_approval" }, activities);
    expect(res.outcome).toMatch(/^mitigated_and_documented/);
    expect(calls.rollback).toBe(1);
  });
});
