# Design-System

Design — or improve — a component layer that exists for a reason. Not a generic kit. Every atom, molecule, and organism has to earn its place by serving a *purpose-slot* tied to the app's product goals and success metrics.

The hard part of a design system is not naming things atoms and molecules. It is answering, for every component the app contains: *what does this exist to do, and is the app worse off without it?* This command makes that question answerable — deterministically for what's in the code, semantically for what it means.

Use `design-system` when:
- A new app needs a component layer designed *from purpose*, not from a generic checklist.
- An existing app has a folder of components and nobody is sure which ones earn their place, which overlap, which are missing, and which are doing the wrong job.
- A rebrand or product pivot has changed the journey and the component layer needs to be re-evaluated against the new intent.

Do not use `design-system` for tokens (`/rebrand`, `/migration`), for a single component (`/rethink`, `/break`), or for visual polish (`/polish`, `/bolder`, `/quieter`).

---

## The two-purpose problem

`design-system` serves two scenarios from the same conceptual base:

| Scenario | Question it answers |
|---|---|
| **Greenfield** (no components yet) | What components *should* this app have, given its purpose? |
| **Brownfield** (components already exist) | Do the components we have earn their place? What's missing? What's redundant? |

Both scenarios share the same first question: *what would be meaningful to have here?* The branching only happens at evidence-collection time — greenfield projects skip the inventory step because there is nothing to inventory. Everything downstream (charter, slots, judgment, proposals) is identical.

---

## Conceptual model

```
PRODUCT.md  ──┐
              ├──► DESIGN-SYSTEM.md  (charter: slots, purposes, success criteria)
user goals ──┘                              │
                                            ▼
                              ┌─────────────────────────────┐
                              │  SLOTS TABLE (what we need) │
                              └──────────────┬──────────────┘
                                             │ joined by purpose
                              ┌──────────────┴──────────────┐
                              │ COMPONENTS TABLE (what we   │
                              │ have — mapped deterministi- │
                              │ cally from the codebase)    │
                              └──────────────┬──────────────┘
                                             ▼
                                   VERDICT: gaps, orphans,
                                   redundancies, mis-purposed
                                             ▼
                                      proposal / action
```

Three contracts hold this together:

1. **Purpose precedes inventory.** The charter (`DESIGN-SYSTEM.md`) is written *before* any judgment is rendered. A component cannot be evaluated against a vacuum.
2. **Determinism over agentic search.** The component inventory is produced by scripts, not by agents grepping around. The skill turn is allowed to write a custom mapper *once* if no shipped scenario matches the repo, but from then on the mapper is the source of truth.
3. **Single point of inference.** The inventory is computed once per change to the component roots, written to `.impeccable/design-system/inventory.json`, and read from cache on every subsequent step. Cache invalidation is by git tree-hash, not heuristics.

---

## Invocation

```
/impeccable-native design-system
```

The command takes no required arguments. On invocation, the skill consults a **per-repo state script** that inspects what exists on disk and emits a recommended next action. The skill turn does not guess — it reads the recommendation and either proceeds or asks the user to override.

### The state script is synthesized once, then deterministic

Rather than ship a generic `state.mjs` that probes a fixed list of paths (which fails the moment a repo uses a monorepo layout, keeps docs in `docs/`, or otherwise deviates from defaults), the skill **synthesizes a tailored `state.mjs` for each repo on first invocation** — and persists it. Every subsequent run uses that script with zero RAG.

```
.impeccable/design-system/state.mjs   ← synthesized on first run, persists per repo
```

**First invocation (no `state.mjs` yet):**

1. Skill turn does a one-shot RAG pass to locate the relevant files in this repo:
   - Where is `PRODUCT.md`? (Could be root, `docs/`, `apps/mobile/`, etc.)
   - Where will `DESIGN-SYSTEM.md` live? (Same dir as `PRODUCT.md`.)
   - Where are the component roots? (Uses shipped scenarios as *hints*, not gates.)
   - Is this a monorepo? If yes, which package(s) does the charter govern?
   - Does the repo use `.impeccable/`, `.agents/`, or something else for generated artifacts?
