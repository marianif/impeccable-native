What is impeccable?

It's a Claude Code skill (slash command plugin) that acts as a full-service frontend
design agent. When you type /impeccable in Claude Code, it routes to this skill and
Claude becomes a senior product designer + frontend engineer hybrid — reading your
project's brand/design context and producing real, production-quality code.

---

Architecture: 4 layers

1. Entry point — SKILL.md

This is the brain. It's a structured instruction file that Claude reads as a system
prompt when the skill is invoked. It defines:

- Routing rules: no argument → show menu; first word matches a command → load that
  command's reference; freeform → general design mode
- Shared design laws: color (OKLCH only, never pure black/white), typography, layout,
  motion, absolute bans (no gradient text, no glassmorphism-by-default, no side-stripe
  borders, etc.)
- The "AI slop test": two-pass check to catch first-order and second-order
  training-data reflexes
- The register system: every task is classified as brand (portfolio, landing pages) or
  product (dashboards, tools) — different reference files apply to each

2. Command references — reference/\*.md

21 command files, each a deep specification for one design operation:

┌──────────┬────────────────────────────────────────────────────────┐
│ Category │ Commands │
├──────────┼────────────────────────────────────────────────────────┤
│ Build │ craft, shape, teach, document, extract │
├──────────┼────────────────────────────────────────────────────────┤
│ Evaluate │ critique, audit │
├──────────┼────────────────────────────────────────────────────────┤
│ Refine │ polish, bolder, quieter, distill, harden, onboard │
├──────────┼────────────────────────────────────────────────────────┤
│ Enhance │ animate, colorize, typeset, layout, delight, overdrive │
├──────────┼────────────────────────────────────────────────────────┤
│ Fix │ clarify, adapt, optimize │
├──────────┼────────────────────────────────────────────────────────┤
│ Iterate │ live │
└──────────┴────────────────────────────────────────────────────────┘

Each file is a detailed protocol. For example:

- craft.md: multi-gate flow (shape → visual direction → mock approval → build → inspect
  → present). Cannot compress gates.
- overdrive.md: propose 2-3 radically different directions first, get user approval,
  then use WebGL/shaders/spring physics/scroll-driven animations to push past browser
  conventions. Hard rules: 60fps, prefers-reduced-motion, progressive enhancement always.
- live.md: the most complex — a full stateful browser iteration protocol (described
  below).

3. The live subsystem — scripts/live-\*.mjs

This is the most technically sophisticated piece. It enables real-time in-browser
design iteration:

live.mjs → boots everything, starts HTTP server, injects script tag into HTML
live-server.mjs → small HTTP server that serves /live.js (browser overlay) + SSE +
/poll
live-inject.mjs → injects <script src="localhost:8400/live.js"> into project HTML
files
live-poll.mjs → Claude polls this in a loop; returns generate/accept/discard/exit
events
live-wrap.mjs → finds the picked element in source files, inserts variant wrapper
markers
live-accept.mjs → on user accept: strips variant wrappers, carbonizes chosen variant
to source
live-complete.mjs → finalizes a carbonize session (rewrites @scope CSS into real
classes)
live-session-store.mjs → durable append-only journal for crash recovery

The flow: user clicks an element in the browser → browser sends generate event → Claude
reads the element's HTML/computed styles, plans 3 distinct variants within brand
identity, writes all 3 into source in one edit with data-impeccable-variant wrappers →
user cycles through variants in the browser overlay → user accepts one →
live-accept.mjs strips the other 2 and "carbonizes" the accepted variant into permanent
clean source code.

4. Context system — scripts/load-context.mjs + PRODUCT.md/DESIGN.md

Every command starts by loading project context:

- PRODUCT.md: who the users are, brand voice, anti-references, strategic principles
- DESIGN.md: colors, typography, spacing tokens, component patterns

The loader resolves these from cwd → .agents/context/ → docs/ with case-insensitive
matching. If PRODUCT.md is missing, the skill blocks and runs /impeccable teach first —
an interview that creates it.

