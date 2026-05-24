---
name: impeccable-native
description: "Use when the user wants to design, build, critique, audit, polish, clarify, harden, optimize, adapt, animate, colorize, or otherwise improve a React Native or Expo mobile interface. Covers app screens, navigation flows, component design, onboarding, empty states, settings, dashboards, and mobile design systems. Handles visual hierarchy, touch targets, safe areas, platform parity (iOS/Android), accessibility (VoiceOver/TalkBack), performance (re-renders, FlatList), theming (light/dark), typography (Dynamic Type, font scaling), motion (Reanimated 3, Moti), layout (Yoga flexbox), and token-based design systems. Also use for bland mobile UIs that need more personality, overdesigned UIs that should be quieter, or ambitious effects with Skia and Reanimated. Not for web, backend, or non-UI tasks."
argument-hint: "[{{command_hint}}] [target]"
user-invocable: true
allowed-tools:
  - Bash(node {{scripts_path}}/detect-rn-flavor.mjs)
  - Bash(node {{scripts_path}}/load-context.mjs)
  - Bash(node {{scripts_path}}/extract-tokens.mjs *)
  - Bash(node {{scripts_path}}/platform-parity.mjs *)
  - Bash(node {{scripts_path}}/a11y-audit.mjs *)
  - Bash(node {{scripts_path}}/break-scan.mjs *)
  - Bash(node {{scripts_path}}/rethink-scan.mjs *)
  - Bash(node {{scripts_path}}/flow-scan.mjs *)
  - Bash(node {{scripts_path}}/migration/migration-scan.mjs *)
  - Bash(node {{scripts_path}}/migration/migration-scope.mjs *)
  - Bash(node {{scripts_path}}/migration/dependency-order.mjs *)
  - Bash(node .impeccable/generated/*.mjs *)
  - Bash(node {{scripts_path}}/shared/token-graph.mjs *)
  - Bash(node {{scripts_path}}/shared/hardcoded-violations.mjs *)
  - Bash(node {{scripts_path}}/rebrand/rebrand-scan.mjs *)
  - Bash(node {{scripts_path}}/rebrand/style-inventory.mjs *)
  - Bash(node {{scripts_path}}/rebrand/vibe-fingerprint.mjs *)
  - Bash(node {{scripts_path}}/rebrand/incoherence-report.mjs *)
  - Bash(node {{scripts_path}}/design-system/design-system-scan.mjs *)
  - Bash(node {{scripts_path}}/design-system/directory-tree.mjs *)
  - Bash(node {{scripts_path}}/design-system/component-inventory.mjs *)
  - Bash(node {{scripts_path}}/design-system/duplication-report.mjs *)
  - Bash(node {{scripts_path}}/design-system/dead-code-report.mjs *)
  - Bash(node {{scripts_path}}/design-system/composition-patterns.mjs *)
  - Bash(node {{scripts_path}}/design-system/app-anatomy.mjs *)
  - Bash(node {{scripts_path}}/design-system/screen-choreography.mjs *)
  - Bash(node {{scripts_path}}/design-system/validate-plan.mjs *)
  - Bash(node {{scripts_path}}/screenshot.mjs *)
  - Bash(node {{scripts_path}}/pin.mjs *)
license: Apache 2.0. Forked from impeccable by Paul Bakaus. See NOTICE.md for attribution.
---

Designs and iterates production-grade React Native and Expo interfaces. Real working code, committed design choices, exceptional mobile craft.

## Setup

Before any design work or file edits:

1. Detect the project flavor via the flavor script.
2. Load context (PRODUCT.md / DESIGN.md) via the loader script.
3. Identify the register and load the matching register reference (brand.md or product.md).
4. **If the user invoked a sub-command, load its reference file too.** Non-negotiable.

Skipping these produces generic output that ignores the project's platform, styling approach, and token system.

### 1. Flavor detection

Run first, before context:

```bash
node {{scripts_path}}/detect-rn-flavor.mjs
```

Store the result for the session. Key fields and what they change:

- `flavor: "expo"` — use Expo SDK APIs (expo-image, expo-haptics, expo-font, expo-router). `flavor: "bare"` — use community packages directly.
- `router: "expo-router"` — file-based routing; routes are files under `app/`. `router: "react-navigation"` — imperative navigation; use `navigation.navigate()` and stack/tab navigators.
- `styling: "nativewind"` — project uses Tailwind class names via NativeWind. Note this to the user; this skill produces `StyleSheet.create` output by default. Offer to adapt output to NativeWind class names if the user prefers.
- `newArch: true` — New Architecture (Fabric + TurboModules); avoid legacy bridge patterns, synchronous native module calls, and `findNodeHandle`.
- `sdkVersion` — gate Expo SDK API usage on this version. SDK 50+ for new file-based routing patterns; SDK 52+ for React Native 0.76.
- `rnVersion` — gate RN API usage. 0.71+ for `gap` in flexbox; 0.73+ for New Architecture experimental support; 0.76+ for New Architecture default.

### 2. Context gathering

Two files, case-insensitive. The loader looks at the project root by default and falls back to `.agents/context/` and `docs/`.

- **PRODUCT.md**: required. Users, brand, platform-fidelity, primary-devices, principles.
- **DESIGN.md**: optional but strongly recommended. Token definitions (colors, typography, spacing, radii, shadows, motion).

```bash
node {{scripts_path}}/load-context.mjs
```

Consume the full JSON output. Never pipe through `head`, `tail`, `grep`, or `jq`.

If PRODUCT.md is missing or placeholder: run `{{command_prefix}}impeccable-native teach`, then resume. If DESIGN.md is missing: nudge once per session (*"Run `{{command_prefix}}impeccable-native document` for token-aware output"*), then proceed.

### 3. Register

Every design task is **brand** (splash screens, marketing surfaces, onboarding brand moments: design IS the product) or **product** (app UI, navigation flows, settings, dashboards: design SERVES the product).

Identify before designing. Priority: (1) cue in the task; (2) the surface in focus (screen, component, route); (3) `register` field in PRODUCT.md. First match wins.

Load the matching reference: [reference/brand.md](reference/brand.md) or [reference/product.md](reference/product.md). The shared design laws below apply to both.

## Shared design laws

Apply to every design, both registers. Mobile-first throughout: every decision is made in the context of a touch screen, a thumb, a variable ambient environment, and a user in motion.

### Color

Tokens first. RN StyleSheet does not accept OKLCH — emit hex or rgba values drawn from your tokens file. Keep OKLCH in your design thinking; convert to hex for code output. Never pure `#000000` or `#ffffff` — always tint toward the brand hue.

Every color role needs both light and dark variants. Implement dark mode via `useColorScheme()` and a conditional token lookup at the theme provider level — not inline ternaries scattered through components. A single `useTheme()` hook that returns the correct token set is the correct pattern.

Pick a **color strategy** before picking colors:
- **Restrained**: tinted neutrals + one accent used sparingly. Default for product apps; clean-tool aesthetic.
- **Committed**: one saturated color carries 30–60% of the surface. Brand apps, onboarding flows, hero screens.
- **Full palette**: 3–4 named roles, each used deliberately. Dashboards with data categories; apps with distinct modes.
- **Drenched**: the surface IS the color. Brand splash screens, campaign moments, personality-first onboarding.

### Theme

Dark vs. light is a deliberate scene decision, not a default. Before choosing, write one sentence of physical scene: who uses this app, where, under what ambient light, in what posture. "Fitness tracker" does not force an answer. "Runner glancing at pace on a bright outdoor screen mid-stride" does. Run the sentence.

Mobile adds two platform stances to the web rule:
- iOS system tint color is an opinion. State in PRODUCT.md `platform-fidelity` whether you override it. Overriding it requires explicit brand justification.
- Android Material You dynamic color extraction is opt-out behavior on Android 12+. State your stance: adopt it, override it, or gate it per `platform-fidelity`.

### Typography

`allowFontScaling` defaults to `true` — design for text reflow at 2x scale. iOS Dynamic Type and Android font scale will expand your layouts; test both extremes before shipping. Components with fixed-height containers and unscaled text are accessibility failures.

Platform defaults are SF Pro (iOS) and Roboto (Android). Use them unless brand demands otherwise — they are the most legible options on their respective platforms and carry zero loading cost. Custom fonts via expo-font (Expo) or react-native-font-face (bare). Load custom fonts before the splash screen clears.

No `clamp()` in React Native. If responsive type is needed, use `PixelRatio.getFontScale()` to compute a scaled size at render time. Cap the scale if the design breaks at extreme values: `Math.min(PixelRatio.getFontScale(), 1.5)` is a reasonable ceiling for display type.

Hierarchy through scale and weight contrast — at least a 1.25 ratio between adjacent type steps. Never flat scales where body and label are the same size.

### Layout

Yoga flexbox. Key divergences from web: `flexDirection` defaults to `"column"`, not `"row"`. No `gap` before RN 0.71 — use `marginBottom` per item or check the detected `rnVersion` before using gap. No `position: sticky` — use `SectionList` sticky headers or `Animated` scroll callbacks instead.

Use `SafeAreaView` or `useSafeAreaInsets()` from `react-native-safe-area-context` for notch, Dynamic Island, and home indicator. Never hardcode status bar heights. `KeyboardAvoidingView` with `behavior="padding"` on iOS and `behavior="height"` on Android. Test both.

Vary spacing for rhythm. The same padding everywhere is monotony. Screens feel cramped at uniform 16px padding and bloated at uniform 24px — vary by content zone and visual weight.

### Touch targets

44x44pt minimum on iOS (Human Interface Guidelines). 48x48dp minimum on Android (Material Guidelines). If a rendered tap target is smaller than these, it fails audit — no exceptions. `Pressable` `hitSlop` is the escape hatch when a visual element must be smaller, not the solution to under-sized designs. Use hitSlop only when the visual and interaction bounds genuinely need to differ.

### Motion

Reanimated 3 worklets run on the UI thread. Use `useAnimatedStyle`, `withSpring`, `withTiming`, `withSequence`. Never animate layout properties (`width`, `height`, `padding`, `margin`, `top`, `left`) — use `transform` and `opacity`. Animating layout properties drops to the JS thread and causes jank.

`useReducedMotion()` from react-native-reanimated — check it and respect it. Users with vestibular disorders depend on this. Reduced motion means: no entrance animations, no parallax, no continuous motion. State transitions can still use instant opacity changes.

120fps ProMotion on modern iPhones: spring configs should feel the difference. Lower damping ratios (0.7–0.8 instead of 1.0) and natural stiffness values create springs that read as alive on ProMotion without overshooting. Artificial frame caps defeat the display.

Ease out with exponential curves. `Easing.out(Easing.quart)` is the default exit. No bounce, no elastic, no overshoot on navigation transitions.

### Absolute bans

Match-and-refuse. If you are about to write any of these, rewrite the element with different structure.

- **Floating Action Button as default.** A FAB hides the primary action behind a floating circle in the corner. If you are about to write one, surface the action in the navigation bar, a prominent in-content button, or a swipe action instead. FABs are acceptable only when the action is truly global and undirected (e.g., compose in an email client).
- **Bottom sheet for every secondary action.** Exhaust inline contextual menus, swipe actions, and inline controls before reaching for a sheet. A sheet for "delete this item?" is laziness; a destructive swipe action is the answer.
- **Hamburger menu when bottom tabs work.** Two to five primary destinations belong in a tab bar. A hamburger hides navigation, increases tap depth, and trains users to ignore sections. Use it only when destinations exceed five or the navigation is genuinely secondary.
- **Gradient buttons that read as "AI app."** A LinearGradient-wrapped Pressable with a glow shadow. Rewrite with a solid brand color from the token system. The gradient adds no information and signals template-generated UI.
- **Identical list card grids.** Same-sized FlatList cards with icon + title + subtitle, repeated without variation. Vary layout between content types, use swipe actions to expose secondary operations, show contextual density based on content length.
- **Inline styles in hot paths.** `style={{ color: tokens.color.light.accent }}` inside a FlatList `renderItem` creates a new object on every render pass. Move all styles to `StyleSheet.create` outside the component body.
- **Modal as first thought.** Exhaust stack push, inline expansion, bottom sheet, and action sheet before a Modal. Modals on mobile are jarring — they interrupt flow and require an explicit dismiss gesture.

### Copy

Every word earns its place. No restated headings, no intro sentences that repeat the screen title. Mobile copy is read on small screens in interrupted contexts — shorter is almost always better.

No em dashes. Use commas, colons, semicolons, or periods. Not `--` either.

### The AI slop test

If someone could look at this screen and say "AI made that" without doubt, it has failed. Cross-register failures are the absolute bans above. Register-specific failures live in each reference file.

**Category-reflex check.** Run at two altitudes:

- **First-order:** if someone could guess the palette and visual language from the app category alone ("productivity app → dark blue gradient + sidebar", "health app → white + green + rounded cards", "finance app → navy + gold on iOS"), it is the first training-data reflex. Rework the scene sentence and color strategy until the answer is not obvious from the domain.
- **Second-order:** if someone could guess the aesthetic family from category-plus-anti-references ("fintech that's not navy → terminal dark + monospace", "wellness that's not white-green → editorial warm + serif"), it is the trap one tier deeper. The first reflex was avoided; the second was not. Rework until both answers are non-obvious.

## Commands

| Command | Category | Description | Reference |
|---|---|---|---|
| `craft [screen]` | Build | Shape, then build a screen or feature end-to-end | [reference/craft.md](reference/craft.md) |
| `shape [screen]` | Build | Plan UX/UI before writing any component code | [reference/shape.md](reference/shape.md) |
| `teach` | Build | Set up PRODUCT.md and DESIGN.md context for the project | [reference/teach.md](reference/teach.md) |
| `document` | Build | Generate DESIGN.md tokens from existing project code | [reference/document.md](reference/document.md) |
| `extract [target]` | Build | Pull reusable tokens and components into a design system | [reference/extract.md](reference/extract.md) |
| `critique [target]` | Evaluate | UX design review with heuristic scoring | [reference/critique.md](reference/critique.md) |
| `audit [target]` | Evaluate | Technical quality checks (a11y, perf, touch targets, safe areas) | [reference/audit.md](reference/audit.md) |
| `polish [target]` | Refine | Final quality pass before shipping | [reference/polish.md](reference/polish.md) |
| `bolder [target]` | Refine | Amplify safe or bland designs | [reference/bolder.md](reference/bolder.md) |
| `quieter [target]` | Refine | Tone down aggressive or overstimulating designs | [reference/quieter.md](reference/quieter.md) |
| `distill [target]` | Refine | Strip to essence, remove visual complexity | [reference/distill.md](reference/distill.md) |
| `harden [target]` | Refine | Production-ready: error states, edge cases, i18n, font scaling | [reference/harden.md](reference/harden.md) |
| `rethink [target]` | Refine | Purpose-driven redesign within the brand. Brand tokens are read-only; the creative work is making every UI choice trace back to the component's role in the choreography. Default after a rebrand or migration. | [reference/rethink.md](reference/rethink.md) |
| `break [target]` | Refine | Reimagine a component from scratch and *break* the design system to do it — then reconcile with the existing tokens (KEEP / UPDATE / NEW). Use when the brand itself is part of what's wrong. | [reference/break.md](reference/break.md) |
| `migration --scope=<scope>` | Evaluate | Replace the entire design system across a flow or app with a phased, script-driven plan | [reference/migration.md](reference/migration.md) |
| `rebrand [scan \| direction \| resume]` | Build | Author a new brand and design system from scratch — forensics on the current mess, then 3 divergent directions, then a brief that `migration` consumes | [reference/rebrand.md](reference/rebrand.md) |
| `design-system [scan \| plan \| execute \| resume]` | Build | Design the component layer as living things on screens — atoms, molecules, organisms tied to vibe, journey, and evidence. Brownfield: catalogues components, clusters duplicates, harvests implicit organisms, maps screen choreography. Greenfield: projects from brand brief + PRODUCT.md. Per-cluster cleanup approvals; organisms require the five-question gate (job / lives in / states / reacts to / neighbors) | [reference/design-system.md](reference/design-system.md) |
| `flow create \| rethink [name]` | Build | Design a user journey from scratch, or reshape an existing one — per-screen intent, emotional beat, decision, friction, plus a route/component scaffold | [reference/flow.md](reference/flow.md) |
| `onboard [target]` | Refine | Design first-run flows, empty states, activation screens | [reference/onboard.md](reference/onboard.md) |
| `animate [target]` | Enhance | Add purposeful Reanimated 3 animations and motion | [reference/animate.md](reference/animate.md) |
| `colorize [target]` | Enhance | Add strategic color to monochromatic UIs | [reference/colorize.md](reference/colorize.md) |
| `typeset [target]` | Enhance | Improve typography hierarchy and font usage | [reference/typeset.md](reference/typeset.md) |
| `layout [target]` | Enhance | Fix spacing, rhythm, safe areas, and visual hierarchy | [reference/layout.md](reference/layout.md) |
| `delight [target]` | Enhance | Add personality, haptics, and memorable micro-interactions | [reference/delight.md](reference/delight.md) |
| `overdrive [target]` | Enhance | Push past conventional limits with Skia and Reanimated | [reference/overdrive.md](reference/overdrive.md) |
| `clarify [target]` | Fix | Improve UX copy, labels, and error messages | [reference/clarify.md](reference/clarify.md) |
| `adapt [target]` | Fix | Adapt for different device sizes, orientations, and platforms | [reference/adapt.md](reference/adapt.md) |
| `optimize [target]` | Fix | Diagnose and fix UI performance (re-renders, FlatList, bridge) | [reference/optimize.md](reference/optimize.md) |

Plus two management commands: `pin <command>` and `unpin <command>`, detailed below.

### Routing rules

1. **No argument**: render the table above as the user-facing command menu, grouped by category. Ask what they would like to do.
2. **First word matches a command**: load its reference file and follow its instructions. Everything after the command name is the target.
3. **First word does not match**: general design invocation. Apply the setup steps, shared design laws, and the loaded register reference, using the full argument as context.

Setup (flavor detection, context gathering, register) is already loaded by then; sub-commands do not re-invoke `{{command_prefix}}impeccable-native`.

If the first word is `craft`, setup still runs first, but [reference/craft.md](reference/craft.md) owns the rest of the flow. If setup invokes `teach` as a blocker, finish teach, refresh context, then resume the original command and target.

## Pin / Unpin

**Pin** creates a standalone shortcut so `{{command_prefix}}<command>` invokes `{{command_prefix}}impeccable-native <command>` directly. **Unpin** removes it. The script writes to every harness directory present in the project.

```bash
node {{scripts_path}}/pin.mjs <pin|unpin> <command>
```

Valid `<command>` is any command from the table above. Report the script's result concisely. Confirm the new shortcut on success, relay stderr verbatim on error.
