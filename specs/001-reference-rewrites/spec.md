# Feature Specification: Reference Rewrites for React Native

**Feature Branch**: `001-reference-rewrites`

**Created**: 2026-05-20

**Status**: Draft

**Input**: User description: "you should have all the necessary context in order to understand what we are building"

## Overview

The impeccable-native skill currently ships a React-Native-aware `SKILL.md`, a working `detect-rn-flavor.mjs` flavor detector, RN-shaped `PRODUCT.md` / `DESIGN.md` templates, and two already-RN-converted reference files (`teach.md`, `shape.md`). The remaining 20 reference files (`craft`, `document`, `audit`, `critique`, `polish`, `bolder`, `quieter`, `distill`, `harden`, `onboard`, `extract`, `animate`, `colorize`, `typeset`, `layout`, `delight`, `overdrive`, `clarify`, `adapt`, `optimize`) still carry the upstream web vocabulary (CSS, DOM, browser, WebGL, Stitch DESIGN.md, etc.). This feature is the file-by-file conversion of those references so that every command behaves correctly for a React Native or Expo project.

This spec is mandated by the impeccable-native constitution v1.0.0, Principles I (methodology preserved) and II (React Native only).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Foundational commands speak React Native end to end (Priority: P1)

A developer working in an Expo project runs `/impeccable-native craft profile-edit-screen`. They expect the skill to interview them, propose a confirmed design brief, build the screen, and inspect it on both iOS and Android, producing real React Native code that compiles and runs in their project.

**Why this priority**: `craft` is the entry point for end-to-end design work, and the four references it directly depends on (`document`, `audit`, plus the already-done `teach` and `shape`) form the minimum coherent product. Without these, every other command produces nonsense advice ("inspect in your browser", "use OKLCH in CSS", "wrap in a `<div>`") that fails the first time a user runs it.

**Independent Test**: Invoke `/impeccable-native craft` against a small Expo Router project; verify that every gate, every emitted code sample, and every command-suggestion link in the resulting output is React Native–native and that the screen runs on both iOS Simulator and Android Emulator without modification.

**Acceptance Scenarios**:

1. **Given** a fresh Expo project with PRODUCT.md and DESIGN.md present, **When** the user runs `/impeccable-native craft [feature]`, **Then** the skill enforces the multi-gate shape → brief → build → parity-check flow, emits StyleSheet+tokens code, and explicitly inspects both iOS and Android before declaring the work done.

2. **Given** a project missing DESIGN.md, **When** the user runs `/impeccable-native document`, **Then** the skill scans `StyleSheet.create` calls (not CSS), extracts color/type/space tokens into a `tokens.ts` shape, and writes a DESIGN.md that matches the template format `teach.md` already references.

3. **Given** an existing screen file, **When** the user runs `/impeccable-native audit [screen]`, **Then** the skill scores it against five RN-specific dimensions (a11y for VoiceOver+TalkBack, performance for re-renders and FlatList, theming for light/dark, adaptive for safe areas and Dynamic Type, RN anti-patterns) plus platform parity, and produces a P0–P3 prioritized report.

### User Story 2 — Refinement commands stop emitting web advice (Priority: P2)

A developer with a working RN screen runs any of the seven refinement commands (`polish`, `bolder`, `quieter`, `distill`, `harden`, `onboard`, `critique`). They expect commentary and edits that use RN vocabulary throughout — no hover states, no `prefers-reduced-motion` CSS media query, no `localStorage`.

**Why this priority**: refinement is the highest-traffic use case after `craft` itself. These commands are how users iterate on real screens, and they are the most likely to embarrass the skill by suggesting CSS that does not exist in React Native.

**Independent Test**: For each of the seven refinement commands, invoke it against a representative RN screen and verify the output contains zero web-only API references (grep heuristics: `:hover`, `@media`, `localStorage`, `document.`, `window.`, `clamp(`, `oklch(`, `border-left:`) and that all emitted code edits remain valid TSX in the screen's existing style approach.

**Acceptance Scenarios**:

1. **Given** a busy RN screen, **When** the user runs `/impeccable-native distill`, **Then** the skill identifies decoration vs. signal using touch-target, safe-area, and information-density heuristics that suit a small screen, not a desktop window.

2. **Given** a fragile RN flow with no empty/error states, **When** the user runs `/impeccable-native harden`, **Then** the skill adds offline state, slow-network, background-to-foreground, app-killed-and-restored, and deep-link cases — not just web error toasts.

