# Migration

Rethink and replace an app's design system across an entire flow or the whole app — with scripts that map every corner of the token surface, compute safe migration order, and gate each phase on verification before proceeding.

`migration` is not `rethink` at scale. `rethink` is one component, one decision. `migration` inverts the relationship: the blast radius IS the work. You are not asking "can I change this token without breaking things?" — you are saying "I am changing the entire system; tell me everything that has to move with it, in what order, and how to verify each step doesn't regress."

Use `migration` when:
- The app's design system is wrong at the concept level — not just a screen or component.
- The team wants to adopt a new theming approach (StyleSheet → NativeWind, custom tokens → Restyle).
- A rebrand requires updating every color, type, and spacing token across multiple flows.
- The existing token surface is inconsistent and needs to be replaced with a coherent system.

Do not use `migration` when `rethink` is enough. If the problem is one component or one screen, that's `rethink`. `migration` is for when the whole system is the problem.

## Before You Start: Declare the Scope

`migration` requires an explicit `--scope` argument. Refusing to run without it prevents the "I thought we were just doing onboarding" disaster.

Scope forms:
- `--scope=app` — every screen reachable from the entry point
- `--scope=flow:onboarding` — screens in a named flow (leverages `/flow` output)
- `--scope=routes:settings/**` — a file-path glob
- `--scope=tokens:color` — every file referencing a specific token axis

Confirm the scope with the developer before running the scan. Scope changes after the brief is generated mean re-running everything.

## Step 1: Run the Migration Scan

```bash
node .claude/skills/impeccable-native/scripts/migration/migration-scan.mjs --scope=<scope> --dir=.
```

This orchestrates four scripts in sequence:

1. **`migration-scope.mjs`** — Resolves the scope argument into a concrete flat list of screen and component files. For `flow:` scopes, reuses `/flow`'s navigation graph. For `routes:` scopes, applies the glob. For `app`, heuristic screen detection across the whole project. Produces the parts list the migration was built against.

2. **`token-graph.mjs`** — Builds a token × file co-occurrence matrix, then clusters tokens that must migrate together using Jaccard similarity + connected-components. The key insight: `colors.primary` and `colors.onPrimary` that always appear together must migrate as a unit or the UI looks broken mid-flight. Clusters are the atomic migration unit for tokens.

3. **`dependency-order.mjs`** — Builds an import DAG over the scope, detects cycles using Tarjan's SCC algorithm, classifies each cycle (shared-type | barrel | genuine), and emits a topologically-sorted phase plan. Leaves first, hot-path screens last. Genuine cycles that block ordering are surfaced as blockers — they must be resolved before the migration plan is valid.

4. **`hardcoded-violations.mjs`** — Finds every place the codebase bypasses the token system: inline hex colors, rgb/hsl literals, magic spacing numbers, raw fontSizes, magic borderRadius values. These files won't respond to token changes. A severe verdict is a blocker: fix violations first, then re-run.

Output: `.impeccable/migration-brief.json` — the snapshot the migration plan is built against. Do not re-scan between phases; the brief is the single source of truth for the entire migration.

## Step 2: Read the Migration Brief

The brief's `summary.readinessVerdict` determines what happens next:

| Verdict | Meaning | Action |
|---|---|---|
| `ready` | Clean enough to migrate | Proceed to Step 3 |
| `violations-first` | Severe hardcoded values | Present violations list, ask developer to fix, then re-scan |
| `cycles-first` | Blocking genuine cycles | Present cycle details and resolution options, fix, then re-scan |
| `blockers` | Multiple blockers | Address in order: cycles first, then violations |

Never skip blockers. Present them with specific file:line references so the developer can act. Only proceed to Step 3 after the developer confirms or after a clean re-scan.

## Step 3: Design the New System

With the brief in hand, design the new token system — this is `rethink`'s Step 1 at system scale.

- Write the **scene sentence** for the whole app: who uses it, under what conditions, what it should feel like. This drives the new system, not the old one.
- Decide the token axes to migrate. The brief's clusters tell you which tokens are semantically bonded and must move together. Design within clusters — don't propose migrating `colors.primary` without also designing `colors.onPrimary`.
- Pick a **dual-resident strategy**: the new tokens land alongside the old ones (`theme.v2`, `tokens.next`, or a namespace) before any screen changes. Zero screens change in this step. This is the safety net that makes per-phase migration reversible.
- For each cluster, propose disposition for every token:
  - **UPDATE** — change the value. State out-of-scope blast radius so the cost is visible.
  - **NEW** — add a new token alongside the existing one. Retrocompatible.
  - **RETIRE** — old token kept during migration, removed in cleanup commit.

Present the new token set to the developer for approval before any file is edited.

## Step 4: Execute Phase by Phase

The `dependencyOrder.phases` in the brief is the execution plan. Follow it strictly — it was computed to minimize mid-migration breakage.

For each phase:
1. Migrate the files in the phase (apply the new tokens, update imports, swap className/style references to the new system).
2. Gate on `/impeccable-native audit <file>` for each migrated file — the migration is not allowed to regress touch targets, contrast, or platform parity even if the new design was approved.
3. Confirm with the developer before advancing to the next phase. Each phase is its own commit.

Rules during execution:
- **Never migrate a cluster partially.** If `cluster-brand` spans a file in phase 1 and a file in phase 2, the token value change happens in phase 1 (earliest consumer) — phase 2's file picks up the new value automatically.
- **Honor the dual-resident shim.** Old token names stay valid throughout. Rollback at any phase = revert the phase's commits; no schema surgery needed.
- **Annotate migrated files.** Add a one-line comment `// migrated to v2 tokens — phase N` so the cleanup commit knows what to sweep.

## Step 5: Cleanup

Only after every screen in scope passes audit on both platforms:

1. Delete the old token declarations.
2. Remove the dual-resident shim / namespace.
3. Sweep the `// migrated to v2 tokens` comments.
4. Run `/impeccable-native audit` across the full scope one final time.

The cleanup commit is the point of no return. Warn the developer explicitly: "After this commit, rollback requires reverting multiple commits and re-adding the old token file."

## What `migration` Is NOT

- Not a refactor tool — code structure is not in scope, only the design token surface.
- Not a `rethink` for multiple screens — if it's one screen, use `rethink`.
- Not an audit — `audit` runs *inside* migration phases, not the other way around.
- Not automatic — every phase requires explicit developer go/no-go. The command's value is the plan and the verification harness.

## Resuming a Migration

Migrations span days. The brief survives sessions:

```bash
node .claude/skills/impeccable-native/scripts/migration/migration-scan.mjs --scope=<original-scope> --dir=.
```

Re-running the scan regenerates the brief. Check the new brief against the original — if the phase plan changed, surface the diff to the developer before continuing.

**NEVER**:
- Run without an explicit `--scope`.
- Proceed past a `violations-first` or `cycles-first` verdict without developer acknowledgment.
- Migrate a token cluster partially across phases.
- Introduce a second theming system alongside the existing one during migration.
- Skip the `audit` gate between phases — regressions compound across phases and become impossible to attribute.
- Perform the cleanup commit before every screen in scope passes audit on both platforms.
