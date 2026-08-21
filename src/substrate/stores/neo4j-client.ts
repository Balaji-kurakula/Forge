/**
 * Neo4jSubstrateClient — the real, Neo4j-backed Code Graph slice of SubstrateClient (Phase 1).
 *
 * Implements the Code-Graph methods against a live Neo4j (the indexer writes nodes/edges;
 * see src/indexer). The Behavioral / Decision / Team methods return empty for now — they get
 * wired to TimescaleDB / pgvector in Phase 2 (see docs/ROADMAP.md). Queries are keyed on the
 * cross-graph `nodeId` and are label-agnostic, so both indexed `:Code` nodes and the legacy
 * `:Function` seed resolve.
 */

import neo4j, { type Driver } from "neo4j-driver";
import type {
  BehaviorMetricPoint,
  CodeEdge,
  CodeEdgeKind,
  CodeKind,
  CodeNode,
  DecisionNode,
  NodeId,
  RetrievedContext,
  SubstrateClient,
  TaskRef,
  TeamNode,
  Tenant,
  TimeRange,
} from "../graphs";

export interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
  tenant: Tenant;
}

export function neo4jConfigFromEnv(): Neo4jConfig {
  return {
    uri: process.env.NEO4J_URI ?? "bolt://localhost:7687",
    user: process.env.NEO4J_USER ?? "neo4j",
    password: process.env.NEO4J_PASSWORD ?? "forge-dev-neo4j",
    tenant: process.env.FORGE_TENANT ?? "acme",
  };
}

type Props = Record<string, unknown>;

function toCodeNode(props: Props): CodeNode {
  return {
    nodeId: String(props.nodeId),
    tenant: String(props.tenant),
    kind: (props.kind as CodeKind) ?? "function",
    name: String(props.name ?? ""),
    path: String(props.path ?? ""),
    language: String(props.language ?? ""),
    signatureHash: props.signatureHash ? String(props.signatureHash) : undefined,
    lastModified: props.lastModified ? String(props.lastModified) : undefined,
  };
}

export class Neo4jSubstrateClient implements SubstrateClient {
  private readonly driver: Driver;

  constructor(
    driver: Driver,
    private readonly tenant: Tenant,
  ) {
    this.driver = driver;
  }

  static fromEnv(config: Neo4jConfig = neo4jConfigFromEnv()): Neo4jSubstrateClient {
    const driver = neo4j.driver(config.uri, neo4j.auth.basic(config.user, config.password));
    return new Neo4jSubstrateClient(driver, config.tenant);
  }

  async close(): Promise<void> {
    await this.driver.close();
  }

  async getCodeNode(id: NodeId): Promise<CodeNode | null> {
    const session = this.driver.session();
    try {
      const res = await session.run("MATCH (f {nodeId: $id}) RETURN f LIMIT 1", { id });
      const rec = res.records[0];
      return rec ? toCodeNode(rec.get("f").properties as Props) : null;
    } finally {
      await session.close();
    }
  }

  async neighbors(id: NodeId, kinds?: CodeEdgeKind[]): Promise<CodeNode[]> {
    const relTypes = kinds?.map((k) => k.toUpperCase()) ?? null;
    const session = this.driver.session();
    try {
      const res = await session.run(
        `MATCH (a {nodeId: $id})-[r]-(b)
         WHERE $relTypes IS NULL OR type(r) IN $relTypes
         RETURN DISTINCT b`,
        { id, relTypes },
      );
      return res.records.map((r) => toCodeNode(r.get("b").properties as Props));
    } finally {
      await session.close();
    }
  }

  async queryContext(ref: TaskRef): Promise<RetrievedContext> {
    const seeds = await this.resolveSeeds(ref.anchor);
    const nodes = new Map<NodeId, CodeNode>();
    const edges: CodeEdge[] = [];
    const seenEdge = new Set<string>();

    const session = this.driver.session();
    try {
      for (const seed of seeds) {
        const res = await session.run(
          `MATCH (a {nodeId: $seed})
           OPTIONAL MATCH (a)-[r]-(b)
           RETURN a,
             collect(CASE WHEN r IS NULL THEN NULL ELSE
               { type: type(r), src: startNode(r).nodeId, dst: endNode(r).nodeId, b: b } END) AS rels`,
          { seed },
        );
        for (const rec of res.records) {
          const a = toCodeNode(rec.get("a").properties as Props);
          nodes.set(a.nodeId, a);
          for (const rel of rec.get("rels") as Array<Props | null>) {
            if (!rel) continue;
            const b = toCodeNode((rel.b as { properties: Props }).properties);
            nodes.set(b.nodeId, b);
            const key = `${rel.src}->${rel.dst}:${rel.type}`;
            if (!seenEdge.has(key)) {
              seenEdge.add(key);
              edges.push({
                tenant: this.tenant,
                src: String(rel.src),
                dst: String(rel.dst),
                kind: String(rel.type).toLowerCase() as CodeEdgeKind,
              });
            }
          }
        }
      }
    } finally {
      await session.close();
    }

    return {
      taskRef: ref,
      code: { nodes: [...nodes.values()], edges },
      behavior: { nodes: [], metrics: [] }, // Phase 2 (TimescaleDB)
      decisions: [], // Phase 2 (pgvector)
      team: [], // Phase 2 (Postgres)
    };
  }

  /** Resolve a TaskRef anchor to seed nodeIds: a literal nodeId, else by symbol name. */
  private async resolveSeeds(anchor: string): Promise<NodeId[]> {
    if (anchor.includes(":code:")) return [anchor];
    const session = this.driver.session();
    try {
      const res = await session.run(
        `MATCH (f {tenant: $tenant})
         WHERE f.name = $name OR f.name ENDS WITH ('.' + $name)
         RETURN f.nodeId AS nodeId LIMIT 25`,
        { tenant: this.tenant, name: anchor },
      );
      return res.records.map((r) => String(r.get("nodeId")));
    } finally {
      await session.close();
    }
  }

  // ── Phase 2: the other three graphs live in TimescaleDB / pgvector / Postgres ──
  async behaviorFor(_codeNodeId: NodeId, _range: TimeRange): Promise<BehaviorMetricPoint[]> {
    return [];
  }
  async decisionsTouching(_codeNodeId: NodeId, _limit?: number): Promise<DecisionNode[]> {
    return [];
  }
  async ownerOf(_codeNodeId: NodeId): Promise<TeamNode | null> {
    return null;
  }
  async semanticSearch(_tenant: Tenant, _query: string, _k: number): Promise<DecisionNode[]> {
    return [];
  }
}
