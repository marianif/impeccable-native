# Design System

Design the component layer of the app — atoms, molecules, and especially organisms — as **living things on screens**, not as a generic kit. Each component is tied to the app's vibe, a real user journey, and concrete evidence of need. The output is a `design-system-plan.json` that the agent executes phase-by-phase, with cleanup gated on per-cluster approval.

`design-system` sits above `rebrand` and `migration`:

- `rebrand` decides the **vibe and tokens** (what things feel like).
- `migration` mechanically **applies tokens** across the codebase (what things are made of).
- `design-system` decides **what components exist, why, and how they coexist on screen** (what things *are* and how they behave with their neighbors).

Use `design-system` when:

- Bootstrapping a new app and you want the component layer to be designed, not assembled from generic atoms.
- A `rebrand` + `migration` just landed and the components now wear new clothes — but their composition, redundancy, and life on screen haven't been rethought.
- The component folder has drifted: three "Card" variants doing nearly the same job, dead components nobody imports, organisms that are really just decorated molecules.
- The app works but doesn't feel composed — screens read as a pile of components rather than as choreographed compositions.

Do not use `design-system` for:

- A single screen redesign — that's `rethink` (purpose-driven, brand-respecting) or `break` (questions the system).
- Replacing tokens — that's `migration`.
- Deciding the brand or vibe — that's `rebrand`.
- Bulk renaming or generic deduping with no compositional intent — that's `extract`.

---

## The Core Idea: Living Organisms

A component — especially an organism — is not a box with props. It is **a thing that does a job on a screen, in a flow, at a moment, next to other things**. If a proposed component cannot answer all five of the following questions, it does not ship:

1. **Job.** What does it let the user do or decide? Stated as a verb-led sentence, not a description ("lets the user resume a paused workout," not "displays workout state").
2. **Lives in.** Which screen(s), at which position, at which moment in the flow. Before what; after what.
3. **States.** Empty, loading, populated, error, stale, optimistic, post-action, celebratory, dismissed. **An organism with fewer than 3 meaningful states is a molecule in disguise.**
4. **Reacts to.** Scroll, focus, sibling-state changes, data arrival, dwell time, app foregrounding, time of day. Static organisms are decorations.
5. **Neighbors.** Who else is on screen. Who yields to whom. What happens when two organisms both want attention. **An organism with no named neighbors or choreography note is a molecule in disguise.**

These five answers live in a `life` block on every organism entry in the plan. Without them, the agent must refuse to ship the organism.

---

## Sub-modes

`design-system` has four sub-modes. The first word after `design-system` selects the mode.

| Mode | Purpose | Output |
|---|---|---|
| `scan` | Run Act 1 forensics only. Standalone diagnostic. | `forensics.json` + summary |
| `plan` | Full pipeline: forensics → choreography → plan. Stops before execution. | `design-system-plan.json` + `design-system.md` |
| `execute` | Run Act 3 against an approved plan. Cleanup is gated cluster-by-cluster. | Component edits, deletions, scaffolds |
| `resume` | Continue an in-progress run from saved state. | Whatever phase was paused |

If no sub-mode is given, default to presenting the four options and asking the user to pick.

---

## Inputs

`design-system` reads, in order of priority:

1. `.impeccable/brand-brief.json` — produced by `rebrand`. Source of truth for tokens, vibe traits, and ruled-out patterns. **Required.** If missing, stop and tell the user to run `rebrand` first (or, for greenfield with no rebrand, to hand-author a minimal brief — see "Greenfield without rebrand" below).
2. `PRODUCT.md` and any app strategy doc the user names — source of truth for user journeys, key flows, and stated goals.
3. The codebase itself — `components/`, `screens/` (or `app/`), and any usage data inferable from imports.
4. `.impeccable/forensics.json` from a previous `rebrand` scan, if present and fresh — reused rather than regenerated.

### Greenfield without rebrand

If there is no codebase and no `brand-brief.json`, ask the user to either run `rebrand` first or paste a minimal brief (position, vibe axes, ruled-out list). Do not proceed with generic defaults — that produces a generic kit.

---

## Act 1 — Forensics & Strategy

Goal: emit enough evidence that every Act 2 decision can be defended with file:line citations or a brief quote.

```bash
node .claude/skills/impeccable-native/scripts/design-system/design-system-scan.mjs --dir=. [--brief=.impeccable/brand-brief.json]
```

The orchestrator runs the following scripts in parallel where possible, then sequentially merges:

### 1.1 `design-system/component-inventory.mjs`

Walks `components/` (or the path declared in `DESIGN.md`). For each component emits:

