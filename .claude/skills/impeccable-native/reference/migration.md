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
node .claude/skills/impeccable-native/scripts/migration/migration-scan.mjs --scope=<scope> [--brand-brief=.impeccable/brand-brief.json] --dir=.
```

This orchestrates four scripts in sequence:

1. **`migration-scope.mjs`** — Resolves the scope argument into a concrete flat list of screen and component files. For `flow:` scopes, reuses `/flow`'s navigation graph. For `routes:` scopes, applies the glob. For `app`, heuristic screen detection across the whole project. Produces the parts list the migration was built against.

2. **`shared/token-graph.mjs`** — Builds a token × file co-occurrence matrix, then clusters tokens that must migrate together using Jaccard similarity + connected-components. The key insight: `colors.primary` and `colors.onPrimary` that always appear together must migrate as a unit or the UI looks broken mid-flight. Clusters are the atomic migration unit for tokens. (Shared with `rebrand`.)

3. **`dependency-order.mjs`** — Builds an import DAG over the scope, detects cycles using Tarjan's SCC algorithm, classifies each cycle (shared-type | barrel | genuine), and emits a topologically-sorted phase plan. Leaves first, hot-path screens last. Genuine cycles that block ordering are surfaced as blockers — they must be resolved before the migration plan is valid.

4. **`shared/hardcoded-violations.mjs`** — Finds every place the codebase bypasses the token system: inline hex colors, rgb/hsl literals, magic spacing numbers, raw fontSizes, magic borderRadius values. These files won't respond to token changes. A severe verdict is a blocker: fix violations first, then re-run. (Shared with `rebrand`.)

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

> **Skip this step if `--brand-brief=<path>` was passed.** A brand brief produced by `/impeccable-native rebrand direction` already contains the position, the new token system with rationale per token, and the dispositions. Read it, present a one-screen summary to the developer for confirmation, then jump to Step 4. If no brief was supplied, derive the new system inline as described below.

With the brief in hand, design the new token system — this is `rethink`'s Step 1 at system scale.

- Write the **scene sentence** for the whole app: who uses it, under what conditions, what it should feel like. This drives the new system, not the old one.
- Decide the token axes to migrate. The brief's clusters tell you which tokens are semantically bonded and must move together. Design within clusters — don't propose migrating `colors.primary` without also designing `colors.onPrimary`.
- Pick a **dual-resident strategy**: the new tokens land alongside the old ones (`theme.v2`, `tokens.next`, or a namespace) before any screen changes. Zero screens change in this step. This is the safety net that makes per-phase migration reversible.
- For each cluster, propose disposition for every token:
  - **UPDATE** — change the value. State out-of-scope blast radius so the cost is visible.
  - **NEW** — add a new token alongside the existing one. Retrocompatible.
  - **RETIRE** — old token kept during migration, removed in cleanup commit.

Present the new token set to the developer for approval before any file is edited.

## Step 3.5: Author the Substitution Table

Before any file changes, derive the exact rewrite plan. The agent does this — not by holding the codebase in context, but by reading the scan data and the brief and computing the mapping deterministically.

### Inputs the agent already has

- `migration-token-graph.json` — every token in use, every file referencing it, every cluster.
- `migration-violations.json` — every hardcoded value with a `nearestToken` suggestion.
- `migration-scope.json` — the file list per phase.
- `brand-brief.json` — new token system with disposition per token (UPDATE / NEW / RETIRE).
- The project's styling approach (from `detect-rn-flavor.mjs` — `stylesheet | nativewind | restyle`).

### What to author

Write two files to `.impeccable/`:

**`substitution-table.json`** — the machine-readable plan. Shape:

```jsonc
{
  "version": "1.0",
  "generatedAt": "<ISO>",
  "sourceMigrationBrief": ".impeccable/migration-brief.json",
  "sourceBrandBrief": ".impeccable/brand-brief.json",
  "stylingApproach": "stylesheet" | "nativewind" | "restyle",

  "tokenFileChanges": [
    // Edits to the source-of-truth tokens file. Disposition: UPDATE.
    // One edit per token. Triggers no call-site rewrite — the name is unchanged.
    { "file": "src/theme/tokens.ts",
      "edits": [
        { "path": "colors.primary", "oldValue": "#3B82F6", "newValue": "#5B3FFF",
          "rationale": "shift from corporate blue to brand violet per direction 'Quiet Instrument'" }
      ] }
  ],

  "renameRules": [
    // Dotted-access rename. Disposition: NEW (with old retired in cleanup).
    { "id": "rename-1", "old": "colors.primary", "new": "colors.brand.primary",
      "fromCluster": "cluster-brand", "affectedFiles": ["app/a.tsx", "..."],
      "rationale": "..." }
  ],

  "classRules": [
    // NativeWind / className substitutions. Only present when stylingApproach=nativewind.
    { "id": "class-1", "old": "bg-blue-600", "new": "bg-brand-primary",
      "affectedFiles": ["..."] }
  ],

  "literalPromotions": [
    // Hardcoded violations whose value matches a new token exactly.
    { "id": "lit-1", "literal": "#3B82F6", "newTokenExpression": "tokens.colors.brand.primary",
      "confidence": "high", "affectedFiles": ["..."] }
  ],

  "ambiguous": [
    // Things the agent refused to auto-resolve. Developer decides before phase 1 runs.
    { "id": "amb-1", "issue": "colors.accent could map to brand.secondary OR feedback.highlight",
      "candidates": ["colors.brand.secondary", "colors.feedback.highlight"],
      "affectedFiles": ["..."] }
  ],

  "retirements": [
    // Tokens kept alive during phases, deleted in cleanup.
    { "old": "colors.primary", "deleteAfter": "cleanup-commit" }
  ],

  "destructuredUsage": [
    // Files that destructure tokens via `const { primary } = theme.colors;`.
    // The script defers these to the agent; alias tracking across functions
    // is the kind of thing that bites silently.
    { "file": "src/hooks/useTheme.ts", "reason": "destructured at line 14; needs manual review" }
  ]
}
```

**`substitution-plan.md`** — the human-readable review surface. Group by **what will visibly change**: rename rules first (largest footprint), then value updates, then literal promotions, then the ambiguous list the developer must resolve. Include the rationale inline. The developer reads the Markdown, edits the JSON if needed.

### Rules for authoring

- **Per-token rules, not per-site.** `{ old: "colors.primary", new: "colors.brand.primary", affectedFiles: [...] }` not one entry per line. The script expands at execution time. Compact and survives small codebase changes between table generation and execution.
- **Three rule kinds, separate arrays.** Dotted-access rename, classname swap, literal promotion. Don't unify — each script section handles one kind cleanly.
- **Destructured tokens go to the agent.** If the token graph shows a token referenced via `const { primary } = theme.colors`, add the file to `destructuredUsage` instead of `renameRules`. Alias tracking across modules is silent-bug territory.
- **Literal promotion only when confidence is high.** Auto-promote if the literal value matches a new token's value exactly. Anything else — close-but-not-equal hex, "this looks like spacing.lg" — goes to the ambiguous list.

### Approval gate

Present the plan to the developer:

> Substitution plan ready: N rename rules covering F files, V value updates, L literal promotions, A ambiguous cases. Read `.impeccable/substitution-plan.md` and confirm or edit `.impeccable/substitution-table.json` before phase 1 runs.

Do not proceed to Step 4 until the developer confirms.

---

## Step 4: Execute Phase by Phase

The `dependencyOrder.phases` in the brief is the execution plan. Each phase is one commit. **The agent does not rewrite files directly.** Instead, the agent authors a small per-phase script that imports from `migration/rewrite-helpers.mjs` and applies the substitution table to the phase's files.

This shape — agent-authored, project-specific script — exists for one reason: a universal `migrate-phase.mjs` would have to handle every styling library, every destructuring pattern, every edge case in every codebase. A per-project script only handles what *this* project actually does. The agent already knows the patterns from the scan data; forcing that knowledge through a generic engine throws it away.

### For each phase

**Step 4a: Author the per-phase script.**

Write `.impeccable/generated/migrate-phase-<N>.mjs`. It imports the helpers and wires together the substitution table's rules for this phase's files:

```js
// .impeccable/generated/migrate-phase-1.mjs — example
import fs from 'fs';
import path from 'path';
import {
  renameDottedAccess,
  replaceValueInTokensFile,
  replaceClassname,
  promoteLiteral,
  planChanges,
  applyChanges,
  emitReport,
  checkGitClean,
} from '<scripts_path>/migration/rewrite-helpers.mjs';