2. Skill synthesizes `.impeccable/design-system/state.mjs` — a small script that knows *where everything lives in this repo* and nothing else. It imports the shared decision-table library; it does not duplicate it.
3. Skill runs the synthesized script, reads the recommendation, proceeds.

**Every subsequent invocation:**

```
node .impeccable/design-system/state.mjs --dir=.
```

No RAG, no exploration. The script reads its baked-in paths and emits the JSON blob.

### Self-check on every run

Every synthesized `state.mjs` begins with an `assertPaths()` call. It re-verifies that the file locations it was built around still hold — `PRODUCT.md` is still at the expected path, the component roots still exist, etc. If any assertion fails (the user moved files, restructured the monorepo, deleted a directory), the script exits with:

```json
{ "recommended_action": "resynthesize-state", "reason": "PRODUCT.md no longer at expected path apps/mobile/PRODUCT.md" }
```

The skill turn then redoes the RAG pass and rewrites `state.mjs`. The system self-heals; the user is never running against silently stale assumptions.

### Facts only, not rules

The synthesized `state.mjs` is **facts only**. It encodes:
- Absolute paths to `PRODUCT.md`, `DESIGN-SYSTEM.md`, `inventory.json`, `mapper.mjs`, `judgment.json`.
- The list of component roots for this repo.
- The git tree-hash command appropriate for this repo (handles monorepo subtrees).

The **recommendation logic is shared library code** — `.cursor/skills/impeccable-native/scripts/design-system/state-rules.mjs`. Synthesized scripts import it; the decision table stays uniform across all repos. Fixing a bug in the rules fixes it everywhere.

The shared decision table (top match wins):

| Condition | Recommended action |
|---|---|
| `assertPaths()` fails | `resynthesize-state` |
| No `PRODUCT.md` | `refuse` — point at `/shape` |
| No charter | `charter` |
| Charter exists, layout detected, no inventory | `inventory` |
| Inventory exists, tree-hash mismatch | `refresh-inventory` |
| Inventory fresh, no judgment | `judge` |
| Judgment exists with pending proposals | `resume` |
| Everything done, all proposals applied | `idle` |

### Charter-staleness FYI (non-blocking)

Independent of the `recommended_action`, the script computes whether `PRODUCT.md` has been edited since the charter was last written. When the skill writes `DESIGN-SYSTEM.md`, it stamps the file with a hash of `PRODUCT.md`:

```yaml
---
derived_from_product_md_hash: a1b2c3d4...
---
```

On every run, `state.mjs` recomputes the current hash of `PRODUCT.md` and compares to the stamp. Mismatch → it adds a `charter_may_be_stale: true` flag with a short reason to its JSON output, but **does not** override the recommended action. The skill turn surfaces this to the user as an FYI ("PRODUCT.md has changed since the charter was last written — consider running `refresh-charter`"), then proceeds with the main recommendation. The user decides whether to act on it.

### What runs on bare invocation

1. If `.impeccable/design-system/state.mjs` does not exist → skill turn synthesizes it (one-shot RAG).
2. Run the script.
3. If recommendation is `resynthesize-state` → re-synthesize, re-run.
4. Otherwise: surface the recommendation and the reason to the user, get a one-word confirmation, then proceed.

The user can always override by stating intent explicitly ("refresh the charter", "just give me the inventory", "skip to proposals") — but the default path is deterministic and requires no RAG beyond the one-shot synthesis.

---

## Act 1 — Charter

**Goal:** produce or refresh `DESIGN-SYSTEM.md`, the contract every component is judged against.

**Inputs:** `PRODUCT.md` is required. If absent, refuse and point the user at `/shape` to produce one. The charter is not a vibes document — it has to be anchored in stated product goals and success metrics.

**Process:**
1. Read `PRODUCT.md`. Extract the journey phases, the success metrics, and the user actions the product depends on.
2. Run a short interview (5–7 questions) calibrated to the gap between `PRODUCT.md` and what we'd need to author a charter. Examples:
   - "Your PRODUCT.md says activation depends on users completing X. What component does that step live in today / should live in?"
   - "Which moments in the journey are the highest-stakes — where the UI has to *confirm* something, not just *inform*?"
   - "Are there interactions the product needs that don't fit a standard control? (multi-step capture, deferred actions, etc.)"
