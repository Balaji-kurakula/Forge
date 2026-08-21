/**
 * Analyze Repo workflow (L7 → L6). Backs engineer-mcp `analyze_repo`.
 * Implements docs/workflows/analyze-repo-e2e.md.
 *
 * Kicks off / refreshes the substrate build (L2 CDC) for a repo and returns a summary.
 * Read-only. Activities injected (ADR-0003).
 */

import * as defaultActivities from "../activities";
import type { Activities } from "./codereview.workflow";

export interface AnalyzeRepoInput {
  tenantId: string;
  repo: string;
}

export interface RepoSummary {
  repo: string;
  summary: string;
}

export async function analyzeRepoWorkflow(
  input: AnalyzeRepoInput,
  overrides: Partial<Activities> = {},
): Promise<RepoSummary> {
  const acts = { ...defaultActivities, ...overrides };

  // Retrieve whatever substrate exists so far (a backfill may still be in flight).
  const ctx = await acts.retrieveContext({
    tenant: input.tenantId,
    anchor: input.repo,
    kind: "path",
  });

  // Architect produces a structural summary over the indexed Code Graph.
  const summary = (await acts.runSpecialist({
    role: "Architect",
    taskId: `analyze:${input.repo}`,
    tenantId: input.tenantId,
    context: ctx,
    instruction: "Summarize the codebase: services, hotspots, owners, risk areas.",
  })) as string;

  return { repo: input.repo, summary };
}
