import { describe, expect, it } from "vitest";
import { type ModulePlan, topoOrder } from "../src/workflows/migrator.workflow";

describe("topoOrder (leaf-first module ordering)", () => {
  it("places dependencies before their dependents", () => {
    const plan: ModulePlan[] = [
      { moduleId: "app", path: "app", dependsOn: ["lib"] },
      { moduleId: "lib", path: "lib", dependsOn: ["core"] },
      { moduleId: "core", path: "core", dependsOn: [] },
    ];
    const order = topoOrder(plan).map((m) => m.moduleId);
    expect(order.indexOf("core")).toBeLessThan(order.indexOf("lib"));
    expect(order.indexOf("lib")).toBeLessThan(order.indexOf("app"));
  });

  it("tolerates a dependency cycle without looping forever", () => {
    const plan: ModulePlan[] = [
      { moduleId: "a", path: "a", dependsOn: ["b"] },
      { moduleId: "b", path: "b", dependsOn: ["a"] },
    ];
    const order = topoOrder(plan).map((m) => m.moduleId);
    expect([...order].sort()).toEqual(["a", "b"]);
  });
});
