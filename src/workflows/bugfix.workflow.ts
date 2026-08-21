/**
 * Bug Fix durable workflow (L7 → L6). Implements docs/workflows/bugfix-e2e.md.
 *
 * Shares the feature-build spine but opens with REPRODUCE-FIRST: a fix without a
 * failing-then-passing regression test is a guess. Activities injected (ADR-0003).
 */

import * as defaultActivities from "../activities";
import type { Activities } from "./codereview.workflow";

export interface BugFixInput {
  tenantId: string;
  repo: string;
  issueIdOrDesc: string;
}

export async function bugFixWorkflow(
  input: BugFixInput,
  overrides: Partial<Activities> = {},
): Promise<{ prUrl?: string; outcome: string }> {
  const acts = { ...defaultActivities, ...overrides };
  const tid = `bug:${input.repo}`;

  const ctx = await acts.retrieveContext({
    tenant: input.tenantId,
    anchor: input.issueIdOrDesc,
    kind: "freeText",
  });

  // 3–4. Debugger reproduces in the sandbox and localizes the root cause via the Code Graph.
  await acts.runSpecialist({
    role: "Debugger",
    taskId: tid,
    tenantId: input.tenantId,
    context: ctx,
    instruction: "Reproduce the bug with a minimal failing test, then localize the root cause.",
  });

  // 5–6. Coder writes the fix; Tester locks the reproduction in as a regression test.
  await acts.runSpecialist({
    role: "Coder",
    taskId: tid,
    tenantId: input.tenantId,
    context: ctx,
    instruction: "Write the fix for the localized root cause.",
  });
  await acts.runSpecialist({
    role: "Tester",
    taskId: tid,
    tenantId: input.tenantId,
    context: ctx,
    instruction: "Add a regression test that fails before the fix and passes after.",
  });

  // 7–8. Verifier runs tests; Critic predicts second-order breakage via the Behavioral Graph.
  const verified = await acts.verify({ taskId: tid, tenantId: input.tenantId, proposedWork: {} });
  const critiqued = await acts.critique({
    taskId: tid,
    tenantId: input.tenantId,
    proposedWork: {},
  });
  if (!verified.pass || !critiqued.pass) {
    return { outcome: "re_plan_or_escalate" };
  }

  // 9. Executor opens the PR (fix + regression test + root-cause writeup).
  const pr = await acts.gitOpenPr({
    branch: `fix/${tid}`,
    title: `Fix: ${input.issueIdOrDesc}`,
    body: "Reproduce-first fix with regression test and root-cause writeup.",
    idempotencyKey: tid,
  });
  return { prUrl: pr.url, outcome: "fix_pr_opened" };
}
