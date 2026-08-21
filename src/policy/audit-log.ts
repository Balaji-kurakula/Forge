/**
 * Audit log (L5 / L9) — the immutable, per-tenant record that PROVES what the agent did
 * and that no read crossed the tenancy wall.
 *
 * Mirrors docs/architecture/05-tool-layer.md and docs/architecture/09-tenancy-security.md.
 *
 * Every L5 tool call (allowed, denied, approved) and every substrate read is recorded.
 * The InMemoryAuditLog is a working reference for tests/demo; production is an
 * append-only, per-tenant, tamper-evident store.
 */

import type { PolicyDecision } from "./policy-engine";

export interface AuditEntry {
  /** ISO-8601 timestamp; supplied by the caller (workflows stay deterministic). */
  ts: string;
  tenant: string;
  actor: string; // role name or "system"
  tool: string;
  decision: PolicyDecision;
  reason: string;
  idempotencyKey?: string;
}

export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
  /** All entries for a tenant, oldest-first. Never returns another tenant's entries. */
  entries(tenant: string): Promise<readonly AuditEntry[]>;
}

/** In-memory, append-only reference implementation (per-tenant partitioned). */
export class InMemoryAuditLog implements AuditLog {
  private readonly byTenant = new Map<string, AuditEntry[]>();

  async record(entry: AuditEntry): Promise<void> {
    const list = this.byTenant.get(entry.tenant) ?? [];
    list.push(Object.freeze({ ...entry }));
    this.byTenant.set(entry.tenant, list);
  }

  async entries(tenant: string): Promise<readonly AuditEntry[]> {
    return [...(this.byTenant.get(tenant) ?? [])];
  }
}
