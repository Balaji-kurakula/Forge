/**
 * InMemorySubstrateClient — a seeded, dependency-free implementation of SubstrateClient.
 *
 * Mirrors the `chargeCustomer` worked example from docs/architecture/03 & 10. Lets the
 * Retrieval Orchestrator and workflows run end-to-end (pnpm demo / tests) without standing
 * up Neo4j/Timescale/Postgres. The real DB-backed client is a Phase-1 item (see ROADMAP).
 */

import type {
  BehaviorMetricPoint,
  BehavioralNode,
  CodeEdge,
  CodeEdgeKind,
  CodeNode,
  DecisionNode,
  NodeId,
  RetrievedContext,
  SubstrateClient,
  TaskRef,
  TeamNode,
  Tenant,
  TimeRange,
} from "./graphs";

const TENANT: Tenant = "acme";
const FN: NodeId = "acme:code:function:payments/charge.go#chargeCustomer";
const CALLEE: NodeId = "acme:code:function:payments/charge.go#validateCard";
const CALLER: NodeId = "acme:code:function:checkout/order.go#placeOrder";
const ENDPOINT: NodeId = "acme:behavior:endpoint:POST /v1/charges";
const OWNER: NodeId = "acme:team:person:asha@acme.com";

const CODE_NODES: Record<NodeId, CodeNode> = {
  [FN]: {
    nodeId: FN,
    tenant: TENANT,
    kind: "function",
    name: "chargeCustomer",
    path: "payments/charge.go",
    language: "go",
    signatureHash: "a91f",
    ownerTeam: "payments",
    complexity: 7,
  },
  [CALLEE]: {
    nodeId: CALLEE,
    tenant: TENANT,
    kind: "function",
    name: "validateCard",
    path: "payments/charge.go",
    language: "go",
  },
  [CALLER]: {
    nodeId: CALLER,
    tenant: TENANT,
    kind: "function",
    name: "placeOrder",
    path: "checkout/order.go",
    language: "go",
  },
};

const CODE_EDGES: CodeEdge[] = [
  { tenant: TENANT, src: FN, dst: CALLEE, kind: "calls" },
  { tenant: TENANT, src: CALLER, dst: FN, kind: "calls" },
];

const BEHAVIOR_NODE: BehavioralNode = {
  nodeId: ENDPOINT,
  tenant: TENANT,
  kind: "endpoint",
  codeNodeId: FN,
};

const METRICS: BehaviorMetricPoint[] = [
  {
    nodeId: ENDPOINT,
    codeNodeId: FN,
    deploySha: "deadbeef",
    ts: "2026-06-01T00:00:00Z",
    latencyP99: 240,
    errorRate: 0.003,
    throughput: 1200,
  },
];

const DECISIONS: DecisionNode[] = [
  {
    nodeId: "acme:decision:pr:github/acme/payments#5012",
    tenant: TENANT,
    kind: "pr",
    title: "Add retry to chargeCustomer",
    url: "https://github.com/acme/payments/pull/5012",
    createdAt: "2026-05-28T12:00:00Z",
  },
  {
    nodeId: "acme:decision:pr:github/acme/payments#4980",
    tenant: TENANT,
    kind: "pr",
    title: "Refactor card validation",
    url: "https://github.com/acme/payments/pull/4980",
    createdAt: "2026-05-20T09:00:00Z",
  },
];

const TEAM_OWNER: TeamNode = {
  nodeId: OWNER,
  tenant: TENANT,
  kind: "person",
  name: "asha",
};

/** Seeded, read-only substrate for local runs. All four graphs resolve for chargeCustomer. */
export class InMemorySubstrateClient implements SubstrateClient {
  async queryContext(ref: TaskRef): Promise<RetrievedContext> {
    return {
      taskRef: ref,
      code: { nodes: Object.values(CODE_NODES), edges: CODE_EDGES },
      behavior: { nodes: [BEHAVIOR_NODE], metrics: METRICS },
      decisions: DECISIONS,
      team: [TEAM_OWNER],
    };
  }

  async getCodeNode(id: NodeId): Promise<CodeNode | null> {
    return CODE_NODES[id] ?? null;
  }

  async neighbors(id: NodeId, kinds?: CodeEdgeKind[]): Promise<CodeNode[]> {
    const want = kinds ? new Set(kinds) : null;
    const out: CodeNode[] = [];
    for (const e of CODE_EDGES) {
      if (want && !want.has(e.kind)) continue;
      const other = e.src === id ? e.dst : e.dst === id ? e.src : null;
      if (other) {
        const node = CODE_NODES[other];
        if (node) out.push(node);
      }
    }
    return out;
  }

  async behaviorFor(codeNodeId: NodeId, _range: TimeRange): Promise<BehaviorMetricPoint[]> {
    return METRICS.filter((m) => m.codeNodeId === codeNodeId);
  }

  async decisionsTouching(_codeNodeId: NodeId, limit = 5): Promise<DecisionNode[]> {
    return DECISIONS.slice(0, limit);
  }

  async ownerOf(_codeNodeId: NodeId): Promise<TeamNode | null> {
    return TEAM_OWNER;
  }

  async semanticSearch(_tenant: Tenant, query: string, k: number): Promise<DecisionNode[]> {
    const q = query.toLowerCase();
    return DECISIONS.filter((d) => (d.title ?? "").toLowerCase().includes(q)).slice(0, k);
  }
}
