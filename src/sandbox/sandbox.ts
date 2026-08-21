/**
 * Execution Sandbox (L4) — the per-customer, ephemeral microVM where agents run code.
 *
 * Mirrors docs/architecture/04-execution-sandbox.md.
 *
 * Lifecycle: ACQUIRE (warm VM from per-tenant pool) → HYDRATE (CoW-clone repo @baseSha
 * + mount cached deps) → RUN (edit→run→observe→iterate) → CAPTURE → TEARDOWN.
 * Egress is allowlisted to that tenant's MCPs only. Skeleton only.
 */

import type { Sha, Tenant } from "../substrate/graphs";

export interface SandboxHandle {
  id: string;
  tenant: Tenant;
  baseSha: Sha;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Shadow-mode diff config (Migrator): replay prod inputs through OLD vs NEW. */
export interface ShadowDiffRequest {
  module: string;
  /** Number of replayed real production inputs (target ~10_000). */
  replayCount: number;
}

export interface ShadowDiffResult {
  /** Count of meaningful output divergences; zero is required to pass the gate. */
  divergences: number;
  /** A bounded sample of divergent inputs for the Critic to investigate. */
  sample: unknown[];
}

export interface SandboxManager {
  /** Pull a warm microVM and check out the repo at baseSha (< 1s target). */
  acquire(tenant: Tenant, baseSha: Sha): Promise<SandboxHandle>;
  /** Run a command in the sandbox (mediated by the L5 tool layer + policy). */
  exec(handle: SandboxHandle, command: string): Promise<ExecResult>;
  /** Run OLD and NEW side by side over replayed prod inputs and diff outputs. */
  shadowDiff(handle: SandboxHandle, request: ShadowDiffRequest): Promise<ShadowDiffResult>;
  /** Destroy the VM; nothing persists outside captured artifacts. */
  teardown(handle: SandboxHandle): Promise<void>;
}

const NI = (name: string): never => {
  throw new Error(`not implemented: ${name}`);
};

/** Firecracker/gVisor-backed manager (production). Stubbed here. */
export class EphemeralSandboxManager implements SandboxManager {
  async acquire(_tenant: Tenant, _baseSha: Sha): Promise<SandboxHandle> {
    return NI("EphemeralSandboxManager.acquire");
  }
  async exec(_handle: SandboxHandle, _command: string): Promise<ExecResult> {
    return NI("EphemeralSandboxManager.exec");
  }
  async shadowDiff(_handle: SandboxHandle, _request: ShadowDiffRequest): Promise<ShadowDiffResult> {
    return NI("EphemeralSandboxManager.shadowDiff");
  }
  async teardown(_handle: SandboxHandle): Promise<void> {
    return NI("EphemeralSandboxManager.teardown");
  }
}