5. Subagent — agents/impeccable-asset-producer.md

A specialized sub-agent for image/asset production during craft. It takes approved
design mocks and slices them into clean raster assets (webp/png), classifying each
element as produce (needs generation), direct (can ship as-is), or semantic (build in
HTML/CSS, no raster needed). It never redesigns — pure production cleanup.

---

How it's wired into Claude Code

The SKILL.md frontmatter declares:
name: impeccable
user-invocable: true
allowed-tools: - Bash(npx impeccable \*)

Claude Code reads this and registers /impeccable as a slash command. The argument-hint
field ([command] [target]) drives the autocomplete hint you see in the prompt.

The pin.mjs script lets you create shortcuts: node pin.mjs pin craft → registers /craft
as a direct alias for /impeccable craft, writing into all harness directories it finds
in the project.

---

The design philosophy baked in

The skill is opinionated in specific ways you'll notice when using it:

1. Anti-reflexes over rules: instead of "use this color palette," it says "if your
   choice would be guessable from the product category alone, rework it." Forces genuine
   design thinking.
2. Gates that cannot be compressed: craft has 4 explicit user checkpoints. The
   instruction says "shape confirmation alone is NOT a green light to start coding" — it
   has to be stated that explicitly because models default to compressing.
3. Identity-first live mode: the live variant system defaults to varying within your
   existing brand identity (~90% of sessions), not proposing new directions. Departure
   mode requires explicit triggers.
4. The carbonize cleanup: accepted variants go through a mandatory rewrite step that
   strips all live-mode plumbing (@scope rules, data-impeccable-variant wrappers, marker
   comments) into clean, semantic, permanent source. No cruft accumulates.

In short: it's a structured AI design methodology encoded as executable Claude
instructions, with a real browser-integration runtime for the live command.

---

Fork roadmap: impeccable-native

Strategic frame

The web version of impeccable rests on three load-bearing assumptions that all break on
React Native:

1. A DOM with cascading CSS → RN has no cascade, no @scope, no pseudo-selectors, no
   media queries (in CSS form), no :hover, no prefers-reduced-motion (it has the API, not
   the CSS query). Style is an object passed as a prop.
2. A browser as the rendering target → RN renders to UIKit/Android Views/Fabric. WebGL
   becomes Skia + Reanimated worklets. CSS animations become Reanimated shared values.
   View Transitions doesn't exist.
3. HTML semantics for a11y → RN a11y is accessibilityRole, accessibilityLabel,
   accessibilityState, plus platform-specific quirks (VoiceOver vs TalkBack diverge
   meaningfully).