3. Write `DESIGN-SYSTEM.md`. The charter has one table: **slots**.

### Slot shape

Each slot is a row with these columns:

| Column | Meaning |
|---|---|
| `id` | Stable kebab-case identifier (`commit-confirm`, `browse-empty-state`). |
| `interaction_kind` | One of: **action**, **inform**, **navigate**, **confirm**, **capture**. |
| `journey_phase` | The phase from PRODUCT.md this slot belongs to (`onboarding`, `browse`, `decide`, `commit`, `recover`, or whatever the journey uses). |
| `purpose` | One sentence: what the slot exists to make possible. |
| `success_criteria` | One or two measurable conditions. "User can dismiss in one tap." "Reads in <2 seconds." "Survives a network failure mid-capture." |
| `notes` | Free text. Edge cases, anti-patterns, prior decisions. |

The five interaction kinds are deliberately small. If a slot doesn't fit one of them, the slot is probably two slots.

**Output:** `DESIGN-SYSTEM.md` at the repo root, next to `PRODUCT.md`.

---

## Act 2 — Inventory

**Goal:** produce `.impeccable/design-system/inventory.json` — a deterministic, cacheable map of every component the codebase contains, with no judgment attached.

### Greenfield vs unknown-layout

Before running the inventory, the skill must distinguish two superficially-similar cases:

| Case | Symptom | What to do |
|---|---|---|
| **True greenfield** | No JSX/TSX component files anywhere in the repo | Skip the inventory entirely. Proceed to Act 3 with an empty components table. The judgment becomes "here is what you should build." |
| **Unknown layout** | JSX/TSX component files exist somewhere, but no shipped scenario matches their location | Synthesize a custom `mapper.mjs` (see below). Do not skip the inventory. |

The state script's RAG synthesis pass is responsible for making this call explicitly. The synthesized `state.mjs` records the verdict as `layout_kind: "greenfield" | "known" | "unknown"`. Greenfield never falls back to mapper synthesis; unknown always does.

