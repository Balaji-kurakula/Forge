# 0002 — TypeScript + pnpm + Biome + Vitest

- **Status:** Accepted
- **Date:** 2026-06

## Context

The orchestration skeletons are TypeScript. Phase 0 needs them to compile, lint, and test with
minimal config sprawl, on a modern Node.

## Decision

- **Language:** TypeScript (strict, ESM, `moduleResolution: "Bundler"` so the existing
  extensionless imports stay valid with zero churn; `noEmit` — we type-check, we don't build).
- **Package manager:** pnpm, pinned via `packageManager` and driven by Corepack.
- **Lint + format:** Biome (one tool, no ESLint+Prettier split). Unused-var rules relaxed for the
  `_`-prefixed stub idiom.
- **Tests:** Vitest (native ESM/TS, fast).
- **Runner:** `tsx` for the demo script.

## Consequences

- `pnpm typecheck | check | test | demo` is the whole local loop; CI mirrors it.
- Biome reformats the hand-authored skeletons (whitespace only; ASCII-art comments are untouched).
- No bundler/emit step yet — added later when there's a deployable artifact.
- Polyglot runtime deps (neo4j-driver, pg, a Temporal SDK) are intentionally **not** installed yet;
  they arrive with the real implementations (see [ROADMAP](../ROADMAP.md)).