- name, file path, exported props (shape + defaults)
- internal composition (which other components it imports)
- usage count across `screens/` (import + JSX occurrence)
- last-touched date (from `git log -1`)
- a rough kind heuristic: `atom | molecule | organism | screen-fragment | unknown`

Output: `.impeccable/ds-component-inventory.json`

### 1.2 `design-system/duplication-report.mjs`

Clusters components that appear to do the same job. Signals:

- name similarity (`PrimaryButton`, `MainButton`, `CTAButton`)
- prop-surface overlap (≥70% prop names match, with compatible types)
- JSX shape overlap (same root element + similar children topology)
- visual signature overlap (same token classes / style keys at root)

Each cluster carries the candidate members, the inferred shared job, and the cheapest merge sketch. **The agent does not pick the winner here** — that's an Act 2 decision tied to evidence.

Output: `.impeccable/ds-duplication.json`

### 1.3 `design-system/dead-code-report.mjs`

Zero-import components, plus components imported only by other dead components (transitive dead). For each, a one-line guess at why it died ("replaced by X in commit abc1234", "never referenced", "imported only in tests").

Output: `.impeccable/ds-dead-code.json`

### 1.4 `design-system/composition-patterns.mjs`

The implicit-organism **candidate** harvester. The output is a short shortlist, not an exhaustive dump — Act 2 still has to apply the five-question gate to decide which candidates actually qualify as organisms. The script's job is to surface a small, defensible list with evidence, not to make the call.

A sub-tree qualifies as a candidate only if it meets **all** of:

- ≥6 elements and ≥4 distinct element types (filters out `View>[Text,Text]` and other structural noise)
- root tag is not a bare `View` unless it carries a `style=` reference (bare wrappers are not organisms)
- contains at least one interaction or data signal: `onPress` / `onChangeText` / list container / navigation call
- after near-duplicate clustering (same root + ≥80% multiset Jaccard on children), the merged candidate appears in ≥2 distinct screens

Each candidate emits: label, root + child element set, element count, occurrence count, screen spread, occurrence sites (file:line), interaction signals, dominant `styles.*` keys, dominant handlers, and a verb-led job guess. Raw signatures that got merged are kept under `mergedFromSignatures` so the audit trail is intact.

Rejection counts (`rejected.tooSmall`, `tooFlat`, `bareWrapper`, `noInteraction`, `lowSpread`) are reported so the agent can tell whether the filter was too tight on this codebase.

Output: `.impeccable/ds-composition-patterns.json`

### 1.5 `design-system/app-anatomy.mjs`

Reads `PRODUCT.md` + screen files. Emits a structured map:

- screens and routes
- user journeys (entry → key actions → exit)
- key flows named in product doc
- stated goals and their KPIs if present

Output: `.impeccable/ds-app-anatomy.json`

### 1.6 `design-system/screen-choreography.mjs`

**The first-class artifact that makes organisms living things.**

For each screen, emit a choreography record:

```jsonc
{
  "screen": "HomeScreen",
  "file": "app/(tabs)/index.tsx",
  "regions": [
    { "name": "header", "position": "top-fixed", "occupants": ["GreetingHeader", "NotificationBell"] },
    { "name": "above-fold", "position": "top-scrolling", "occupants": ["ResumeWorkoutCard"] },
    { "name": "main", "position": "scrolling", "occupants": ["DailyStatsRow", "WorkoutList"] }
  ],
  "hierarchy": [
    { "primary": "ResumeWorkoutCard", "yields": ["GreetingHeader", "DailyStatsRow"], "when": "session is paused or active-backgrounded" },
    { "primary": "GreetingHeader", "yields": [], "when": "no active session" }
  ],
  "entries": ["app open with cold start", "tab switch from Profile", "deep link from notification"],
  "exits": ["tap WorkoutCard → WorkoutDetailScreen", "tap tab → other tab"],
  "moments": ["first 3s of session", "post-workout celebration window", "idle dwell > 8s"]
}
```

The script seeds this from the codebase; the agent enriches it in Act 2 with hierarchy and moments where the static scan can't infer them.

Output: `.impeccable/ds-screen-choreography.json`

### 1.7 Greenfield variation

If `components/` and `screens/` are empty or missing, skip 1.1–1.4 and 1.6. Run only 1.5 (`app-anatomy`) — pull journeys, screens, and goals from `PRODUCT.md` and the brand brief. The choreography artifact in this case is *projected* (intended), not observed.

### Summary

After Act 1, emit `.impeccable/design-system-scope.md`:

