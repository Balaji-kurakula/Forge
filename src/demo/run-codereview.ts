/**
 * Local demo: run the CodeReview workflow end-to-end against in-memory fakes.
 *
 *   pnpm demo
 *
 * No databases, MCPs, or model calls — the seeded InMemorySubstrateClient supplies the
 * `chargeCustomer` context and fake activities drive the Verifier+Critic gate. Five
 * specialist findings go in; the Critic refutes the two low-confidence ones; the Executor
 * posts only the survivors.
 */

import { makeInMemoryActivities } from "../runtime/in-memory-activities";
import { codeReviewWorkflow } from "../workflows/codereview.workflow";

const { activities, posted } = makeInMemoryActivities();

const result = await codeReviewWorkflow(
  { prId: 4471, repo: "acme/payments", tenantId: "acme", headSha: "a91f" },
  activities,
);

console.log("CodeReview demo — PR acme/payments#4471\n");
console.log(`Findings posted (survived the Critic gate): ${result.posted}\n`);
for (const c of posted) {
  console.log(`  • ${c.path}:${c.line}  ${c.body}`);
}
console.log("\n(Two low-confidence findings — perf, tests — were refuted and not posted.)");