3. **Given** a flat black-and-white RN screen, **When** the user runs `/impeccable-native critique`, **Then** the assessment scores against mobile-specific heuristics (thumb reachability, gesture conflicts, system back behavior, touch-target ≥44pt) in addition to the universal UX heuristics inherited from upstream.

### User Story 3 — Enhancement and fix commands speak the mobile-native vocabulary (Priority: P3)

A developer running `/impeccable-native animate`, `/impeccable-native overdrive`, `/impeccable-native adapt`, `/impeccable-native optimize`, `/impeccable-native colorize`, `/impeccable-native typeset`, `/impeccable-native layout`, `/impeccable-native delight`, or `/impeccable-native clarify` expects the toolkit and the diagnostics to be RN-correct: Reanimated 3 + Skia + Gesture Handler for motion, Yoga + Safe Area + KeyboardAvoidingView for layout, FlatList virtualization + Hermes + InteractionManager for performance, Dynamic Type + font scale for typography, useColorScheme + token tables for theming.

**Why this priority**: these commands are domain-specific. A user who never touches `overdrive` will not notice if it still talks about WebGL, but the user who does will hit a wall instantly. P3 because the foundational commands carry the daily workload; these are the second wave.

**Independent Test**: For each enhancement/fix command, invoke it with a representative RN target and verify (a) the diagnostic vocabulary matches the RN platform, (b) the recommended libraries are RN packages that exist, and (c) the code samples compile against a current Expo SDK.

**Acceptance Scenarios**:

1. **Given** a static screen, **When** the user runs `/impeccable-native animate`, **Then** the skill produces Reanimated 3 worklets, respects `useReducedMotion()`, and never animates layout properties.

2. **Given** an ambitious brief, **When** the user runs `/impeccable-native overdrive`, **Then** the skill proposes 2–3 directions using Skia, Reanimated, Gesture Handler, MaskedView, BlurView, and expo-haptics — not WebGL or scroll-driven CSS animations.

3. **Given** a phone-only screen and a tablet/foldable requirement, **When** the user runs `/impeccable-native adapt`, **Then** the skill addresses phone↔tablet, portrait↔landscape, Dynamic Type, safe areas, foldables, and large-text accessibility — not CSS breakpoints.

### Edge Cases

- **What happens when a reference still references the `live` command?** It must not. `live` was removed; any cross-reference to `live.md` in a rewritten file is a bug.
- **What happens when a project uses NativeWind?** The skill detects it via `detect-rn-flavor.mjs`, notifies the user that the baseline output is StyleSheet+tokens, and proceeds with StyleSheet output by default. Per constitution Principle III, the skill MUST NOT silently emit class names.
- **What happens when a project is bare React Native (no Expo)?** The flavor detector returns `flavor: "bare"`. References that suggest Expo-only libraries (expo-haptics, expo-image, expo-font) MUST also suggest a community equivalent (react-native-haptic-feedback, FastImage, react-native-fonts) or note the Expo dependency clearly.
- **What happens when a rewritten reference cross-references another reference (e.g., `craft.md` mentions `audit.md`)?** All cross-references between references in the rewritten set MUST work — the target must exist, the section it points to must exist, and the suggested command must be in the current command list (no `live`, no upstream-only names).
- **What happens when a user reads a rewritten reference after reading the upstream impeccable docs?** They should recognize the methodology shape — gates, brief structure, scoring matrix, interview cadence — even though every example and every API has changed. Per constitution Principle I, methodology preservation is mandatory.
- **What happens when an iOS-only or Android-only behavior is involved?** The reference MUST call it out explicitly (e.g., "iOS only: native back gesture", "Android only: hardware back button") and the parity gate (Principle IV) MUST require checking both regardless.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every rewritten reference MUST replace web-platform vocabulary with React Native vocabulary throughout. Specifically: no CSS property names in prose or code; no DOM APIs; no browser-only concepts (hover, scroll-snap, prefers-reduced-motion as a CSS query, `:focus-visible`, `clamp()`); no upstream-specific links (Google Stitch, etc.).

- **FR-002**: Every rewritten reference MUST preserve the methodology structures it inherits from upstream impeccable — gates, interview cadence, brief sections, scoring frameworks, anti-reflex checks — as required by constitution Principle I.

- **FR-003**: Every emitted code sample in every rewritten reference MUST be valid TypeScript React Native using `StyleSheet.create` and consuming a `tokens.ts` module shape compatible with the `DESIGN.md` template. Class-name styling (NativeWind, Unistyles) MUST NOT appear as the default; it may appear only as a clearly-labeled alternative.

