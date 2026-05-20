<!--
SYNC IMPACT REPORT
==================
Version change: TEMPLATE (uninitialized) → 1.0.0
Bump rationale: First ratified version. Initializes constitution from template
with concrete principles, governance, and project constraints.

Modified principles: N/A (initial ratification — all five principles new)
Added sections:
  - Core Principles (I–V)
  - Project Scope & Architectural Constraints
  - Development Workflow & Quality Gates
  - Governance
Removed sections: N/A

Templates requiring updates:
  ✅ .specify/templates/plan-template.md — Constitution Check section will be
     populated from these principles when /speckit-plan runs. No structural
     change needed in the template itself.
  ✅ .specify/templates/spec-template.md — No constitution-driven mandatory
     sections added; template stays as-is.
  ✅ .specify/templates/tasks-template.md — No new principle-driven task
     categories; template stays as-is.
  ✅ .claude/skills/speckit-*/SKILL.md — Generic, no agent-specific drift to
     correct.

Runtime guidance docs:
  ✅ README.md, CLAUDE.md, AGENTS.md, NOTICE.md — already reflect the
     architecture this constitution codifies (no changes required).

Follow-up TODOs: None.
-->

# impeccable-native Constitution

## Core Principles

### I. Methodology Preserved, Implementation Rewritten

The design methodology forked from upstream impeccable is the load-bearing
asset of this project: registers (brand vs. product), the AI slop test, the
anti-reflex checks, the multi-gate `craft` flow, identity-lock thinking, the
shape-then-build discipline. These MUST be preserved across every reference
file rewrite.

The implementation guidance is the rewritable surface: CSS becomes
StyleSheet + tokens, DOM becomes Yoga + RN primitives, browser inspection
becomes simulator + device inspection, WebGL becomes Skia + Reanimated.

**Test for compliance:** if a reviewer reading a rewritten reference cannot
identify the corresponding methodology section from the upstream file
(gates, interview cadence, brief structure, scoring matrix), the rewrite has
lost the asset and MUST be revised.

**Rationale:** the methodology is what makes impeccable different from
generic AI design prompts. Throwing it away to chase RN-specific advice
yields another commodity skill. Throwing away the implementation guidance
to preserve methodology purity yields a skill that produces web code in an
RN project.

### II. React Native Only — No Cross-Platform Hedging

Every reference file, every script, every agent in this skill targets
React Native and Expo. There is no shared web/native code path, no
"the same advice works on web too" hedging, no abstract platform-agnostic
guidance.

- All emitted code samples MUST be valid React Native (TypeScript-first).
- All anti-pattern callouts MUST reference RN APIs and idioms (FlatList,
  Pressable, SafeAreaView, Reanimated, accessibilityRole), not web ones.
- All scripts MUST detect RN project shape (package.json with RN/Expo
  deps); a script that runs cleanly in a Next.js project is a bug.
- The web `live` browser-overlay mode and the web anti-pattern detector
  are permanently removed and MUST NOT be reintroduced.

**Rationale:** the web fork already exists upstream. This fork's value is
mobile-specific depth, not breadth.

### III. Styling Baseline: StyleSheet + tokens.ts (NativeWind Deferred)

All code emitted by this skill MUST use `StyleSheet.create` with values
sourced from a `tokens.ts` module. NativeWind and Unistyles are recognized
as legitimate alternative styling layers in the RN ecosystem, but they are
NOT the baseline output of this skill in version 1.x.

- The `detect-rn-flavor.mjs` script MUST detect the project's styling
  layer (`stylesheet` | `nativewind` | `unistyles`) and surface it in
  output.
- When NativeWind or Unistyles is detected, the skill MUST notify the user
  that the baseline output is StyleSheet+tokens, and MAY offer to adapt
  output to class-name form on request, but MUST NOT silently emit class
  names by default.
- NativeWind first-class support is a planned future amendment, not a
  silent addition.

**Rationale:** branching every code-emitting reference on styling layer
multiplies the maintenance surface before the methodology is even
finished. Lock the baseline, ship the methodology, then extend.

### IV. iOS + Android Parity Is a Gate, Not a Nice-to-Have

Every craft output, every audit output, and every animate output MUST be
inspected on both iOS and Android (simulator, emulator, or device) before
being declared complete.

- The `craft.md` reference MUST include an explicit, unskippable
  parity-check gate after build and before "done."
- The `audit.md` reference MUST score platform parity as one of its
  dimensions.
- The `screenshot.mjs` script (when introduced) MUST support both
  `xcrun simctl` (iOS) and `adb exec-out screencap` (Android).
- "It looked fine on the iOS sim I had open" is a documented failure
  mode, not an acceptable shortcut.