const rootDir = process.cwd();
const dryRun = !process.argv.includes('--commit');
const phase = 1;

const table = JSON.parse(fs.readFileSync('.impeccable/substitution-table.json', 'utf-8'));
const brief = JSON.parse(fs.readFileSync('.impeccable/migration-brief.json', 'utf-8'));
const phaseFiles = brief.dependencyOrder.phases.find(p => p.phase === phase).files;
const requiresAgent = [];

// Safety: refuse to mutate a dirty tree in commit mode.
if (!dryRun) {
  const git = checkGitClean(rootDir);
  if (!git.clean) { console.error(git.reason); process.exit(1); }
}

const plan = planChanges();

// 1) Apply value updates to the tokens file (phase 1 typically owns this).
for (const change of table.tokenFileChanges) {
  if (!phaseFiles.includes(change.file)) continue;
  const src = fs.readFileSync(path.resolve(rootDir, change.file), 'utf-8');
  for (const e of change.edits) {
    plan.add(change.file, replaceValueInTokensFile(src, e.path, e.newValue));
  }
}

// 2) Apply rename rules to every phase file that uses the old token.
for (const file of phaseFiles) {
  if (table.destructuredUsage.some(d => d.file === file)) {
    requiresAgent.push({ file, reason: 'destructured token usage' });
    continue;
  }
  const src = fs.readFileSync(path.resolve(rootDir, file), 'utf-8');
  for (const rule of table.renameRules) {
    if (!rule.affectedFiles.includes(file)) continue;
    plan.add(file, renameDottedAccess(src, rule.old, rule.new));
  }
  for (const rule of table.classRules ?? []) {
    if (!rule.affectedFiles.includes(file)) continue;
    plan.add(file, replaceClassname(src, rule.old, rule.new));
  }
  for (const promo of table.literalPromotions) {
    if (!promo.affectedFiles.includes(file)) continue;
    if (promo.confidence !== 'high') {
      requiresAgent.push({ file, reason: `literal ${promo.literal} needs review` });
      continue;
    }
    plan.add(file, promoteLiteral(src, promo.literal, promo.newTokenExpression));
  }
}

