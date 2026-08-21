import { describe, expect, it } from "vitest";
import { makeInMemoryActivities } from "../src/runtime/in-memory-activities";
import { codeReviewWorkflow } from "../src/workflows/codereview.workflow";

describe("codeReviewWorkflow — Verifier+Critic gate", () => {
  it("posts only the findings that survive the Critic", async () => {
    const { activities, posted } = makeInMemoryActivities();

    const res = await codeReviewWorkflow(
      { prId: 4471, repo: "acme/payments", tenantId: "acme", headSha: "a91f" },
      activities,
    );

    // 5 specialists run; the two low-confidence findings (perf, tests) are refuted.
    expect(res.posted).toBe(3);
    expect(posted).toHaveLength(3);

    const bodies = posted.map((p) => p.body);
    expect(bodies.some((b) => b.includes("[security]"))).toBe(true);
    expect(bodies.some((b) => b.includes("[review]"))).toBe(true);
    expect(bodies.some((b) => b.includes("[architecture]"))).toBe(true);

    // refuted, never posted:
    expect(bodies.some((b) => b.includes("[perf]"))).toBe(false);
    expect(bodies.some((b) => b.includes("[tests]"))).toBe(false);
  });
});