Your fork's central claim is: the design methodology (registers, the AI slop test, the
anti-reflex checks, the gates in craft, the identity-lock thinking in live) transfers
cleanly. The implementation manuals (every reference file's technical guidance) must be
rewritten.

Don't try to make web-impeccable understand RN. Hard-fork. Different skill name,
different references, share the philosophy and the script harness pattern but nothing
else literal.

---

Phase 0 — Scaffold the fork (1–2 days)

Goal: working skeleton that Claude Code recognizes and routes.

1. Fork the repo under a new name. Suggested: impeccable-native (clear lineage). Update
   NOTICE.md to credit web-impeccable as upstream.
2. Rewrite SKILL.md top-to-bottom. Same structure (registers, shared laws, commands
   table, routing rules), RN-specific content:


    - Replace OKLCH guidance with: still use HSL/OKLCH in tokens, but RN consumes

hex/rgba — emit both. - Replace "never use #000/#fff" with the same rule, but the implementation note is
"tint your token file, not your StyleSheet." - Replace "absolute bans" — keep most (cards-as-default, modal-as-first-thought,
identical card grids: even worse on mobile), drop "gradient text" (RN can't do
background-clip: text natively — guide to MaskedView + LinearGradient or skip it), drop
"side-stripe borders" generic ban (Border-left as a chevron-style affordance is more
common in mobile lists; reframe rather than ban). - Add new bans: floating action button as default, bottom-sheet for every secondary
action, hamburger menu when bottom tabs would work, gradient buttons that scream "AI
app". 3. Set up the two-flavor branching upfront. A small detector script
detect-rn-flavor.mjs that returns:
{ "flavor": "expo" | "bare", "router": "expo-router" | "react-navigation" | "unknown",
"styling": "stylesheet" | "nativewind" | "unistyles" | "unknown", "newArch": true|false
} 3. Every command reference reads this and adapts. You said "agnostic, detect from
project" wasn't your pick for styling — but you do need flavor detection for navigation
and architecture (old vs new arch changes what Reanimated/Skia versions are safe). 4. Pin the script. node scripts/pin.mjs pin <command> keeps working — directly portable
from upstream.

---

Phase 1 — Context system: PRODUCT.md stays, DESIGN.md transforms

Keep PRODUCT.md essentially unchanged. Brand voice, anti-references, users, register —
all platform-agnostic.

Rewrite DESIGN.md template completely. Web DESIGN.md captures CSS custom properties; RN
DESIGN.md captures a tokens module. Structure:

// tokens.ts — what document.mjs generates
export const tokens = {
color: { /_ surface/text/accent roles, light + dark variants _/ },
type: { /_ font families, sizes, lineHeights, letterSpacing _/ },
space: { /_ 4/8 scale _/ },
radius: { /_ sm/md/lg/full _/ },
shadow: { /_ iOS shadow_ + Android elevation pairs _/ },
motion: { /_ timing tokens for Reanimated \*/ },
};

The /impeccable-native document command extracts this from the existing codebase (greps
StyleSheet calls, finds duplicated values, proposes consolidation). The /teach command
runs the same interview but the brand-personality questions get RN-specific
anti-references ("not another Material 3 default", "not a Stripe-cream finance app").

Critical addition: capture platform stance in PRODUCT.md. New field: platform-fidelity
= cupertino-android-pragmatic | material-everywhere | cupertino-everywhere |
custom-cross-platform. This is the RN equivalent of dark/light theme thinking — it's a
deliberate choice, not a default.

---

Phase 2 — Rewrite the reference files

Per-command, what changes:

Direct ports (~25% rewrite)

These keep their methodology, only swap technical guidance:

- shape.md — design brief structure is the same. Swap "Recommended References" list to
  RN ones.
- teach.md — interview script. Add platform-fidelity question. Add "primary device"
  (phone-only? phone+tablet? foldables?).
- document.md — output format changes (tokens.ts not CSS custom properties), extraction
  logic changes (parse StyleSheet.create not :root).
- critique.md — heuristics still apply, scoring still applies. Add mobile-specific
  heuristics: thumb-zone reachability, touch target ≥44pt, gesture conflicts, system back
  behavior.
- audit.md — completely different checklist. See Phase 3.
- bolder.md, quieter.md, distill.md, polish.md, clarify.md, delight.md, harden.md,
  onboard.md — methodology survives, examples rewrite. harden gets RN-specific:
  notch/island/keyboard avoidance, offline state, slow network, background-to-foreground
  state, app-killed-and-restored, deep links.

Significant rewrites (~50% new content)

- craft.md — gates structure stays. Replace "browser inspection" with "device +
  simulator inspection" (iOS sim, Android emu, real device on Expo Go / dev client). New
  section: platform parity check — every craft output must be inspected on iOS AND
  Android. The single biggest RN failure mode is "looks great on the sim I'm using." Add
  an explicit gate for it.
- adapt.md — entirely different meaning. Web adapt = breakpoints. RN adapt =
  phone↔tablet, portrait↔landscape, Dynamic Type (iOS) / font scale (Android), safe
  areas, foldables, large-text accessibility. Treat as a near-complete rewrite.
- layout.md — Flexbox is most of it (RN uses Yoga, same model). But: no gap in older RN
  versions; differences in default flexDirection (column in RN, row in web); no
  position: sticky; ScrollView vs FlatList vs SectionList performance trade-offs;
  bottom-sheet patterns; tab/stack/drawer composition.
- typeset.md — drop "font-loading strategy" (Expo Font / RN Font), replace with: font
  families on iOS vs Android (San Francisco vs Roboto by default), allowFontScaling,
  Dynamic Type respect, font weights that are missing on Android, custom font fallbacks.
- colorize.md — token-driven; covers light/dark theming via useColorScheme() and
  Appearance, plus what to do about iOS tint color and Android Material You opt-out.

Near-total rewrites (~80%+ new)

- animate.md — Reanimated 3+ worklets, shared values, useAnimatedStyle, withSpring
  (spring physics is built in, not "roll your own"), useDerivedValue, gesture handler
  integration, layout animations (Layout, FadeIn/FadeOut etc.), useReducedMotion from
  react-native-reanimated. Reference Moti as the higher-level option. Reference Skia for
  canvas-grade work.
- overdrive.md — your toolkit is completely different: Skia (paths, shaders, image
  filters, particle systems), Reanimated worklets running on the UI thread, gesture
  handler with rotation/pinch/pan composition, MaskedView, BlurView (native), shared
  element transitions via react-native-shared-element or Expo Router's experimental
  shared element API, haptics (expo-haptics) as a real design tool RN can use that web
  can't. Drop everything WebGL/View Transitions API/@property. Add: 120Hz ProMotion /
  high-refresh-rate Android — if the device supports it, your animations should run at
  120fps, not 60.
- optimize.md — RN performance is a different beast. New arch (Fabric, TurboModules) vs
  old. FlatList virtualization tuning (windowSize, removeClippedSubviews,
  getItemLayout). Image optimization (expo-image with caching, recyclingKey).
  InteractionManager.runAfterInteractions. Bridge serialization costs (old arch). Hermes
  byte-code. Re-renders from inline styles / inline arrays. JS thread vs UI thread
  responsibility. Memory pressure on Android.
- extract.md — extracts to a tokens module, components folder, design system. Different
  glob patterns, different ASTs (TS/TSX not CSS).

---

Phase 3 — Replace the audit checklist (1 week)

The audit dimensions change. Propose this matrix replacing the web one:

┌───────────────────┬──────────────────────────────────────────────────────────────┐
│ Web audit │ RN audit dimension │
│ dimension │ │
├───────────────────┼──────────────────────────────────────────────────────────────┤
│ │ A11y (RN: accessibilityRole, label/hint pairing, │
│ A11y (WCAG, ARIA) │ VoiceOver+TalkBack parity, focus order, dynamic type, reduce │
│ │ motion respect) │
├───────────────────┼──────────────────────────────────────────────────────────────┤
│ Performance │ Performance (re-render hot paths, FlatList config, JS thread │
│ (layout thrash, │ blocking, image memory, bridge calls on old arch, │
│ bundle) │ Hermes-ready) │
├───────────────────┼──────────────────────────────────────────────────────────────┤
│ Theming │ Theming (light/dark, useColorScheme, system theme follow vs │
│ │ forced) │
├───────────────────┼──────────────────────────────────────────────────────────────┤
│ Responsive │ Adaptive (phone/tablet, safe areas, keyboard avoidance, │
│ │ orientation, foldables, Dynamic Type ramps) │
├───────────────────┼──────────────────────────────────────────────────────────────┤
│ │ RN anti-patterns (FAB-as-default, hamburger over tabs, │
│ Anti-patterns │ modal-instead-of-bottom-sheet, deep nested ScrollViews, │
│ │ inline styles in hot paths, Image for >100kB assets, missing │
│ │ key extractors) │
└───────────────────┴──────────────────────────────────────────────────────────────┘

Plus a new dimension specific to RN: platform fidelity (does iOS feel iOS-native where
the brand demands it; same for Android; or is the cross-platform custom design coherent
on both?).

---

Phase 4 — The asset producer subagent

Keep impeccable-asset-producer.md but rewrite its semantic-vs-raster guidance. The big
change:

- SVG is more important on RN than web. react-native-svg is mature; ship vector assets,
  not raster, whenever the source allows. Update the agent to prefer SVG more
  aggressively than the web version.
- Multi-density raster is mandatory: @1x, @2x, @3x for iOS,
  mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi for Android. Or push to expo-image + a single high-res
  asset and let it scale.
- App icons + splash screens become first-class outputs (web doesn't really need this;
  mobile always does). Add a workflow: from a single high-res mark, produce all required
  sizes via expo-asset configs or native asset catalogs.
- Drop "perspective" guidance (no CSS 3D transforms in the same way; Reanimated does
  limited 3D).

---

Phase 5 — New scripts

You're dropping live, but you should add RN-specific tooling:

- detect-rn-flavor.mjs (above).
- extract-tokens.mjs — parses TS/TSX, finds StyleSheet.create blocks, surfaces
  duplicated literals (colors, sizes), proposes a tokens.ts.
- platform-parity.mjs — given a component file, statically checks for known iOS/Android
  divergence pitfalls (shadowColor only on iOS without elevation, Platform.select
  missing on platform-divergent props, KeyboardAvoidingView without behavior differing by
  platform).
- a11y-audit.mjs — static analysis: every Pressable/TouchableOpacity has
  accessibilityRole + accessibilityLabel, every Image has accessibilityLabel or
  accessibilityElementsHidden, no accessibilityLabel on decorative elements.
- screenshot.mjs — optional helper that wraps xcrun simctl io ... screenshot and adb
  exec-out screencap so Claude can request "screenshot the current sim state"
  deterministically. This is your partial answer to dropping live — even without an
  in-app overlay, Claude can iterate against screenshots.

---

Phase 6 — Distribution & docs

- README.md explaining lineage (forked from impeccable, web-specific live removed,
  RN-rewritten references) and Apache 2.0 attribution.
- install.md with the Claude Code skill install path and pin shortcuts.
- Example project: a small Expo app with PRODUCT.md + DESIGN.md already populated, so
  users can see the skill operating on a real codebase before committing.
- A "what's intentionally not here" section: live mode, gradient text bans, WebGL
  guidance. Set expectations.

---

Sequence & timing

The critical path is Phase 2 (reference rewrites). Everything else is unlocked once
those exist. I'd suggest writing them in this order, because each unlocks dogfooding
the next:

1. teach.md, document.md, shape.md (so you can populate context for an example app)
2. craft.md (so you can build something)
3. audit.md, critique.md (so you can evaluate what you built)
4. polish.md, bolder.md, quieter.md, harden.md, adapt.md (refinement passes on the
   example)
5. animate.md, overdrive.md (the showcase commands)
6. Everything else

Dogfood on your own RN project from Phase 2 onward. Every reference file should be born
from solving a real problem on a real app, not written cold.

---

Two risks worth naming now

1. The "agnostic styling" trap. You picked StyleSheet + tokens, which is clean. But a
   significant slice of RN devs are on NativeWind. If your skill assumes StyleSheet and a
   NativeWind user invokes it, the output is wrong-shaped. Decide early: hard-pin
   StyleSheet (cleaner, narrower audience), or add NativeWind as a detected fallback in
   detect-rn-flavor.mjs (broader, more conditional logic in references). Don't pretend
   you'll handle this later — it leaks into every code-emitting command.
2. iOS-Android parity is brutal. Web has cross-browser drift; mobile has cross-platform
   drift that's an order of magnitude worse. Build the platform-parity gate into craft
   from day one. The web skill's "inspect in browser" line maps to "inspect on iOS sim AND
   Android emu" — and if you let the model skip Android because it's slower to spin up,
   your skill will quietly become an iOS-only tool. Make the gate explicit and
   unskippable, like the web version's gate compression warnings.
