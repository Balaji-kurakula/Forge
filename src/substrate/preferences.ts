/**
 * Preference Layer (M3) — the per-customer "personality" that adapts Forge to a team.
 *
 * Mirrors docs/architecture/08-learning-architecture.md (M3).
 *
 * Lives left of the tenancy wall (per-customer). Holds: structured rules learned from
 * feedback (deterministic, instantly updatable), few-shot examples retrieved into
 * prompts, and (big customers only) an optional small LoRA reference. Skeleton only.
 */

import type { Tenant } from "./graphs";

export type PreferenceKind =
  | "style" // e.g. "early-return, not nested if-else"
  | "severity" // e.g. "flag goroutine-leak patterns aggressively"
  | "banned_suggestion" // e.g. "stop suggesting lodash"
  | "ranking"; // e.g. "values test coverage over micro-perf"

export interface PreferenceRule {
  id: string;
  tenant: Tenant;
  kind: PreferenceKind;
  /** Human-readable rule; in production also a matchable predicate. */
  rule: string;
  /** Higher = stronger; decays over time to avoid ossification. */
  weight: number;
  /** Provenance: which feedback events produced this rule. */
  source: string[];
}

export interface FewShotExample {
  tenant: Tenant;
  prompt: string;
  accepted: string;
  rejected?: string;
}

/** A single human verdict that the layer learns from (closes the M3 loop). */
export interface FeedbackEvent {
  tenant: Tenant;
  kind: "comment" | "pr" | "alert";
  verdict: "accepted" | "rejected" | "edited";
  payload: unknown;
}

export interface PreferenceLayer {
  /** Structured rules for a tenant, optionally scoped (e.g. by language/service). */
  rulesFor(tenant: Tenant, scope?: string): Promise<readonly PreferenceRule[]>;
  /** Few-shot examples to fold into a prompt for a given query. */
  examplesFor(tenant: Tenant, query: string, k: number): Promise<readonly FewShotExample[]>;
  /** Update rules/examples from a human verdict. Deterministic + instantly applied. */
  learn(event: FeedbackEvent): Promise<void>;
}
