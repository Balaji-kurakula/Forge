import { describe, expect, it } from "vitest";
import { DefaultPolicyEngine } from "../src/policy/policy-engine";

const eng = new DefaultPolicyEngine();
const gatePass = { verifierPassed: true, criticPassed: true };
const noGate = { verifierPassed: false, criticPassed: false };

describe("DefaultPolicyEngine — the L5 gate (ADR-0005)", () => {
  it("allows read-only tools for any role, even without the gate", () => {
    const v = eng.classify({ tenant: "acme", role: "Reviewer", tool: "code.read", gate: noGate });
    expect(v.decision).toBe("allow");
  });

  it("denies a write from a non-Executor role", () => {
    const v = eng.classify({ tenant: "acme", role: "Coder", tool: "git.write", gate: gatePass });
    expect(v.decision).toBe("deny");
  });

  it("denies an Executor write when the Verifier+Critic gate has not passed", () => {
    const v = eng.classify({
      tenant: "acme",
      role: "Executor",
      tool: "git.write",
      gate: { verifierPassed: true, criticPassed: false },
    });
    expect(v.decision).toBe("deny");
  });

  it("allows an Executor low-risk write after the gate passes", () => {
    const v = eng.classify({ tenant: "acme", role: "Executor", tool: "git.write", gate: gatePass });
    expect(v.decision).toBe("allow");
  });

  it("requires human approval for cloud.* even after the gate", () => {
    const v = eng.classify({
      tenant: "acme",
      role: "Executor",
      tool: "cloud.write",
      gate: gatePass,
    });
    expect(v.decision).toBe("require_approval");
  });

  it("allows autonomous cloud.* only when the tenant opted in", () => {
    const v = eng.classify(
      { tenant: "acme", role: "Executor", tool: "cloud.write", gate: gatePass },
      { autonomousHighRisk: true },
    );
    expect(v.decision).toBe("allow");
  });

  it("denies tenant-forbidden tools", () => {
    const v = eng.classify(
      { tenant: "acme", role: "Reviewer", tool: "code.read", gate: gatePass },
      { forbidden: new Set(["code.read"]) },
    );
    expect(v.decision).toBe("deny");
  });
});
