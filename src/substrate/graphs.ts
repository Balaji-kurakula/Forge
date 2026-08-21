/**
 * The four-graph reasoning substrate (L3) — typed interfaces.
 *
 * Mirrors docs/architecture/03-reasoning-substrate.md and docs/architecture/10-data-model.md.
 *
 * The substrate is polyglot (Neo4j + TimescaleDB + Postgres/pgvector); these
 * interfaces are the logical surface the Retrieval Orchestrator (M2) queries.
 * Skeleton only — no runtime logic.
 */

/** Stable cross-graph node id: "<tenant>:<graph>:<kind>:<stableKey>". */
export type NodeId = string;
export type Tenant = string;
export type Sha = string;

export interface TimeRange {
  /** ISO-8601 instant (e.g. "2026-06-01T00:00:00Z") or a relative token ("-30m", "now"). */
  from: string;
  to: string;
}

// ── Code Graph ────────────────────────────────────────────────────────────────
export type CodeKind = "file" | "class" | "function" | "type" | "module" | "service";
export type CodeEdgeKind =
  | "calls"
  | "imports"
  | "inherits"
  | "implements"
  | "tests"
  | "deploys_to"
  | "alias_of";

export interface CodeNode {
  nodeId: NodeId;
  tenant: Tenant;
  kind: CodeKind;
  name: string;
  path: string;
  language: string;
  signatureHash?: string;
  ownerTeam?: string;
  lastModified?: string;
  complexity?: number;
  embeddingId?: string;
}

export interface CodeEdge {
  tenant: Tenant;
  src: NodeId;
  dst: NodeId;
  kind: CodeEdgeKind;
  attrs?: Record<string, unknown>;
}

// ── Behavioral Graph ────────────────────────────────────────────────────────────
export type BehaviorKind = "service" | "endpoint" | "db_table" | "queue";
export type BehaviorEdgeKind = "calls_runtime" | "reads" | "writes" | "depends_on";

export interface BehavioralNode {
  nodeId: NodeId;
  tenant: Tenant;
  kind: BehaviorKind;
  /** Link back to the Code Graph node that implements this, if any. */
  codeNodeId?: NodeId;
}

export interface BehavioralEdge {
  tenant: Tenant;
  src: NodeId;
  dst: NodeId;
  kind: BehaviorEdgeKind;
}

export interface BehaviorMetricPoint {
  nodeId: NodeId;
  codeNodeId?: NodeId;
  deploySha: Sha; // attaches behavior to an exact code version
  ts: string;
  latencyP50?: number;
  latencyP99?: number;
  errorRate?: number;
  throughput?: number;
}

// ── Decision Graph ────────────────────────────────────────────────────────────
export type DecisionKind = "pr" | "issue" | "rfc" | "postmortem" | "slack_thread" | "design_doc";
export type DecisionEdgeKind = "discusses" | "decided" | "reverted" | "caused_incident" | "touches";

export interface DecisionNode {
  nodeId: NodeId;
  tenant: Tenant;
  kind: DecisionKind;
  title?: string;
  body?: string;
  url?: string;
  createdAt?: string;
  /** pgvector embedding for semantic recall. */
  embedding?: number[];
}

export interface DecisionEdge {
  tenant: Tenant;
  src: NodeId;
  dst: NodeId; // may point INTO the Code/Behavioral graph (cross-graph ref)
  kind: DecisionEdgeKind;
}

// ── Team Graph ──────────────────────────────────────────────────────────────────
export type TeamKind = "person" | "team" | "service";
export type TeamEdgeKind = "owns" | "reviews" | "was_on_call_for" | "was_paged_for";

export interface TeamNode {
  nodeId: NodeId;
  tenant: Tenant;
  kind: TeamKind;
  name?: string;
}

export interface TeamEdge {
  tenant: Tenant;
  src: NodeId;
  dst: NodeId;
  kind: TeamEdgeKind;
}

// ── Retrieval (the M2 hand-off; see docs/architecture/08-learning-architecture.md) ──

/** A natural-language or symbol reference identifying what a task is about. */
export interface TaskRef {
  tenant: Tenant;
  /** e.g. a function NodeId, a file path, a PR id, or a free-text description. */
  anchor: string;
  kind: "symbol" | "path" | "pr" | "incident" | "freeText";
}

/**
 * The packed result of a unified cross-graph query — what the Retrieval
 * Orchestrator hands to the agents to fill the 1M-token context window.
 */
export interface RetrievedContext {
  taskRef: TaskRef;
  code: { nodes: CodeNode[]; edges: CodeEdge[] };
  behavior: { nodes: BehavioralNode[]; metrics: BehaviorMetricPoint[] };
  decisions: DecisionNode[];
  team: TeamNode[];
  /** Per-customer learned preferences (M3) folded in for the agents. */
  preferences?: unknown;
  /** Anonymized shared patterns relevant to this task (post tenancy wall). */
  sharedPatterns?: unknown;
}

/**
 * Logical client over the polyglot substrate. Implementations fan a single
 * query across Neo4j / TimescaleDB / Postgres and assemble a RetrievedContext.
 */
export interface SubstrateClient {
  /** The unified cross-graph query that powers retrieval (the chargeCustomer example). */
  queryContext(ref: TaskRef): Promise<RetrievedContext>;

  // Per-graph accessors (used by specialists that need a narrow slice).
  getCodeNode(id: NodeId): Promise<CodeNode | null>;
  neighbors(id: NodeId, kinds?: CodeEdgeKind[]): Promise<CodeNode[]>;
  behaviorFor(codeNodeId: NodeId, range: TimeRange): Promise<BehaviorMetricPoint[]>;
  decisionsTouching(codeNodeId: NodeId, limit?: number): Promise<DecisionNode[]>;
  ownerOf(codeNodeId: NodeId): Promise<TeamNode | null>;
  semanticSearch(tenant: Tenant, query: string, k: number): Promise<DecisionNode[]>;
}
