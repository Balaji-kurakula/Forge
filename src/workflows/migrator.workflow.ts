/**
 * Migrator durable workflow (L7 surface → L6 orchestration).
 *
 * Implements docs/workflows/migrator-e2e.md.
 * A months-long engagement: a parent workflow plans the migration, then runs a
 * child workflow per module (pipelined, not lockstep). Behavior-preservation is
 * enforced by characterization-tests-first + shadow-diff in the sandbox (L4).
 *
 * Temporal-style skeleton. Durability via per-module checkpointing + continueAsNew.
 * Activities are injected (ADR-0003).
 */

import * as defaultActivities from "../activities";
import type { Activities } from "./codereview.workflow";

export interface MigratorInput {
  repo: string;
  sourceStack: string; // e.g. "java8"
  targetStack: string; // e.g. "java17"
  tenantId: string;
}

export interface ModulePlan {
  moduleId: string;
  path: string;
  dependsOn: string[]; // leaf-first ordering
}

export interface ModuleResult {
  moduleId: string;
  status: "merged" | "escalated" | "skipped";
  prUrl?: string;
}

/** Parent: plan, then drive each module to completion in dependency order. */
export async function migratorWorkflow(
  input: MigratorInput,
  overrides: Partial<Activities> = {},
): Promise<{ results: ModuleResult[] }> {
  const acts = { ...defaultActivities, ...overrides };

  // 1. Architect builds the module plan against the Code Graph.
  const plan = (await acts.runSpecialist({
    role: "Architect",
    taskId: `mig:${input.repo}`,
    tenantId: input.tenantId,
    context: undefined as unknown as never,
    instruction: `Plan a ${input.sourceStack}→${input.targetStack} migration of ${input.repo}, module-by-module, leaf-first. Return ModulePlan[].`,
  })) as ModulePlan[];

  const results: ModuleResult[] = [];
  const done = new Set<string>();

  // 2. Pipeline modules: a module starts as soon as its dependencies are merged.
  //    (Real impl: launch child workflows concurrently up to a budget; here, ordered for clarity.)
  for (const m of topoOrder(plan)) {
    const res = await migrateModuleWorkflow({ ...input, module: m }, overrides);
    results.push(res);
    if (res.status === "merged") done.add(m.moduleId);

    // 3. Durability: checkpoint + continueAsNew to bound history on long runs.
    // if (shouldContinueAsNew()) return continueAsNew({ ...input, alreadyDone: [...done] })
  }

  return { results };
}

export interface ModuleInput extends MigratorInput {
  module: ModulePlan;
}

/** Child: migrate a single module behind the Verifier+Critic gate. */
export async function migrateModuleWorkflow(
  input: ModuleInput,
  overrides: Partial<Activities> = {},
): Promise<ModuleResult> {
  const acts = { ...defaultActivities, ...overrides };
  const tid = `mig:${input.module.moduleId}`;
  const MAX_REWRITES = 3;

  // a. Characterize: lock current behavior with tests FIRST.
  await acts.runSpecialist({
    role: "Tester",
    taskId: tid,
    tenantId: input.tenantId,
    context: undefined as unknown as never,
    instruction: `Write characterization tests that lock the CURRENT behavior of ${input.module.path}.`,
  });

  for (let attempt = 0; attempt < MAX_REWRITES; attempt++) {
    // b. Rewrite to target idioms (Migrator-LM / M4).
    await acts.runSpecialist({
      role: "Coder",
      taskId: tid,
      tenantId: input.tenantId,
      context: undefined as unknown as never,
      instruction: `Rewrite ${input.module.path} to ${input.targetStack} idioms, preserving behavior.`,
    });

    // c–d. Shadow-diff old vs new across replayed prod inputs; Verifier checks tests + zero divergence.
    const verified = await acts.verify({
      taskId: tid,
      tenantId: input.tenantId,
      proposedWork: { kind: "shadow_diff", module: input.module.moduleId },
    });

    // e. Critic: adversarial edge inputs (locale, precision, error paths).
    const critiqued = await acts.critique({
      taskId: tid,
      tenantId: input.tenantId,
      proposedWork: { module: input.module.moduleId },
    });

    if (verified.pass && critiqued.pass) {
      // f. Executor opens the per-module PR.
      const pr = await acts.gitOpenPr({
        branch: `migrate/${input.module.moduleId}`,
        title: `Migrate ${input.module.path} → ${input.targetStack}`,
        body: "Behavior-preserving migration. Shadow-diff clean over replayed prod inputs.",
        idempotencyKey: `mig:${input.module.moduleId}`,
      });
      return { moduleId: input.module.moduleId, status: "merged", prUrl: pr.url };
    }
    // else: feed divergences back into the next rewrite attempt.
  }

  // Bounded retries exhausted → escalate to a human; the rest of the migration continues.
  return { moduleId: input.module.moduleId, status: "escalated" };
}

/** Leaf-first topological order over the module dependency graph. */
export function topoOrder(plan: ModulePlan[]): ModulePlan[] {
  const byId = new Map(plan.map((m) => [m.moduleId, m]));
  const seen = new Set<string>();
  const out: ModulePlan[] = [];
  const visit = (m: ModulePlan) => {
    if (seen.has(m.moduleId)) return;
    seen.add(m.moduleId);
    for (const dep of m.dependsOn) {
      const d = byId.get(dep);
      if (d) visit(d);
    }
    out.push(m);
  };
  plan.forEach(visit);
  return out;
}
