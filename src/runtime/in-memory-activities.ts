/**
 * In-memory fake activities for local runs (pnpm demo) and tests.
 *
 * Implements just enough of the activity surface for the CodeReview workflow to run
 * end-to-end against the seeded InMemorySubstrateClient — no sandbox, no MCPs, no models.
 *
 * The Critic here is a simple confidence threshold so the gate visibly drops low-signal
 * findings (refute-by-default), and posted comments are captured for assertions/printing.
 */

import { InMemorySubstrateClient } from "../substrate/in-memory";
import type { Activities, ReviewFinding } from "../workflows/codereview.workflow";

export interface PostedComment {
  pr: number;
  path: string;
  line: number;
  body: string;
}

export interface InMemoryRig {
  activities: Partial<Activities>;
  posted: PostedComment[];
}

/** Per-dimension confidence; the Critic keeps only those at/above the threshold. */
const CONFIDENCE: Record<string, number> = {
  review: 0.8,
  security: 0.95,
  perf: 0.5, // refuted by the Critic
  architecture: 0.75,
  tests: 0.6, // refuted by the Critic
};
const CRITIC_THRESHOLD = 0.7;

export function makeInMemoryActivities(): InMemoryRig {
  const substrate = new InMemorySubstrateClient();
  const posted: PostedComment[] = [];

  const activities: Partial<Activities> = {
    async retrieveContext(ref) {
      return substrate.queryContext(ref);
    },

    async runSpecialist(input) {
      const dim = (/"(\w+)" dimension/.exec(input.instruction)?.[1] ??
        "review") as ReviewFinding["dimension"];
      const finding: ReviewFinding = {
        dimension: dim,
        path: "payments/charge.go",
        line: 42,
        body: `[${dim}] finding from ${input.role}`,
        confidence: CONFIDENCE[dim] ?? 0.7,
      };
      return [finding];
    },

    async verify(_input) {
      return { pass: true, evidence: {} };
    },

    async critique(input) {
      const candidates = Array.isArray(input.proposedWork)
        ? (input.proposedWork as ReviewFinding[])
        : [];
      return {
        pass: true,
        survivingFindings: candidates.filter((f) => f.confidence >= CRITIC_THRESHOLD),
        refuted: candidates.filter((f) => f.confidence < CRITIC_THRESHOLD),
      };
    },

    async gitPrComment(pr, comment) {
      posted.push({ pr, ...comment });
    },

    async applyPreferences(_tenantId, _work) {
      return {};
    },
  };

  return { activities, posted };
}
