/**
 * Find Edge Cases workflow (L7 → L6). Backs engineer-mcp `find_edge_cases`.
 * Implements docs/workflows/find-edge-cases-e2e.md.
 *
 * The Critic in adversarial mode, exposed directly: enumeration + property-based testing
 * + production reality (unusual inputs the Behavioral Graph has actually seen).
 * Read-only — returns cases, opens nothing. Activities injected (ADR-0003).
 */

import * as defaultActivities from "../activities";
import type { Activities } from "./codereview.workflow";

export interface FindEdgeCasesInput {
  tenantId: string;
  repo: string;
  target: string; // a path or function reference
}

export interface EdgeCase {
  input: string;
  rationale: string;
  source: "enumeration" | "property" | "production";
}

export async function findEdgeCasesWorkflow(
  input: FindEdgeCasesInput,
  overrides: Partial<Activities> = {},
): Promise<{ cases: EdgeCase[] }> {
  const acts = { ...defaultActivities, ...overrides };
  const tid = `edge:${input.target}`;

  const ctx = await acts.retrieveContext({
    tenant: input.tenantId,
    anchor: input.target,
    kind: "symbol",
  });

  const critiqued = await acts.critique({
    taskId: tid,
    tenantId: input.tenantId,
    proposedWork: { target: input.target, context: ctx },
  });

  return { cases: critiqued.survivingFindings as EdgeCase[] };
}