- **FR-004**: The rewritten `craft.md` MUST include an explicit, unskippable iOS + Android parity-check gate after the build step and before the "done" state, per constitution Principle IV.

- **FR-005**: The rewritten `audit.md` MUST score platform parity (iOS vs. Android) as one of its scored dimensions and MUST replace the upstream five-dimension matrix with the RN-specific matrix defined in `IMPECCABLE.md` Phase 3 (a11y / performance / theming / adaptive / RN anti-patterns), plus the platform-parity dimension.

- **FR-006**: The rewritten `document.md` MUST extract tokens from existing `StyleSheet.create` calls and theme files, emit a `tokens.ts`-shaped DESIGN.md that matches the template in the repo root, and MUST NOT emit Google Stitch frontmatter or CSS custom properties.

- **FR-007**: The rewritten `critique.md` MUST replace web detector dependency (`detect.mjs`, browser inspection) with RN-appropriate evidence-gathering (screenshot tooling, static analysis where available) and MUST keep the dual-assessment + synthesis structure intact.

- **FR-008**: The rewritten `animate.md` MUST exclusively recommend Reanimated 3 (with Moti as a higher-level option) and MUST require `useReducedMotion()` respect on every animation. CSS transitions, WAAPI, View Transitions API MUST be absent.

- **FR-009**: The rewritten `overdrive.md` MUST exclusively recommend RN-native ambitious techniques (Skia, Reanimated worklets, Gesture Handler composition, MaskedView, BlurView, expo-haptics, shared element transitions, 120Hz ProMotion). WebGL, View Transitions, and scroll-driven CSS MUST be absent.

- **FR-010**: The rewritten `adapt.md` MUST cover phone↔tablet, portrait↔landscape, Dynamic Type / font scale, safe areas, foldables, and large-text accessibility. CSS media-query breakpoints MUST be absent.

- **FR-011**: The rewritten `layout.md` MUST cover Yoga flexbox specifics (column default, no `gap` pre-RN 0.71, no `position: sticky`), ScrollView vs. FlatList vs. SectionList trade-offs, safe area handling, and keyboard avoidance.

- **FR-012**: The rewritten `optimize.md` MUST cover RN-specific performance: re-render hot paths, FlatList virtualization tuning, Hermes, InteractionManager, bridge serialization (old arch), JS thread vs. UI thread, memory pressure on Android, and the New Architecture (Fabric + TurboModules) when detected.

- **FR-013**: The rewritten `typeset.md` MUST cover platform font defaults (SF Pro / Roboto), `allowFontScaling`, Dynamic Type, font-weight availability differences, custom font loading via expo-font.

- **FR-014**: The rewritten `colorize.md` MUST be token-driven and cover light/dark theming via `useColorScheme()` and Appearance, plus iOS tint color and Android Material You opt-out stances.

- **FR-015**: The rewritten `harden.md` MUST include RN-specific edge cases (notch/island/keyboard avoidance, offline state, slow network, background-to-foreground, app-killed-and-restored, deep links) in addition to the universal harden checklist from upstream.

- **FR-016**: The rewritten `extract.md` MUST extract patterns from TS/TSX (not CSS), target a `tokens.ts` module plus a components folder, and detect RN-specific duplication (inline style literals, repeated `shadow*` props).

- **FR-017**: Every rewritten reference MUST update every cross-reference to other commands so that the linked file exists, the section anchor (if any) resolves, and the suggested command is in the current 22-command set. References to `live` MUST be removed entirely.

- **FR-018**: Every rewritten reference MUST replace `impeccable` with `impeccable-native` in all command invocations and skill-name mentions, while preserving the `{{command_prefix}}`, `{{scripts_path}}`, `{{model}}`, `{{ask_instruction}}`, `{{config_file}}` template placeholders verbatim.

- **FR-019**: After every reference rewrite, the build (`node scripts/build.js`) MUST exit 0 and synchronize the changes into `.claude/skills/impeccable-native/` and `.cursor/skills/impeccable-native/`, per constitution Principle V. The build is the acceptance gate for each file.

- **FR-020**: The domain reference files that contain no platform-specific code (`heuristics-scoring.md`, `cognitive-load.md`, `interaction-design.md`, `ux-writing.md`, `personas.md`) MAY be left as-is or updated only where they reference web-only concepts (e.g., "browser", "hover"). Their methodology MUST NOT be re-derived.

