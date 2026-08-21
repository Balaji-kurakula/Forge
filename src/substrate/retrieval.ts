/**
 * Retrieval Orchestrator (M2) — turns a task into a packed context window.
 *
 * Mirrors docs/architecture/11-retrieval-orchestrator.md and 08-learning-architecture.md (M2).
 *
 * When the Planner starts a task, it asks the orchestrator for everything relevant:
 * fan a single logical query across all four graphs (via SubstrateClient), enrich with
 * the per-tenant preference layer (M3) and anonymized shared patterns, rank, then PACK
 * to a token budget — the slice the specialists reason over. Skeleton only.
 */

import type { RetrievedContext, SubstrateClient, TaskRef } from "./graphs";
import type { PreferenceLayer } from "./preferences";

export interface RetrievalBudget {
  /** Hard ceiling for the packed window (e.g. 1_000_000). */
  maxTokens: number;
}

export interface RankedItem {
  /** NodeId or document ref of the item. */
  ref: string;
  /** Relevance score (recency × proximity × semantic similarity × feedback weight). */
  score: number;
  /** Estimated token cost if included. */
  tokens: number;
}

export interface RetrievalOrchestrator {
  /**
   * The unified retrieval entry point: query → rank → pack → RetrievedContext.
   * Deterministic given the same substrate snapshot (so workflow replay is stable).
   */
  retrieve(ref: TaskRef, budget: RetrievalBudget): Promise<RetrievedContext>;
}

const NI = (name: string): never => {
  throw new Error(`not implemented: ${name}`);
};

/**
 * Reference orchestrator wiring. Composes a SubstrateClient (the four graphs) with the
 * PreferenceLayer (M3). Ranking/packing are TODO (see the deep-dive doc); construction
 * is wired so callers can depend on the shape today.
 */
export class DefaultRetrievalOrchestrator implements RetrievalOrchestrator {
  constructor(
    private readonly substrate: SubstrateClient,
    private readonly preferences?: PreferenceLayer,
  ) {}

  async retrieve(_ref: TaskRef, _budget: RetrievalBudget): Promise<RetrievedContext> {
    // 1. substrate.queryContext(ref) → structural slice across the four graphs
    // 2. preferences?.rulesFor / examplesFor → fold M3 in
    // 3. rank candidates, 4. pack greedily under budget.maxTokens
    void this.substrate;
    void this.preferences;
    return NI("DefaultRetrievalOrchestrator.retrieve");
  }
}
