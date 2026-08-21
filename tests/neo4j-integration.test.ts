/**
 * Neo4j integration test — exercises the real writer + SubstrateClient against a live DB.
 *
 * Gated on FORGE_TEST_NEO4J so CI (which has no Neo4j) skips it. Run locally with:
 *   pnpm db:up
 *   FORGE_TEST_NEO4J=1 pnpm test
 * Uses an isolated tenant so it never touches indexed `acme` data; writes are idempotent.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FileExtract } from "../src/indexer/extract";
import { Neo4jCodeGraphWriter } from "../src/indexer/neo4j-writer";
import { Neo4jSubstrateClient, neo4jConfigFromEnv } from "../src/substrate/stores/neo4j-client";

const RUN = Boolean(process.env.FORGE_TEST_NEO4J);
const TENANT = "forge-itest";
const cfg = { ...neo4jConfigFromEnv(), tenant: TENANT };

const fixture: FileExtract[] = [
  {
    path: "a.ts",
    symbols: [
      {
        kind: "function",
        name: "foo",
        path: "a.ts",
        line: 1,
        signature: "foo()",
        signatureHash: "h1",
      },
      {
        kind: "function",
        name: "bar",
        path: "a.ts",
        line: 5,
        signature: "bar()",
        signatureHash: "h2",
      },
    ],
    calls: [{ fromName: "foo", toName: "bar" }],
    imports: [],
  },
];

describe.skipIf(!RUN)("Neo4j Code Graph integration", () => {
  const writer = Neo4jCodeGraphWriter.fromEnv(cfg);
  const client = Neo4jSubstrateClient.fromEnv(cfg);

  beforeAll(async () => {
    await writer.ensureConstraints();
    await writer.indexFiles(fixture);
  });

  afterAll(async () => {
    await writer.close();
    await client.close();
  });

  it("reads back a written symbol by nodeId", async () => {
    const node = await client.getCodeNode(`${TENANT}:code:function:a.ts#foo`);
    expect(node?.name).toBe("foo");
    expect(node?.kind).toBe("function");
  });

  it("resolves a CALLS neighbor", async () => {
    const neighbors = await client.neighbors(`${TENANT}:code:function:a.ts#foo`, ["calls"]);
    expect(neighbors.map((n) => n.name)).toContain("bar");
  });

  it("assembles a RetrievedContext code slice via queryContext", async () => {
    const ctx = await client.queryContext({ tenant: TENANT, anchor: "foo", kind: "freeText" });
    expect(ctx.code.nodes.map((n) => n.name)).toContain("foo");
    expect(ctx.code.edges.some((e) => e.kind === "calls")).toBe(true);
  });
});
