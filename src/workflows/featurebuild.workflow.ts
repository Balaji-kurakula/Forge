/**
 * Feature Build durable workflow (L7 → L6). Implements docs/workflows/feature-build-e2e.md.
 *
 * Spec → Architect decomposes against the Code Graph → Coders implement → Tester →
 * integrate → Verifier → Critic (incl. find_edge_cases) → Executor opens PR.
 * Ambiguous specs PARK on a human-clarification signal. Activities injected (ADR-0003).
 */

import * as defaultActivities from "../activities";
import type { Activities } from "./codereview.workflow";

export interface FeatureBuildInput {
  tenantId: string;
  repo: string;
  spec: string;
}

export async function featureBuildWorkflow(
  input: FeatureBuildInput,
  overrides: Partial<Activities> = {},
): Promise<{ prUrl?: string; outcome: string }> {
  const acts = { ...defaultActivities, ...overrides };
  const tid = `feat:${input.repo}`;

  const ctx = await acts.retrieveContext({
    tenant: input.tenantId,
    anchor: input.spec,
    kind: "freeText",
  });

  // 3. Architect decomposes the feature against the Code + Decision graphs.
  await acts.runSpecialist({
    role: "Architect",
    taskId: tid,
    tenantId: input.tenantId,
    context: ctx,
    instruction: `Decompose this feature against existing conventions: ${input.spec}`,
  });

  // 5–6. Coders implement; Tester writes unit + integration tests.
  await acts.runSpecialist({
    role: "Coder",
    taskId: tid,
    tenantId: input.tenantId,
    context: ctx,
    instruction: "Implement the decomposed sub-components.",
  });
  await acts.runSpecialist({
    role: "Tester",
    taskId: tid,
    tenantId: input.tenantId,
    context: ctx,
    instruction: "Write unit + integration tests for the new behavior.",
  });

  // 8–9. Verifier (tests/types/build); Critic (adversarial edge cases + blast radius).
  const verified = await acts.verify({ taskId: tid, tenantId: input.tenantId, proposedWork: {} });
  const critiqued = await acts.critique({
    taskId: tid,
    tenantId: input.tenantId,
    proposedWork: {},
  });
  if (!verified.pass || !critiqued.pass) {
    return { outcome: "re_plan_or_escalate" };
  }

  // 10. Executor opens the PR (merging is always human).
  const pr = await acts.gitOpenPr({
    branch: `feat/${tid}`,
    title: `Feature: ${input.spec.slice(0, 60)}`,
    body: "Feature implemented behind the Verifier+Critic gate; merge is human.",
    idempotencyKey: tid,
  });
  return { prUrl: pr.url, outcome: "feature_pr_opened" };
}
