/**
 * CodeReview durable workflow (L7 surface → L6 orchestration).
 *
 * Implements docs/workflows/codereview-e2e.md.
 * Triggered by a pr.opened webhook. Read + comment only — never writes code.
 *
 * Temporal-style skeleton: `proxyActivities` wires retry/timeout policy onto the
 * activity stubs in ../activities. Workflow body stays deterministic.
 *
 * Activities are injected (see ADR-0003): the second arg defaults to the real
 * (throwing) activity module, but tests/demos pass a Partial<Activities> of fakes
 * that is merged over the defaults. This mirrors Temporal's proxyActivities seam.
 */

import type { RetrievedContext } from "../substrate/graphs";

// In real Temporal: const acts = proxyActivities<typeof activities>({ startToCloseTimeout, retry })
import * as defaultActivities from "../activities";

/** The full activity surface a workflow may call. */
export type Activities = typeof defaultActivities;

const RETRY = {
  // startToCloseTimeout: "5m", maximumAttempts: 3, backoffCoefficient: 2.0
};

export interface CodeReviewInput {
  prId: number;
  repo: string;
  tenantId: string;
  headSha: string;
}

export interface ReviewFinding {
  dimension: "review" | "security" | "perf" | "architecture" | "tests";
  path: string;
  line: number;
  body: string;
  confidence: number;
}

/** Feedback signal: a posted comment was accepted/rejected/edited by a human. */
export interface CommentFeedback {
  commentId: string;
  verdict: "accepted" | "rejected" | "edited";
}

export async function codeReviewWorkflow(
  input: CodeReviewInput,
  overrides: Partial<Activities> = {},
): Promise<{ posted: number }> {
  const acts = { ...defaultActivities, ...overrides };

  // 1–2. Plan + retrieve context (M2) across the four graphs + preferences (M3).
  const ctx: RetrievedContext = await acts.retrieveContext({
    tenant: input.tenantId,
    anchor: `pr:${input.repo}#${input.prId}`,
    kind: "pr",
  });

  // 4. Specialists in parallel over one shared context.
  const dimensions = ["review", "security", "perf", "architecture", "tests"] as const;
  const specialistOutputs = await Promise.all(
    dimensions.map((d) =>
      acts.runSpecialist({
        role: roleForDimension(d),
        taskId: `cr:${input.prId}`,
        tenantId: input.tenantId,
        context: ctx,
        instruction: `Review the diff for the "${d}" dimension. Return ReviewFinding[].`,
      }),
    ),
  );
  const candidateFindings = specialistOutputs.flat() as ReviewFinding[];

  // 5. Verify (rerun tests/types/lint in the sandbox).
  const verified = await acts.verify({
    taskId: `cr:${input.prId}`,
    tenantId: input.tenantId,
    proposedWork: candidateFindings,
  });
  if (!verified.pass) {
    // Branch doesn't build / claims unverifiable → post partial, note the gap.
  }

  // 6. Critic adversarially refutes each finding (refute-by-default).
  const critiqued = await acts.critique({
    taskId: `cr:${input.prId}`,
    tenantId: input.tenantId,
    proposedWork: candidateFindings,
  });

  // 7. Executor posts ONLY surviving findings as inline comments (idempotent).
  const survivors = critiqued.survivingFindings as ReviewFinding[];
  for (const f of survivors) {
    await acts.gitPrComment(input.prId, { path: f.path, line: f.line, body: f.body });
  }

  return { posted: survivors.length };
}

/**
 * 8. Feedback signal handler — in Temporal this is a `setHandler(commentFeedbackSignal, …)`.
 * Routes human verdicts into the per-customer preference layer (M3).
 */
export async function onCommentFeedback(
  tenantId: string,
  fb: CommentFeedback,
  overrides: Partial<Activities> = {},
): Promise<void> {
  const acts = { ...defaultActivities, ...overrides };
  await acts.applyPreferences(tenantId, fb);
}

function roleForDimension(d: ReviewFinding["dimension"]) {
  switch (d) {
    case "security":
      return "SecAuditor" as const;
    case "architecture":
      return "Architect" as const;
    case "tests":
      return "Tester" as const;
    default:
      return "Reviewer" as const; // review + perf handled by Reviewer-class specialists
  }
}

void RETRY;
