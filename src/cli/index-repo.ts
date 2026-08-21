/**
 * `pnpm index [dir]` — index a local TypeScript tree into the Neo4j Code Graph.
 *
 * Walks the directory (default: src), parses each .ts/.tsx with web-tree-sitter, and
 * upserts a tenant-scoped Code Graph into the Neo4j you started with `pnpm db:up`.
 * Connection comes from env (NEO4J_URI/USER/PASSWORD, FORGE_TENANT) — see .env.example.
 *
 * Phase 1, docs/ROADMAP.md. Dogfoods on Forge's own source.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { type FileExtract, extractFromSource, getTypeScriptParser } from "../indexer/extract";
import { Neo4jCodeGraphWriter } from "../indexer/neo4j-writer";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "coverage", ".vitest"]);

function loadDotEnv(): void {
  try {
    (process as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env");
  } catch {
    // no .env — env defaults apply
  }
}

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(full);
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      yield full;
    }
  }
}

async function main(): Promise<void> {
  loadDotEnv();
  const root = process.argv[2] ?? "src";
  const absRoot = path.resolve(root);
  const parser = await getTypeScriptParser();

  const extracts: FileExtract[] = [];
  for await (const file of walk(absRoot)) {
    const source = await readFile(file, "utf8");
    const rel = path.relative(process.cwd(), file).split(path.sep).join("/");
    extracts.push(extractFromSource(parser, rel, source));
  }

  console.log(`Parsed ${extracts.length} files under ${root}/. Writing to Neo4j…`);

  const writer = Neo4jCodeGraphWriter.fromEnv();
  try {
    await writer.ensureConstraints();
    const stats = await writer.indexFiles(extracts);
    console.log("\nCode Graph indexed:");
    console.log(`  files:           ${stats.files}`);
    console.log(`  symbols:         ${stats.symbols}`);
    console.log(`  CALLS edges:     ${stats.callEdges}`);
    console.log(`  IMPORTS edges:   ${stats.importEdges}`);
    console.log(
      `  unresolved calls:${stats.unresolvedCalls} (external or ambiguous — not guessed)`,
    );
  } finally {
    await writer.close();
  }
}

main().catch((err) => {
  console.error("index failed:", err);
  process.exitCode = 1;
});
