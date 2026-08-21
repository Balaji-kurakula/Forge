/**
 * Neo4j Code Graph writer (L2, Phase 1).
 *
 * Takes the extractor's FileExtract[] and upserts a tenant-scoped Code Graph into Neo4j:
 * `:Code` nodes (kind file|function|class) + CALLS (function→function) and IMPORTS
 * (file→file) edges. Writes are idempotent MERGEs keyed on the cross-graph nodeId, so
 * re-indexing is safe. Call resolution is best-effort by symbol name (prefer same-file,
 * else a unique repo-wide match); ambiguous/unresolved calls are counted, not guessed.
 */

import neo4j, { type Driver } from "neo4j-driver";
import type { Tenant } from "../substrate/graphs";
import { type Neo4jConfig, neo4jConfigFromEnv } from "../substrate/stores/neo4j-client";
import type { FileExtract } from "./extract";

export interface IndexStats {
  files: number;
  symbols: number;
  callEdges: number;
  importEdges: number;
  unresolvedCalls: number;
}

interface GraphNode {
  nodeId: string;
  props: Record<string, string | number>;
}

const fileNodeId = (t: Tenant, p: string) => `${t}:code:file:${p}`;
const symNodeId = (t: Tenant, kind: string, p: string, name: string) =>
  `${t}:code:${kind}:${p}#${name}`;
const bare = (qualified: string) => qualified.split(".").pop() ?? qualified;

/** Resolve a relative import specifier to one of the indexed file paths, if possible. */
function resolveImport(fromPath: string, specifier: string, fileSet: Set<string>): string | null {
  if (!specifier.startsWith(".")) return null; // external / node_modules
  const dir = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : "";
  const segments = `${dir}/${specifier}`.split("/");
  const stack: string[] = [];
  for (const s of segments) {
    if (s === "" || s === ".") continue;
    if (s === "..") stack.pop();
    else stack.push(s);
  }
  const base = stack.join("/");
  for (const cand of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    if (fileSet.has(cand)) return cand;
  }
  return null;
}

export class Neo4jCodeGraphWriter {
  constructor(
    private readonly driver: Driver,
    private readonly tenant: Tenant,
  ) {}

  static fromEnv(config: Neo4jConfig = neo4jConfigFromEnv()): Neo4jCodeGraphWriter {
    const driver = neo4j.driver(config.uri, neo4j.auth.basic(config.user, config.password));
    return new Neo4jCodeGraphWriter(driver, config.tenant);
  }

  async close(): Promise<void> {
    await this.driver.close();
  }

  async ensureConstraints(): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        "CREATE CONSTRAINT code_node_id IF NOT EXISTS FOR (c:Code) REQUIRE c.nodeId IS UNIQUE",
      );
    } finally {
      await session.close();
    }
  }

  async indexFiles(extracts: FileExtract[], language = "typescript"): Promise<IndexStats> {
    const t = this.tenant;
    const fileSet = new Set(extracts.map((e) => e.path));

    // ── nodes ──
    const nodes: GraphNode[] = [];
    const byBareName = new Map<string, Array<{ nodeId: string; path: string }>>();

    for (const ex of extracts) {
      nodes.push({
        nodeId: fileNodeId(t, ex.path),
        props: { tenant: t, kind: "file", name: ex.path, path: ex.path, language },
      });
      for (const s of ex.symbols) {
        const nodeId = symNodeId(t, s.kind, s.path, s.name);
        nodes.push({
          nodeId,
          props: {
            tenant: t,
            kind: s.kind,
            name: s.name,
            path: s.path,
            language,
            line: s.line,
            signatureHash: s.signatureHash,
          },
        });
        if (s.kind === "function") {
          const list = byBareName.get(bare(s.name)) ?? [];
          list.push({ nodeId, path: s.path });
          byBareName.set(bare(s.name), list);
        }
      }
    }

    // ── CALLS edges (resolve callee by name) ──
    const callEdges: Array<{ from: string; to: string }> = [];
    let unresolvedCalls = 0;
    for (const ex of extracts) {
      for (const call of ex.calls) {
        const from = symNodeId(t, "function", ex.path, call.fromName);
        const candidates = byBareName.get(call.toName);
        if (!candidates || candidates.length === 0) {
          unresolvedCalls++;
          continue;
        }
        const sameFile = candidates.find((c) => c.path === ex.path);
        const target = sameFile ?? (candidates.length === 1 ? candidates[0] : undefined);
        if (!target) {
          unresolvedCalls++; // ambiguous repo-wide — don't guess
          continue;
        }
        callEdges.push({ from, to: target.nodeId });
      }
    }

    // ── IMPORTS edges (file → file) ──
    const importEdges: Array<{ from: string; to: string }> = [];
    for (const ex of extracts) {
      for (const imp of ex.imports) {
        const target = resolveImport(ex.path, imp.specifier, fileSet);
        if (target) {
          importEdges.push({ from: fileNodeId(t, ex.path), to: fileNodeId(t, target) });
        }
      }
    }

    const session = this.driver.session();
    try {
      await session.run(
        `UNWIND $nodes AS n
         MERGE (c:Code { nodeId: n.nodeId })
         SET c += n.props`,
        { nodes },
      );
      if (callEdges.length > 0) {
        await session.run(
          `UNWIND $edges AS e
           MATCH (a:Code { nodeId: e.from }), (b:Code { nodeId: e.to })
           MERGE (a)-[:CALLS]->(b)`,
          { edges: callEdges },
        );
      }
      if (importEdges.length > 0) {
        await session.run(
          `UNWIND $edges AS e
           MATCH (a:Code { nodeId: e.from }), (b:Code { nodeId: e.to })
           MERGE (a)-[:IMPORTS]->(b)`,
          { edges: importEdges },
        );
      }
    } finally {
      await session.close();
    }

    return {
      files: extracts.length,
      symbols: nodes.length - extracts.length,
      callEdges: callEdges.length,
      importEdges: importEdges.length,
      unresolvedCalls,
    };
  }
}
