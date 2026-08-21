/**
 * Anonymizer (L9) — the ONLY component allowed to move data across the tenancy wall.
 *
 * Mirrors docs/architecture/12-anonymizer.md and 09-tenancy-security.md.
 *
 * It extracts ABSTRACT patterns (shapes, correlations) — never customer-specific code or
 * facts — under differential-privacy guarantees, explicit opt-in, and a human review gate
 * before anything is published to the shared pattern library / M4 training sets.
 *
 * This is the most legally fraught component in Forge; the skeleton encodes the invariants
 * so they are impossible to bypass once implemented.
 */

import type { Tenant } from "../substrate/graphs";

export interface CrossWallPattern {
  /** e.g. "anti-pattern→bug correlation", "incident playbook", "migration-pair". */
  kind: string;
  /** The abstract shape — must not contain identifiable customer code or facts. */
  shape: string;
  /** Number of distinct tenants/observations supporting it (k-anonymity floor). */
  support: number;
}

export interface AnonymizeRequest {
  tenant: Tenant;
  /** Hard requirement: the tenant has explicitly opted in. */
  consentOptIn: boolean;
  /** Differential-privacy budget to spend on this extraction. */
  epsilon: number;
}

export interface PublishGate {
  /** A human reviewer signed off that the pattern leaks no customer fact. */
  humanApproved: boolean;
}

export interface PublishVerdict {
  published: boolean;
  reason: string;
}

/** Minimum distinct-tenant support before a pattern may even be considered. */
export const K_ANONYMITY_FLOOR = 5;

export interface Anonymizer {
  /** Extract candidate abstract patterns from a tenant under a DP budget + opt-in. */
  extract(request: AnonymizeRequest): Promise<readonly CrossWallPattern[]>;
  /** Publish a pattern to the shared layer — only past the human review gate. */
  publish(pattern: CrossWallPattern, gate: PublishGate): Promise<PublishVerdict>;
}

const NI = (name: string): never => {
  throw new Error(`not implemented: ${name}`);
};

export class DefaultAnonymizer implements Anonymizer {
  async extract(request: AnonymizeRequest): Promise<readonly CrossWallPattern[]> {
    if (!request.consentOptIn) {
      throw new Error("anonymizer.extract refused: tenant has not opted in");
    }
    return NI("DefaultAnonymizer.extract");
  }

  async publish(pattern: CrossWallPattern, gate: PublishGate): Promise<PublishVerdict> {
    // Invariants enforced before any cross-wall publish:
    if (pattern.support < K_ANONYMITY_FLOOR) {
      return { published: false, reason: `support ${pattern.support} < k=${K_ANONYMITY_FLOOR}` };
    }
    if (!gate.humanApproved) {
      return { published: false, reason: "human review gate not passed" };
    }
    return NI("DefaultAnonymizer.publish");
  }
}
