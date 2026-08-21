# 0003 — Activities injection seam in workflows

- **Status:** Accepted
- **Date:** 2026-06

## Context

The workflow skeletons originally hard-imported the activity module (`import * as activities`).
That mirrors Temporal codegen but makes the workflows untestable and un-runnable without real
side-effecting activities (which all throw `not implemented`).

## Decision

Each workflow takes activities as an **optional final parameter** defaulting to the real module,
and merges any overrides over the defaults:

```ts
import * as defaultActivities from "../activities";
export type Activities = typeof defaultActivities;

export async function codeReviewWorkflow(input, overrides: Partial<Activities> = {}) {
  const acts = { ...defaultActivities, ...overrides };
  // ... use acts.*
}
```

Fakes implement only the activities a given workflow exercises; anything un-faked still throws,
which is the correct signal in a skeleton.

## Consequences

- The CodeReview workflow runs end-to-end against in-memory fakes (`pnpm demo`, tests).
- Conceptually equivalent to Temporal's `proxyActivities` injection — production wiring swaps the
  default module for proxied activities without changing workflow bodies.
- Workflows depend on a single shared `Activities` type (exported from the CodeReview workflow) to
  avoid restating `typeof defaultActivities` everywhere.
