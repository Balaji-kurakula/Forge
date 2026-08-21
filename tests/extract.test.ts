import { beforeAll, describe, expect, it } from "vitest";
import { extractFromSource, getTypeScriptParser } from "../src/indexer/extract";

let parser: Awaited<ReturnType<typeof getTypeScriptParser>>;
beforeAll(async () => {
  parser = await getTypeScriptParser();
});

const SRC = `
import { helper } from "./util";

export function chargeCustomer(id: string): boolean {
  return validateCard(id) && helper();
}

function validateCard(id: string): boolean {
  return id.length > 0;
}

export class Payments {
  process(amount: number): void {
    chargeCustomer("x");
  }
}

export const placeOrder = (n: number) => chargeCustomer("y");
`;

describe("extractFromSource (TS → Code Graph)", () => {
  it("extracts functions, class + qualified methods, arrow consts", () => {
    const ex = extractFromSource(parser, "payments/charge.ts", SRC);
    const names = ex.symbols.map((s) => s.name);
    expect(names).toContain("chargeCustomer");
    expect(names).toContain("validateCard");
    expect(names).toContain("Payments"); // class node
    expect(names).toContain("Payments.process"); // method, qualified by class
    expect(names).toContain("placeOrder"); // arrow assigned to const
  });

  it("extracts intra-file CALLS edges from the enclosing function", () => {
    const ex = extractFromSource(parser, "payments/charge.ts", SRC);
    const calls = ex.calls.map((c) => `${c.fromName}->${c.toName}`);
    expect(calls).toContain("chargeCustomer->validateCard");
    expect(calls).toContain("chargeCustomer->helper");
    expect(calls).toContain("Payments.process->chargeCustomer");
    expect(calls).toContain("placeOrder->chargeCustomer");
  });

  it("extracts imports and a stable signature hash", () => {
    const ex = extractFromSource(parser, "payments/charge.ts", SRC);
    expect(ex.imports.map((i) => i.specifier)).toContain("./util");
    const charge = ex.symbols.find((s) => s.name === "chargeCustomer");
    expect(charge?.signatureHash).toMatch(/^[0-9a-f]{12}$/);
  });
});
