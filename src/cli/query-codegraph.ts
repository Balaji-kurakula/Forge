/**
 * `pnpm graph [symbol]` — query the live Neo4j Code Graph via the real SubstrateClient.
 *
 * Resolves a symbol name (or a literal nodeId) to its neighborhood and prints the nodes
 * and edges the Retrieval Orchestrator would assemble. Run `pnpm index` first.
 *
 * Phase 1, docs/ROADMAP.md.
 */

import { Neo4jSubstrateClient, neo4jConfigFromEnv } from "../substrate/stores/neo4j-client";

function loadDotEnv(): void {
  try {
    (process as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env");
  } catch {
    // no .env — env defaults apply
  }
}

async function main(): Promise<void> {
  loadDotEnv();
  const anchor = process.argv[2] ?? "extractFromSource";
  const { tenant } = neo4jConfigFromEnv();
  const client = Neo4jSubstrateClient.fromEnv();

  try {
    const ctx = await client.queryContext({
      tenant,
      anchor,
      kind: anchor.includes(":code:") ? "symbol" : "freeText",
    });

    console.log(`Code Graph context for "${anchor}" (tenant: ${tenant})\n`);
    console.log(`Nodes (${ctx.code.nodes.length}):`);
    for (const n of ctx.code.nodes) {
      console.log(`  • [${n.kind}] ${n.name}  (${n.path})`);
    }
    console.log(`\nEdges (${ctx.code.edges.length}):`);
    for (const e of ctx.code.edges) {
      const src = e.src.split("#").pop() ?? e.src;
      const dst = e.dst.split("#").pop() ?? e.dst;
      console.log(`  • ${src} --${e.kind}--> ${dst}`);
    }
    if (ctx.code.nodes.length === 0) {
      console.log("\n(No match. Did you run `pnpm index` first? Try a symbol like `verify`.)");
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("query failed:", err);
  process.exitCode = 1;
});