**Rationale:** the dominant quiet failure mode of RN design work is
iOS-only verification. Without an explicit gate, this fork drifts into an
iOS-first skill that betrays its cross-platform premise.

### V. Build, Tests, and Harness Sync Stay Green

Every change to `skill/` MUST leave `node scripts/build.js` exiting 0 with
no validation errors, and `node --test tests/*.mjs` passing 100%. Every
change MUST regenerate `.claude/skills/impeccable-native/` and
`.cursor/skills/impeccable-native/` via the build before being committed.

- A failing build is never "fixed later" — the commit that breaks the
  build MUST be repaired before any other reference work proceeds.
- A failing test MUST be fixed by repairing the code under test or by
  amending the test with explicit justification; tests MUST NOT be
  deleted to silence failures.
- The two harness targets (`.claude/`, `.cursor/`) are the only sync
  destinations. Adding a third target requires a constitution amendment.

**Rationale:** the skill IS the build output. A broken build means users
get nothing.

## Project Scope & Architectural Constraints

**Single skill, twenty-two sub-commands.** The skill is named
`impeccable-native` and is invoked as `/impeccable-native <sub-command>`.
Adding a standalone sibling skill is forbidden; new commands MUST be
added as sub-commands under the existing skill.

**Source of truth.** `skill/SKILL.md`, `skill/reference/*.md`,
`skill/scripts/*`, and `skill/agents/*` are the authored sources. The
`.claude/skills/` and `.cursor/skills/` trees are build outputs and MUST
NOT be hand-edited.

**Distribution surface.** This repo distributes the Claude Code plugin
manifest (`.claude-plugin/`) and the harness skill directories. There is
no marketing site, no CLI npm package, no browser extension, and no
remote services. Any of these would be a constitution amendment.

**Context contract.** `PRODUCT.md` and `DESIGN.md` are the project-level
context files this skill consumes from a user's RN project. Their shape
is governed by the `teach.md` and `document.md` references; changes that
break backwards compatibility require a MAJOR constitution bump.

## Development Workflow & Quality Gates

**Spec-driven changes.** Substantive reference rewrites and new commands
proceed through `/speckit-specify` → `/speckit-clarify` (when needed) →
`/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Drive-by edits
to fix typos or template placeholders are exempt.

**File-by-file pace for rewrites.** Reference rewrites SHOULD proceed one
file at a time with explicit user confirmation between files, in the
dogfood order defined in `IMPECCABLE.md`. Batch rewrites are permitted
only when the changes are mechanical (e.g., renaming `impeccable` →
`impeccable-native` across all files).

**Constitution Check in plans.** Every `/speckit-plan` output MUST
include a Constitution Check section that asserts each of the five
principles above by name, and explains how the plan satisfies them. A
plan that violates a principle MUST justify the violation explicitly or
be revised.

**Harness sync after every change.** After editing any file under
`skill/`, the contributor MUST run `node scripts/build.js` and stage the
resulting `.claude/skills/` and `.cursor/skills/` deltas in the same
commit.

## Governance

**Authority.** This constitution supersedes ad-hoc decisions and prior
project notes (including `IMPECCABLE.md`'s suggested ordering, which is
guidance, not law). Where this constitution and a reference file
disagree, the constitution wins until the reference is amended or the
constitution is.

**Amendment procedure.** Constitution changes MUST follow this flow:
(1) draft amended text in a commit on a feature branch;
(2) run the Sync Impact Report in the file header to enumerate downstream
template and doc impacts; (3) update those templates and docs in the
same commit set; (4) bump the version per the rules below; (5) merge.

**Versioning policy.** Semantic versioning applies to this constitution:
- **MAJOR**: backward-incompatible removal or redefinition of a principle,
  removal of a project scope constraint, or change to the context-file
  contract that breaks existing PRODUCT.md / DESIGN.md files in the wild.
- **MINOR**: addition of a new principle, addition of a new scope
  constraint, or materially expanded guidance under an existing principle.
- **PATCH**: clarifications, wording improvements, typo fixes, and
  non-semantic refinements.

**Compliance review.** Every reference rewrite PR and every new-command
PR MUST be reviewed against this constitution. Reviewers MUST cite the
principle a change satisfies (or the amendment that exempts it). A PR
that cannot be mapped to a principle is out of scope and SHOULD be
closed or re-scoped.

**Living document.** The constitution is expected to amend as the fork
matures. NativeWind first-class support (Principle III) is the most
likely near-term amendment trigger. Adding a third harness target
(Principle V) and adding a non-skill distribution surface (Project Scope)
are the most likely longer-term triggers.

**Version**: 1.0.0 | **Ratified**: 2026-05-20 | **Last Amended**: 2026-05-20