### Key Entities

- **Reference file**: a single `.md` file under `skill/reference/`. Each one is the contract for one impeccable-native sub-command. Has methodology that survives the rewrite and implementation guidance that does not.

- **Command**: one of the 22 user-invocable sub-commands (`craft`, `audit`, `polish`, etc.). Backed by exactly one reference file. Listed in the router table in `SKILL.md` and in `command-metadata.json`.

- **Token module shape**: the `tokens.ts` structure documented in the `DESIGN.md` template at the repo root (light/dark color objects, type scale, space scale, radius, platform-split shadows, motion durations). The contract that `document.md` produces and that every code-emitting reference consumes.

- **Methodology asset**: the gates, interview cadences, brief structures, scoring frameworks, anti-reflex checks, and dual-assessment patterns inherited from upstream impeccable. The asset that constitution Principle I mandates be preserved through every rewrite.

- **Platform parity gate**: the explicit checkpoint requiring iOS and Android inspection before declaring craft/audit/animate work complete. Lives in `craft.md` as a build-stage gate and in `audit.md` as a scored dimension.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the 20 in-scope reference files are RN-converted, with the build staying green after each one.

- **SC-002**: Zero references to web-only APIs across all rewritten files when measured by automated grep (`:hover`, `@media`, `clamp(`, `oklch(`, `prefers-reduced-motion`, `localStorage`, `document.`, `window.`, `border-left:.*px`, `WebGL`, `View Transition`, `:focus-visible`, `background-clip`) — within prose, code, and examples, with the only allowed exception being explicit "do not use this" anti-pattern callouts.

- **SC-003**: Zero remaining references to `/impeccable ` (without `-native`) or `live` command anywhere in the rewritten files.

- **SC-004**: Every code sample in every rewritten reference is syntactically valid TypeScript React Native that compiles against a current Expo SDK (verified by smoke-running representative samples on at least one reviewer's machine).

- **SC-005**: A developer reading any rewritten reference can identify the corresponding upstream methodology section within 60 seconds — gate names, interview round counts, brief section numbers, scoring matrices remain recognizable. (Spot-check by comparing 3 random rewritten references against their upstream counterparts.)

- **SC-006**: `craft.md` contains an iOS + Android parity gate that is explicitly described as unskippable; `audit.md` includes "platform parity" as a scored dimension.

- **SC-007**: 100% of cross-references between rewritten reference files resolve — every `[link](reference/X.md)` and every `{{command_prefix}}impeccable-native <cmd>` mention points to a file that exists and a command that is in the current 22-command set.

- **SC-008**: After the last rewrite, all five constitution principles can be verified against the rewritten set with no exceptions filed.

## Assumptions

- **Reference files in scope**: 20 files. The `live.md` reference is already deleted (Phase 0). The two already-converted references (`teach.md`, `shape.md`) are in scope only for cross-reference validation, not for re-rewriting.
- **Methodology source of truth**: upstream impeccable files at the point of the fork. Cross-checking against the upstream repo is acceptable when methodology drift is suspected.
- **Build and tests stay green**: every file change is followed by `node scripts/build.js` and `node --test tests/...`. The contributor does this; the spec assumes it.
- **NativeWind support is deferred**: per constitution Principle III, the references will be written for StyleSheet+tokens only. A future feature spec will add NativeWind support.
- **Domain references are skipped**: `heuristics-scoring.md`, `cognitive-load.md`, `interaction-design.md`, `ux-writing.md`, `personas.md` are not rewritten. They may receive small edits where they reference web-only concepts, but that work is not gated by this spec.
- **One file at a time**: rewrites proceed in the dogfood order from `IMPECCABLE.md` Phase 2 (`document` → `craft` → `audit` → `critique` → refinement set → `animate`/`overdrive` → rest). User confirms each before the next begins.
- **Subagent (`impeccable-asset-producer`)**: its rewrite for SVG-first / multi-density / app icons / splash screens is out of scope for this spec and will be tracked as a follow-up feature.
- **New RN scripts**: `extract-tokens.mjs`, `platform-parity.mjs`, `a11y-audit.mjs`, `screenshot.mjs` listed in `SKILL.md` `allowed-tools` are placeholders. References may invoke them in their guidance, but actually writing those scripts is out of scope for this spec and tracked as a separate follow-up feature.
- **Dogfood project**: a small Expo example app for live testing is desirable but not required for this spec to be considered complete. Where references can be verified by reading + manual code-review alone, that is sufficient.
