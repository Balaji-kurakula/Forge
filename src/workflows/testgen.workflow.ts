/**
 * TestGen workflow (L7 → L6). Backs engineer-mcp `suggest_tests`.
 * Implements docs/workflows/testgen-e2e.md.
 *
 * Tester proposes tests for a path/coverage gap; Verifier confirms they run; Executor
 * opens a PR with the suggested tests. Activities injected (ADR-0003).
 */

import * as defaultActivities from "../activities";
import type { Activities } from "./codereview.workflow";

export interface TestGenInput {
  tenantId: string;
  repo: string;
  path: string;
}

export async function testGenWorkflow(
  input: TestGenInput,
  overrides: Partial<Activities> = {},
): Promise<{ prUrl?: string; outcome: string }> {
  const acts = { ...defaultActivities, ...overrides };
  const tid = `testgen:${input.path}`;

  const ctx = await acts.retrieveContext({
    tenant: input.tenantId,
    anchor: input.path,
    kind: "path",
  });

  await acts.runSpecialist({
    role: "Tester",
    taskId: tid,
    tenantId: input.tenantId,
    context: ctx,
    instruction: `Propose tests covering the coverage gaps in ${input.path}.`,
  });

  const verified = await acts.verify({ taskId: tid, tenantId: input.tenantId, proposedWork: {} });
  const critiqued = await acts.critique({
    taskId: tid,
    tenantId: input.tenantId,
    proposedWork: {},
  });
  if (!verified.pass || !critiqued.pass) {
    return { outcome: "re_plan_or_escalate" };
  }

  const pr = await acts.gitOpenPr({
    branch: `tests/${tid}`,
    title: `Add tests for ${input.path}`,
    body: "Generated tests covering existing coverage gaps.",
    idempotencyKey: tid,
  });
  return { prUrl: pr.url, outcome: "tests_pr_opened" };
}
