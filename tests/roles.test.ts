import { describe, expect, it } from "vitest";
import { ROLES, type RoleName, assertMayWrite } from "../src/agents/roles";

describe("role write invariant (ADR-0005)", () => {
  it("marks only the Executor as write-capable", () => {
    const writers = (Object.keys(ROLES) as RoleName[]).filter((r) => ROLES[r].canWrite);
    expect(writers).toEqual(["Executor"]);
  });

  it("assertMayWrite throws for every non-Executor role and passes for Executor", () => {
    for (const role of Object.keys(ROLES) as RoleName[]) {
      if (role === "Executor") {
        expect(() => assertMayWrite(role)).not.toThrow();
      } else {
        expect(() => assertMayWrite(role)).toThrow(/only Executor may write/);
      }
    }
  });
});