The cheap test for "any components anywhere": a `git grep -l` for `from ['\"]react['\"]` (or React Native's equivalent) returning empty across the repo. The RAG pass can do this in one shell call; the result is baked into the synthesized state script as a one-time fact.

### Layout detection

The skill ships a small set of **scenario scripts**, each of which answers one question: *does my layout match this scenario, and if so where are the component roots?*

```
node .cursor/skills/impeccable-native/scripts/design-system/detect-layout.mjs --dir=.
```

Runs the scenario scripts in order until one matches. Shipped scenarios:

| Scenario | Roots |
|---|---|
| `src-components` | `src/components/` |
| `src-ui` | `src/ui/` |
| `app-components` | `app/components/` |
| `components-root` | `components/` (no `src/`) |
| `packages-ui` | `packages/*/src/` (monorepo) |
| `expo-router` | `app/` with file-based routes + `components/` peer |

Each scenario script is pure node, <30 lines, no dependencies. It returns `{matched: bool, roots: string[], confidence: 'high'|'medium'|'low'}`.

### Fallback: synthesize a custom mapper

If no scenario matches (or all match with low confidence), the skill turn does a **one-shot RAG pass** to understand the repo's structure and writes a custom mapper to `.impeccable/design-system/mapper.mjs`. From then on, that file is the mapper for this repo. Future inventory runs do not re-explore.

The custom mapper must conform to the same interface as the shipped scenarios: take `--dir`, return `{matched: true, roots: [...]}`.

### Inventory script

```
node .cursor/skills/impeccable-native/scripts/design-system/inventory.mjs --dir=. [--force]
```

Reads the chosen mapper output, walks each root, and for every component file emits:

| Field | Source |
|---|---|
| `id` | File path relative to root, kebab-cased. |
| `file` | Absolute path. |
| `exports` | Named + default exports that look like React components (capitalized identifier, returns JSX). |
| `props` | Prop names + types (from TS annotations or PropTypes; best-effort for plain JS). |
| `kind_guess` | `atom` / `molecule` / `organism` based on folder + composition heuristics. Always a guess; the model can override. |
| `imports_components` | Other inventoried components this one imports. |
| `imported_by_count` | How many files import this component. |
| `last_touched` | Git mtime of the file. |

The inventory is **descriptive only**. It does not say "this is redundant" or "this should be deleted." Judgment is Act 3.

### Cache

After writing `inventory.json`, the script stamps it with the git tree-hash of each component root:

```json
{
  "tree_hashes": {
    "src/components": "a1b2c3...",
    "src/ui": "d4e5f6..."
  },
  "generated_at": "...",
  "components": [ ... ]
}
```

On every subsequent run, `cache-check.mjs` recomputes the tree-hashes and compares. Match → cache is fresh, skip the mapper. Mismatch → re-run. The user can force a refresh with `--force`.

---

## Act 3 — Judgment

**Goal:** produce a verdict report by joining slots × components, with the model writing all semantic calls.

**Inputs:** `DESIGN-SYSTEM.md` (charter) and `inventory.json` (components). Greenfield repos have an empty inventory; the judgment becomes a proposal-only report.

### The join

A script (`join.mjs`) produces the join table — slot rows on one side, component rows on the other, joined by no fixed key. It just emits both tables in a single document with stable IDs so the model can reference them.

### The verdict pass

The model reads the join and writes:

1. **Per-slot status.**
   - `filled` — at least one component cleanly serves this slot.
   - `partial` — a component is doing this job but inadequately (missing a state, wrong interaction kind, leaked into the wrong phase).
   - `unfilled` — no component currently serves this slot.
   - `over-served` — multiple components compete for this slot; pick one.

2. **Per-component verdict.**
   - `earns-place` — serves a slot well.
   - `mis-purposed` — exists, but for the wrong slot, or has drifted from its charter purpose.
   - `redundant` — another component does the same job. Flag which.
   - `orphan` — does not serve any slot in the charter. Either the charter is missing a slot, or the component is dead weight.
   - `merge-candidate` — could be folded into another component with minor changes.

3. **Proposal list.** Concrete, file-path-aware actions:
   - `propose-create` — new component for an `unfilled` slot. Includes a one-paragraph spec.
   - `propose-merge` — fold component A into component B.
   - `propose-deprecate` — remove a component, list the call sites that need migration.
   - `propose-refactor` — change a component's purpose to match its actual slot.

**Output:** `.impeccable/design-system/judgment.md` (human-readable) and `judgment.json` (machine-readable for downstream apply steps).

---

## Act 4 — Apply (proposals, one at a time)

Not auto-invoked. The user reviews `judgment.md` and approves proposals individually. Each approved proposal is executed by the skill turn with user confirmation, the same way `/migration` handles its phased changes.

No proposal is applied without explicit user approval. The skill never deletes components on its own — `propose-deprecate` produces a migration plan, not a `rm`.

---

## Files written

| Path | Owner | Lifetime |
|---|---|---|
| `DESIGN-SYSTEM.md` | user-editable, skill co-authors | persistent |
| `.impeccable/design-system/state.mjs` | skill (one-shot synthesis) | persistent per repo; re-synthesized on `assertPaths()` failure |
| `.impeccable/design-system/mapper.mjs` | skill (one-shot synthesis) | persistent per repo |
| `.impeccable/design-system/inventory.json` | scripts | regenerated on tree-hash mismatch |
| `.impeccable/design-system/judgment.md` | skill | regenerated per judge run |
| `.impeccable/design-system/judgment.json` | skill | regenerated per judge run |

---

## What is NOT in this command

- **Token decisions.** Colors, spacing, radii — that's `/rebrand` and `/migration`.
- **Visual polish of an individual component.** That's `/polish`, `/rethink`, `/break`.
- **Anti-pattern hunting.** That's `/audit`.
- **Pixel-level scrutiny.** That's `/critique`.

`design-system` is about the *composition* of the component layer — what exists, why, and what's missing — not the surface of any one component.

---

## Failure modes the skill should refuse

- **No `PRODUCT.md`.** Refuse with a pointer to `/shape`. The charter has nothing to anchor against.
- **Charter with zero slots.** Refuse the judgment step. The user is asking for an opinion with no contract.
- **Inventory request on a greenfield repo.** Skip silently, proceed to Act 3.
- **Judgment request with stale inventory and `--no-refresh`.** Refuse and force the user to acknowledge they want stale data.