const results = applyChanges(plan, { rootDir, dryRun });
const { mdPath } = emitReport({ rootDir, phase, plan, applyResults: results, requiresAgent });

console.log(`Phase ${phase} ${dryRun ? 'dry-run' : 'committed'}: ${results.written.length} files, ${plan.editCount()} edits.`);
console.log(`Report: ${mdPath}`);
if (results.conflicts.length > 0) process.exit(2);
```

Each phase's script differs only in which files it processes and which rules apply. The agent regenerates it from the table per phase.

**Step 4b: Mandatory dry-run.**

Run the script in dry-run mode first (this is the default — `--commit` is required to write):

```bash
node .impeccable/generated/migrate-phase-<N>.mjs
```

Read `.impeccable/generated/phase-<N>-rewrite-report.md`. Surface to the developer:
- File count, edit count.
- Sample edits per kind (the report includes 5 per kind).
- Conflicts (overlapping edits — the script refused to apply these).
- Files in `requiresAgent` (destructured tokens, low-confidence literals).

Wait for developer confirmation. If they reject, edit the substitution table and re-run dry-run.

**Step 4c: Commit mode.**

When the developer approves:

```bash
node .impeccable/generated/migrate-phase-<N>.mjs --commit
```

The script refuses to run if the working tree has uncommitted changes (safety rail — you must commit anything else before applying).

**Step 4d: Agent handles the `requiresAgent` list.**

Open only those files. The agent has full context for these (typically 5–15 per phase, not 47). Apply the substitution table's intent with judgement. Commit those changes separately or amend.

**Step 4e: Verify.**

Re-run `shared/hardcoded-violations.mjs` over the phase's files — expect no new violations introduced. Run `/impeccable-native audit` on the touched files for the contrast / touch-target / platform-parity gate. If either fails, fix and re-verify before advancing.

**Step 4f: Annotate, commit, advance.**

Add a one-line comment `// migrated to v2 tokens — phase N` at the top of each touched file (the cleanup commit will sweep these). Commit the phase with a message including the phase number and rule counts. Move to phase N+1.