- Are we bootstrapping or rethinking? (greenfield vs brownfield)
- The brand position one-liner, copied from `brand-brief.json`.
- Top 5 duplications with cluster names and member files.
- Top 5 dead components.
- Top 5 organism candidates from composition-patterns — each with screen spread, interaction signals, and the verb-led job guess. (Candidates only; the five-question gate runs in Act 2.)
- Per-screen choreography summary — primary occupant per screen, biggest tension.

Stop here unless the user explicitly asked for `plan` or `execute`.

---

## Act 2 — Composition Plan

Goal: produce `.impeccable/design-system-plan.json`, an agent-authored artifact with four sections. The plan is the contract for Act 3.

### 2.1 Atoms

For each atom entry: `name`, `disposition` (`CONFIRM | REVISE | ADD | RETIRE`), `tokens used` (citing brand brief), `props`, `states`, `why this exists`. Atoms must map to a token role from the brief; no atom invents a value.

### 2.2 Molecules

Same shape as atoms, plus `composed of` (list of atoms). A molecule must have a job sentence and at least one named home (screen or moment). Molecules with no home are deferred to a `parking` section, not promoted to organisms.

### 2.3 Organisms — the living layer

Two passes, in order:

**Pass A — Screen-driven (harvest).** For each composition pattern from `ds-composition-patterns.json` that meets the bar, propose an organism. The bar:

- The pattern appears in ≥3 places, OR in 1 place but inside a journey marked critical in `app-anatomy.json`.
- The pattern can be given a verb-led job sentence.
- The pattern has identifiable states from its current usages (or from the journey it serves).

**Pass B — Strategy-driven (project).** For each journey or stated goal in `app-anatomy.json` not already served by a harvested organism, propose what's missing. Each strategy-driven organism must cite:

- The journey or goal it serves (verbatim quote from the source).
- The vibe trait from the brief it embodies.
- Why no existing component can do this job (with file:line evidence, or "no component covers this").

**Every organism — A or B — must carry a `life` block:**

```jsonc
{
  "name": "ResumeWorkoutCard",
  "disposition": "ADD | REVISE | CONFIRM | RETIRE",
  "composed_of": ["Surface", "Stack", "Headline", "ProgressBar", "PrimaryButton"],
  "life": {
    "job": "Let the user resume a paused workout without re-entering setup.",
    "lives_in": [
      { "screen": "HomeScreen", "region": "above-fold", "priority": "primary-when-active" },
      { "screen": "WorkoutListScreen", "region": "pinned-header", "priority": "secondary" }
    ],
    "flow_position": {
      "before": "App open with active session, or tab switch into Home with paused session.",
      "after": "Tap → WorkoutDetailScreen with session resumed."
    },
    "states": [
      { "name": "hidden", "when": "no active session" },
      { "name": "paused", "when": "session paused > 0s" },
      { "name": "active-backgrounded", "when": "session active but app was backgrounded" },
      { "name": "just-completed", "when": "session ended within last 3s", "duration": "3s celebratory then dismounts" }
    ],
    "reacts_to": [
      "session store state changes",
      "scroll: collapses to pill at scrollY > 120",
      "tab focus: refreshes elapsed time",
      "app foreground: re-checks session state"
    ],
    "neighbors": [
      { "name": "GreetingHeader", "relationship": "yields to this when this is active" },
      { "name": "DailyStatsRow", "relationship": "dims to 0.6 opacity when this is paused" }
    ],
    "transitions": {
      "enter": "spring from above on data arrival",
      "exit": "fade + slight upward translate on dismount",
      "state-change": "cross-fade between paused / active-backgrounded"
    },
    "vibe_trait": "encouraging, not nagging",
    "evidence": [
      "screens/Home.tsx:42 (existing inline composition)",
      "screens/WorkoutList.tsx:18 (existing inline composition)",
      "PRODUCT.md: 'resume friction is the #1 drop-off'"
    ]
  }
}
```

The agent **must refuse** to author an organism entry without all five `life` fields populated, ≥3 states, and at least one named neighbor or a choreography note explaining why it has none.

### 2.4 Cleanup

Two sub-sections:

