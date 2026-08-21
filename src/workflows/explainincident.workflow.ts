/**
 * Explain Incident workflow (L7 → L6). Backs engineer-mcp `explain_incident`.
 * Implements docs/workflows/explain-incident-e2e.md.
 *
 * A read-only Decision + Behavioral graph traversal: given an incident, reconstruct the
 * timeline, the suspect change, and the linked discussion. Activities injected (ADR-0003).
 */

import * as defaultActivities from "../activities";
import type { Activities } from "./codereview.workflow";

export interface ExplainIncidentInput {
  tenantId: string;
  repo: string;
  incidentId: string;
}

export interface IncidentExplanation {
  incidentId: string;
  explanation: string;
}

export async function explainIncidentWorkflow(
  input: ExplainIncidentInput,
  overrides: Partial<Activities> = {},
): Promise<IncidentExplanation> {
  const acts = { ...defaultActivities, ...overrides };

  const ctx = await acts.retrieveContext({
    tenant: input.tenantId,
    anchor: input.incidentId,
    kind: "incident",
  });

  // Debugger traverses Behavioral (what happened) + Decision (why / which PR) graphs.
  const explanation = (await acts.runSpecialist({
    role: "Debugger",
    taskId: `explain:${input.incidentId}`,
    tenantId: input.tenantId,
    context: ctx,
    instruction: "Explain the incident: timeline, suspect change, linked discussion, fix.",
  })) as string;

  return { incidentId: input.incidentId, explanation };
}
