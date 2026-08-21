/**
 * TypeScript → Code Graph extractor (L2, Phase 1).
 *
 * Parses TS/TSX with web-tree-sitter (WASM, no native build) and extracts the
 * Code Graph primitives: function/class symbols, intra-file CALLS edges, and
 * file-level IMPORTS edges. Pure and dependency-light so it can be unit-tested
 * without Neo4j (see tests/extract.test.ts).
 *
 * Mirrors docs/architecture/02-indexing-cdc.md (Git CDC → AST re-parse).
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import Parser from "web-tree-sitter";

/** Minimal structural view of a tree-sitter node (avoids coupling to the exact d.ts). */
interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  childCount: number;
  child(i: number): TsNode | null;
  childForFieldName(field: string): TsNode | null;
}

export type SymbolKind = "function" | "class";

export interface ExtractedSymbol {
  kind: SymbolKind;
  /** Qualified within the file: `Class.method` for methods, else the bare name. */
  name: string;
  path: string;
  line: number; // 1-based
  signature: string;
  signatureHash: string;
}

export interface ExtractedCall {
  fromName: string; // qualified caller symbol name
  toName: string; // callee identifier (resolved to a node at write time, best-effort)
}

export interface ExtractedImport {
  /** Module specifier as written, e.g. "../substrate/graphs". */
  specifier: string;
}

export interface FileExtract {
  path: string;
  symbols: ExtractedSymbol[];
  calls: ExtractedCall[];
  imports: ExtractedImport[];
}

let parserPromise: Promise<Parser> | null = null;

/** Lazily initialize a TS parser (singleton). web-tree-sitter init is async. */
export async function getTypeScriptParser(): Promise<Parser> {
  if (!parserPromise) {
    parserPromise = (async () => {
      const require = createRequire(import.meta.url);
      const runtimeWasm = require.resolve("web-tree-sitter/tree-sitter.wasm");
      await Parser.init({ locateFile: () => runtimeWasm });

      const grammarDir = path.join(
        path.dirname(require.resolve("tree-sitter-wasms/package.json")),
        "out",
      );
      const lang = await Parser.Language.load(
        await readFile(path.join(grammarDir, "tree-sitter-typescript.wasm")),
      );
      const parser = new Parser();
      parser.setLanguage(lang);
      return parser;
    })();
  }
  return parserPromise;
}

function field(node: TsNode, name: string): TsNode | null {
  return node.childForFieldName(name);
}

function nameOf(node: TsNode): string | null {
  return field(node, "name")?.text ?? null;
}

function sigHash(signature: string): string {
  return createHash("sha1").update(signature).digest("hex").slice(0, 12);
}

/** Does this node open a named function/class scope? Returns the scope, else null. */
function scopeOf(node: TsNode): { kind: SymbolKind; name: string } | null {
  switch (node.type) {
    case "function_declaration":
    case "generator_function_declaration": {
      const name = nameOf(node);
      return name ? { kind: "function", name } : null;
    }
    case "method_definition": {
      const name = nameOf(node);
      return name ? { kind: "function", name } : null;
    }
    case "class_declaration": {
      const name = nameOf(node);
      return name ? { kind: "class", name } : null;
    }
    case "variable_declarator": {
      const value = field(node, "value");
      if (value && (value.type === "arrow_function" || value.type === "function_expression")) {
        const name = nameOf(node);
        return name ? { kind: "function", name } : null;
      }
      return null;
    }
    default:
      return null;
  }
}

function signatureFor(node: TsNode, name: string): string {
  // For arrow/function-expression declarators, look at the value node for params/return.
  const value = field(node, "value");
  const src = value ?? node;
  const params = field(src, "parameters")?.text ?? "()";
  const ret = field(src, "return_type")?.text ?? "";
  return `${name}${params}${ret}`.replace(/\s+/g, " ").trim();
}

function calleeName(call: TsNode): string | null {
  const callee = field(call, "function");
  if (!callee) return null;
  if (callee.type === "identifier") return callee.text;
  if (callee.type === "member_expression") return field(callee, "property")?.text ?? null;
  return null;
}

function children(node: TsNode): TsNode[] {
  const out: TsNode[] = [];
  for (let i = 0; i < node.childCount; i++) {
    const c = node.child(i);
    if (c) out.push(c);
  }
  return out;
}

/** Parse one source file and extract its Code Graph contribution. */
export function extractFromSource(parser: Parser, filePath: string, source: string): FileExtract {
  const tree = parser.parse(source);
  const root = tree?.rootNode as unknown as TsNode | undefined;
  const result: FileExtract = { path: filePath, symbols: [], calls: [], imports: [] };
  if (!root) return result;

  const classStack: string[] = [];
  const fnStack: string[] = []; // qualified caller names

  const walk = (node: TsNode): void => {
    if (node.type === "import_statement") {
      const spec = field(node, "source")?.text;
      if (spec) result.imports.push({ specifier: spec.replace(/^['"]|['"]$/g, "") });
    }

    if (node.type === "call_expression") {
      const to = calleeName(node);
      const from = fnStack[fnStack.length - 1];
      if (to && from) result.calls.push({ fromName: from, toName: to });
    }

    const scope = scopeOf(node);
    let pushedFn = false;
    let pushedClass = false;

    if (scope) {
      if (scope.kind === "class") {
        classStack.push(scope.name);
        pushedClass = true;
        result.symbols.push({
          kind: "class",
          name: scope.name,
          path: filePath,
          line: node.startPosition.row + 1,
          signature: scope.name,
          signatureHash: sigHash(scope.name),
        });
      } else {
        const qualified =
          classStack.length > 0 ? `${classStack[classStack.length - 1]}.${scope.name}` : scope.name;
        const signature = signatureFor(node, qualified);
        result.symbols.push({
          kind: "function",
          name: qualified,
          path: filePath,
          line: node.startPosition.row + 1,
          signature,
          signatureHash: sigHash(signature),
        });
        fnStack.push(qualified);
        pushedFn = true;
      }
    }

    for (const c of children(node)) walk(c);

    if (pushedFn) fnStack.pop();
    if (pushedClass) classStack.pop();
  };

  walk(root);
  return result;
}