- **Merges** — each entry references a cluster from `ds-duplication.json`, names the *winning* component, describes the *job* each cluster member was actually doing (so the merge isn't flattening real distinctions), and lists the call sites that need to migrate.
- **Deletions** — each entry references an item in `ds-dead-code.json` and confirms with a one-line check ("verified no dynamic imports", "verified not referenced in storybook").

Each cleanup entry has an `approval` field defaulting to `pending`. Act 3 will not touch a cluster whose approval is `pending`.

### 2.5 Plan schema (top-level)

Write `.impeccable/design-system-plan.json`:

```jsonc
{
  "version": "1.0",
  "generatedAt": "<ISO>",
  "generatedBy": "design-system plan",
  "sourceBrief": ".impeccable/brand-brief.json",
  "sourceForensics": ".impeccable/forensics.json",
  "sourceAnatomy": ".impeccable/ds-app-anatomy.json",
  "sourceChoreography": ".impeccable/ds-screen-choreography.json",

  "mode": "greenfield | brownfield",

  "atoms":    [ /* atom entries */ ],
  "molecules":[ /* molecule entries */ ],
  "organisms":[ /* organism entries with `life` */ ],
  "parking":  [ /* molecules without a home, organisms missing life fields */ ],

  "cleanup": {
    "merges":    [ /* with `approval`: "pending|approved|rejected" */ ],
    "deletions": [ /* with `approval` */ ]
  },

  "choreography": {
    /* Enriched copy of ds-screen-choreography.json with the agent's hierarchy + moments. */
  }
}
```

Also write `.impeccable/design-system.md` as a human-readable version. Section order: Mode → Atoms → Molecules → Organisms (with full `life` blocks) → Cleanup → Choreography.

Present the plan to the user and ask for approval before Act 3. Cleanup approvals are collected per cluster, not in bulk.

**Mechanical gate.** Before presenting and before Act 3, run:

```bash
node .claude/skills/impeccable-native/scripts/design-system/validate-plan.mjs --plan=.impeccable/design-system-plan.json
```

The validator exits non-zero on any refusal-rule violation: missing `life` block, fewer than 3 states, missing neighbors (without a `solitudeNote`), missing evidence, missing job sentence, missing disposition, missing cleanup approval field, merges without `winner` or `memberJobs`, generic vibe traits, etc. **Do not present a plan that fails validation — fix it first.** Do not execute Act 3 until the validator returns `verdict: valid` AND all cleanup approvals are explicitly `approved` or `rejected` (none `pending`).

---

## Act 3 — Execution

Run only after the user approves the plan. The order is fixed:

1. **Cleanup first.** For each cluster with `approval: approved`, perform the merge or deletion. Leans on `extract`'s primitives where they fit; leans on `migration`'s rewrite helpers when call-site rewrites are needed. Skips any cluster still `pending` or `rejected`.
2. **Atoms.** Add new atoms; revise existing ones (props, states, tokens).
3. **Molecules.** Same.
4. **Organisms.** Scaffold each organism file. Include a one-line top-of-file comment naming the screens that justified it (so future readers can trace it back to the plan). Wire enter/exit/state-change transitions per the `life.transitions` field.

Each phase commits separately, with a message that names the plan section: `design-system: cleanup merges (3 clusters)`, `design-system: add 4 atoms`, etc.

After all phases, run `audit` on the modified screens to catch regressions. Do not declare the run done until both platforms have been opened in simulator and the affected screens look right.

---

## Mode: `resume`

If `.impeccable/design-system-state.json` exists, load it and continue from where the session paused: re-present the last completed phase's output and ask the user to confirm before moving on. If no state exists, fall back to `plan`.

---

## What `design-system` is NOT

- Not a generic component-kit generator. Every entry is tied to a journey, a vibe trait, and evidence.
- Not a token authoring tool. Tokens come from `brand-brief.json`. If the brief is missing a value an organism needs, the command stops and asks for it.
- Not a screen redesigner. It composes from the choreography; it doesn't re-lay-out screens. (That's `rethink`, `break`, or `shape`.)
- Not silent. Cleanup never executes without per-cluster approval; organisms never ship without a complete `life` block.

## NEVER

- Never author an organism without all five `life` fields, ≥3 states, and at least one named neighbor (or an explicit choreography note explaining its solitude).
- Never propose an organism that can't cite either (a) ≥3 existing use sites, or (b) a verbatim quote from `app-anatomy.json` / brand brief naming the journey or goal it serves.
- Never execute cleanup without per-cluster approval from the user.
- Never flatten a duplication cluster without first describing the *job* each member was doing. Two cards that look alike can serve different jobs; merging them silently destroys signal.
- Never modify `brand-brief.json` or tokens. If a needed token is missing, stop and ask the user to extend the brief (or re-run `rebrand`).
- Never propose components for hypothetical future needs. If it's not in the choreography, the journey map, or the composition-patterns harvest, it doesn't ship.
- Never declare an organism "stateless" to dodge the 3-state minimum. If it's truly stateless, it's a molecule — re-classify it.
- Never claim done before opening both iOS and Android simulators on the affected screens.