### Rules during execution

- **Never migrate a cluster partially.** If `cluster-brand` spans a file in phase 1 and a file in phase 2, the token value change happens in phase 1 (earliest consumer) — phase 2's file picks up the new value automatically because the rename rule is the same in both.
- **Honor the dual-resident shim.** Old token names stay valid throughout. Rollback at any phase = revert the phase's commits; no schema surgery needed.
- **Generated scripts are checked in.** `.impeccable/generated/` is part of the migration's audit trail. The developer (and a future reviewer) can read exactly what changed and replay the migration if needed.
- **Always dry-run before commit.** The script's default is dry-run. The agent must never invoke `--commit` without first reading the dry-run report and getting developer confirmation.

## Step 5: Cleanup

Only after every screen in scope passes audit on both platforms:

1. Delete the old token declarations.
2. Remove the dual-resident shim / namespace.
3. Sweep the `// migrated to v2 tokens` comments.
4. Run `/impeccable-native audit` across the full scope one final time.
5. **Rewrite `PRODUCT.md` and `DESIGN.md` to the new course.** This is the point at which the docs are allowed to follow the code. If a `brand-brief.json` was used, both files are rewritten from it — clean replace, no "superseded" section. Git history is the archive. After rewriting, run `/impeccable-native teach` and `/impeccable-native document` if either file becomes thin during the rewrite — they regenerate the structured fields the rest of the skill reads.

The cleanup commit is the point of no return. Warn the developer explicitly: "After this commit, rollback requires reverting multiple commits, re-adding the old token file, and restoring the previous PRODUCT.md / DESIGN.md from git history."

### Rewriting PRODUCT.md and DESIGN.md from a brand brief

When `--brand-brief=<path>` was used and Step 5.5 is running, derive each file's contents from the brief:

**PRODUCT.md** — pull from `position`:
- `users` and `principles` reflect `position.sceneSentence` and the rephrased one-paragraph position.
- `brand` lists `position.is` and `position.isNot` so future commands have an explicit ban list.
- `platform-fidelity` reflects `axes.convention` (inherits-platform / mostly-platform / distinct).
- Include the new `appType` (tool / companion / stage) so downstream commands inherit the stance.

**DESIGN.md** — pull from `tokens`:
- Color section uses the cluster names and disposition rationale. Include hex values *and* the `why` for each token so future audits can defend the choice.
- Type, spacing, radius, motion, elevation sections each take their respective token block. Include the `why` per section, not just the values.
- Rules section copies `rules.ruledOut` verbatim — that's the explicit anti-position.

Do not include the old guidance. Do not append a "superseded" section. The brief is the new source of truth; the previous `PRODUCT.md` / `DESIGN.md` live in git history, which is sufficient.

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
