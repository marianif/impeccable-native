# Migration Tracker: impeccable → impeccable-native

Status of each reference file under `skill/reference/` as we port the upstream web skill to React Native.

Legend:
- ✅ **Done** — file has been audited and is RN-correct
- 🟡 **In progress** — currently being worked on
- ⬜ **Todo** — still upstream web content; needs work
- 🔵 **No-op** — platform-agnostic, no changes needed (verify only)
- ❌ **Removed** — deleted in fork (web-only)

Classification (rewrite weight) follows IMPECCABLE.md Phase 2 buckets:
- **Direct port (~25% rewrite)** — methodology survives, swap technical examples
- **Significant rewrite (~50%)** — methodology stays, large content swap
- **Near-total rewrite (~80%+)** — toolkit and concepts diverge fundamentally

---

## Commands (22 sub-commands, one reference each)

### Build

| File | Status | Weight | Notes |
|------|:------:|--------|-------|
| `teach.md` | ✅ | Direct port | Adds `platform-fidelity` + `primary-devices` interview rounds; PRODUCT.md template swapped to RN shape; DESIGN.md now produces `tokens.ts` shape. |
| `document.md` | ✅ | Near-total | Rewritten for RN: YAML frontmatter trimmed to name/description; output is a TypeScript `tokens.ts` module + 5 sections (Overview, Tokens, Components, Platform Notes, Do's and Don'ts); sidecar `.impeccable/design.json` eliminated; asset discovery rewritten to mine `StyleSheet.create`, `useColorScheme`, `expo-font`, Reanimated/Moti; platform-split shadow tokens mandatory; `useTheme()` at provider; Motion stance (restrained/responsive/choreographed) added as Step 3 input. |
| `shape.md` | ✅ | Direct port | RN anchor references (Revolut/Duolingo/Things 3); RN constraints (RN version, new arch, safe areas, foldables); Yoga/FlatList layout vocabulary; touch/swipe/haptics interaction model; expo-image/SVG/Skia content sourcing. |
| `craft.md` | ✅ | Significant | Already RN-native pre-session — flavor detection at Step 0, iOS+Android parity gate, production bar with tokens/SafeArea/Dynamic Type/Reanimated 3/expo-image/FlatList perf/VoiceOver+TalkBack. |
| `extract.md` | ⬜ | Significant | Extracts to design system. Web version parses CSS; RN version parses TS/TSX, extracts to `tokens.ts` + components folder. |

### Evaluate

| File | Status | Weight | Notes |
|------|:------:|--------|-------|
| `critique.md` | ✅ | Significant | Dual-assessment orchestration preserved. Assessment A reads source + simulator screenshots (iOS + Android, light/dark, Dynamic Type 2×) using `screenshot.mjs`; Nielsen heuristics reinterpreted for mobile. Assessment B swaps web detector for `a11y-audit.mjs` + `platform-parity.mjs` + `extract-tokens.mjs --dry-run` plus simulator-driven probes (VoiceOver/TalkBack, Reduce Motion, Android back, keyboard avoidance). Persona red flags rewritten with mobile-specific fail modes. Platform Coverage section added; single-platform critique flagged as incomplete per Constitution Principle IV. Persistence metadata extended with `platforms` + `incomplete` fields. |
| `audit.md` | ✅ | Significant | 6-dimension RN-native framework: A11y (VoiceOver+TalkBack parity, accessibilityRole/Label/State, Dynamic Type 2×, reduced motion), Performance (FlatList tuning, Reanimated worklets, expo-image, Hermes), Theming (`useTheme()` provider, light+dark, platform-split shadows, font loading), Adaptive (safe areas, touch targets, phone/tablet, orientation, keyboard avoidance, Dynamic Type), Anti-Patterns (AI-slop tells + RN-specific: FAB-default, hamburger-over-tabs, modal-first, nested ScrollView, raw Image, missing keyExtractor), Platform Fidelity as CRITICAL Principle IV gate — single-platform audit is automatic P0. Total scale /24. |

### Refine

| File | Status | Weight | Notes |
|------|:------:|--------|-------|
| `polish.md` | ✅ | Direct port | Rewritten for RN: simulator + emulator probe loop (Principle IV), `tokens.ts` + `useTheme()` replaces CSS custom properties, `accessibilityRole`/`Label`/`State` replaces ARIA, Reanimated 3 worklets + spring presets replace CSS easing, Adaptive section (safe areas, `hitSlop`, Dynamic Type 2×, foldables) replaces breakpoints, new **Haptics** section (`expo-haptics` peak-end, iOS-only haptics flagged), new **Platform Fidelity** section (stance, platform-split shadows, Android back, swipe-to-go-back). Dropped: line-length/widow/orphan/kerning/FOUT/CLS/focus-ring on phone. |
| `bolder.md` | ✅ | Direct port | Rewritten for RN: amplification via `tokens.type` 5-role scale (widen display↔body gap, snap to Android-mappable weights `400/500/700/900`, `maxFontSizeMultiplier={1.4}` instead of disabling scaling), parallel light/dark palettes with one-accent commitment + OLED `#000` warning (substitute `#0A0A0B`), spatial drama via `tokens.space` step jumps + safe-area composition + platform-split shadows + `tokens.radius`, motion via Reanimated `FadeInDown.springify()` / `Layout.springify()` + `expo-haptics` on primary CTA + 120Hz ProMotion. AI-slop reflex list for mobile AI-app aesthetic. Platform Fidelity gate in Assess + Verify. |
| `quieter.md` | ✅ | Direct port | Rewritten for RN: shadow quieting via platform-split tokens (iOS `shadowOpacity` 0.04–0.06, Android `elevation: 1–2`), cards-to-dividers using `tokens.color.border.subtle` + `StyleSheet.hairlineWidth`, springs-to-timing for chrome (`Easing.out(Easing.quart)` + shortened `tokens.motion.duration`), `useReducedMotion()` as design floor. New **Interaction Quieting** section: Android ripple intensity tied to platform-fidelity stance, haptic peak-not-filler, one-channel-per-tier press feedback. Named RN noise modes (FAB-default, hamburger-over-tabs, bottom-sheet-for-everything, modal-first, double tab-bar treatments, OLED-saturated-accent). Touch-target preservation (≥44pt / 48dp) added as NEVER. |
| `distill.md` | ✅ | Direct port | Rewritten for RN: new **Navigation Simplification** section (collapse screens to sheets, merge near-identical routes behind a param, 5-tab cap, no hamburger when bottom tabs fit), **Visual Simplification** via `tokens.ts` pruning with caps (~3 surfaces / ~3 accents / ~5 type roles; 14 grays → 5) using `extract-tokens.mjs --dry-run`, **view-tree flattening** (collapse `View` wrappers, prefer `React.Fragment`, push style to parent), anti-patterns block (nested `ScrollView`s, pushed-screens-that-should-be-sheets, hero-metrics cards, identical card grids, 6+ tabs, double/triple touch handlers). Verify on iOS + Android (Principle IV). NEVER: erase platform-correct primitives (Android ripple, platform-split shadow) in the name of simplification. |
| `harden.md` | ⬜ | Significant | RN-specific edge cases: notch/island/keyboard avoidance, offline state, slow network, background-to-foreground, app-killed-and-restored, deep links. |
| `onboard.md` | ⬜ | Direct port | First-run / empty states / activation. RN-specific: permissions priming, notification opt-in, splash-to-content handoff. |

### Enhance

| File | Status | Weight | Notes |
|------|:------:|--------|-------|
| `animate.md` | ⬜ | Near-total | Drop CSS transitions / View Transitions / WAAPI. Rewrite for Reanimated 3 worklets, shared values, `useAnimatedStyle`, `withSpring`, `withTiming`, `useDerivedValue`, gesture handler integration, layout animations (`Layout`, `FadeIn`/`FadeOut`), `useReducedMotion()`. Reference Moti as higher-level option. Reference Skia for canvas-grade work. |
| `colorize.md` | ⬜ | Significant | Token-driven; covers light/dark via `useColorScheme()` and `Appearance`. iOS tint color stance, Android Material You opt-out. |
| `typeset.md` | ⬜ | Significant | Drop CSS font-loading. Replace with: Expo Font / RN Font loading, San Francisco vs Roboto defaults, `allowFontScaling`, Dynamic Type respect, missing Android weights, custom font fallbacks. |
| `layout.md` | ⬜ | Significant | Flexbox is mostly shared (Yoga = same model). Key swaps: no `gap` pre-RN 0.71, column default flexDirection, no `position: sticky`, ScrollView vs FlatList vs SectionList vs FlashList trade-offs, bottom-sheet patterns, tab/stack/drawer composition. |
| `delight.md` | ⬜ | Direct port | Methodology survives. Mobile additions: haptic moments (expo-haptics), micro-animations on success, sound feedback. |
| `overdrive.md` | ⬜ | Near-total | Drop WebGL / View Transitions / `@property`. Rewrite for Skia (paths, shaders, image filters, particle systems), Reanimated worklets on UI thread, gesture handler composition, MaskedView, native BlurView, shared element transitions, expo-haptics as a real design tool, 120Hz ProMotion. |

### Fix

| File | Status | Weight | Notes |
|------|:------:|--------|-------|
| `clarify.md` | ⬜ | Direct port | UX copy / labels / errors. Mostly platform-agnostic; verify and update examples. |
| `adapt.md` | ⬜ | Near-total | Completely different meaning. Web adapt = breakpoints. RN adapt = phone↔tablet, portrait↔landscape, Dynamic Type / font scale, safe areas, foldables, large-text accessibility. Open question: fold `responsive-design.md` into this file (decide when we get here). |
| `optimize.md` | ⬜ | Near-total | RN performance is a different beast. New arch (Fabric, TurboModules) vs old. FlatList tuning (`windowSize`, `removeClippedSubviews`, `getItemLayout`). expo-image caching/recyclingKey. `InteractionManager.runAfterInteractions`. Bridge serialization costs (old arch). Hermes byte-code. Re-renders from inline styles/arrays. JS thread vs UI thread. Memory pressure on Android. |

### Iterate (web-only — removed)

| File | Status | Notes |
|------|:------:|-------|
| `live.md` | ❌ | Removed. RN has no browser runtime. Replaced by `screenshot.mjs` for simulator iteration (future phase). |

---

## Domain reference files

These are consulted by command references, not user-invocable themselves.

### Visual / craft references (linked from craft.md Step 2)

| File | Status | Weight | Notes |
|------|:------:|--------|-------|
| `codex.md` | ✅ | Significant | Palette/mock/approval gates kept. Step E inventory rewritten for RN surfaces (Skia, react-native-svg, expo-image, expo-linear-gradient, expo-blur, Reanimated, icon library, multi-density raster). Step F asset slicing covers app icon + splash + multi-density. Vector-first preference made explicit. |
| `spatial-design.md` | ✅ | Significant | Rewritten for RN: token-step naming (`space['4']`), Yoga column-default, `gap` with RN 0.71 fallback, `FlatList numColumns` for tablet, the squint test, hierarchy through multiple dimensions, **safe area composition** (`inset + token`), touch targets via padding vs `hitSlop`, optical adjustments, **platform-split shadows** with low-alpha rule. |
| `typography.md` | ✅ | Significant | Rewritten for RN: 5-size role scale in points, `lineHeight` as total points (not multiplier), `tokens.type` role-named, system font defaults (SF Pro / Roboto), `expo-font` + `@expo-google-fonts` loading with splash-screen gate, iOS/Android weight/italic divergence table, **Dynamic Type / `allowFontScaling` deep dive** with `maxFontSizeMultiplier` cap pattern, `fontVariant: ['tabular-nums']`, all-caps tracking, role-not-value token naming. |
| `motion-design.md` | ✅ | Significant | Rewritten for RN: duration tokens in ms, Reanimated `Easing.out(Easing.quart)` / `Easing.bezier` curves, **new Springs section** with damping/stiffness presets table, **new 120Hz ProMotion section**, Premium Materials swapped to RN toolkit (Reanimated layout animations, Skia, MaskedView, expo-blur, expo-haptics), stagger via `withDelay` + declarative `FadeInDown.delay()`, `useReducedMotion` with substitute-or-skip patterns, scroll-driven via `useAnimatedScrollHandler`, JS-thread anti-pattern call-out. |
| `color-and-contrast.md` | ✅ | Significant | Rewritten for RN: OKLCH-think-emit-hex workflow with source comments, tinted-neutrals example pinned to a brand hue, RN palette structure table (accent/surface/text/semantic/border), parallel `light` + `dark` token sets in `tokens.ts`, `useColorScheme` + `useTheme` hook pattern (no scattered ternaries), **iOS tint color** and **Android Material You** platform-fidelity stances, contrast against emitted hex, OLED `#000` warning, alpha-as-token pattern, status bar + Android nav bar theming. |
| `interaction-design.md` | ✅ | Near-total | Rewritten for RN: mobile interactive states matrix (no hover, focus only for iPad/tvOS/external input), Pressable patterns (color swap vs scale spring), **haptics table with peak-not-end rule**, touch target spacing, gesture discoverability (partial reveal / coach marks / visible fallback), gesture patterns (swipe rows, PTR, pinch, pan-to-dismiss, Android back), form design (labels-not-placeholders, `keyboardType` / `autoComplete` / `textContentType`, `KeyboardAvoidingView`), optimistic UI + skeleton-vs-spinner, **sheet/modal hierarchy** (inline → context menu → bottom sheet → modal stack → Alert), `@gorhom/bottom-sheet` snap points + grabber, undo-over-confirm with undo toast pattern, accessibility (`accessibilityRole` / `Label` / `Hint` / `State`, decorative vs functional, focus order, VoiceOver-vs-TalkBack differences), external input (keyboard, Pencil, Switch Control, Voice Control). |
| `responsive-design.md` | ⬜ | TBD | `min-width` queries, `clamp()`, `@media (pointer: coarse)` — none of this exists in RN. Decide when we get to `adapt.md` whether to keep this file (general adaptive thinking) or fold its content into `adapt.md`. |
| `ux-writing.md` | 🔵 | None | Button labels, error messages, microcopy. Platform-agnostic. Verify only. |

### UX foundations (likely no-op, verify only)

| File | Status | Notes |
|------|:------:|-------|
| `cognitive-load.md` | 🔵 | UX fundamentals; platform-agnostic. Verify only. |
| `heuristics-scoring.md` | 🔵 | Scoring framework; platform-agnostic. Verify only — referenced by critique/audit, may need RN heuristic additions there rather than here. |
| `personas.md` | 🔵 | Persona framework; platform-agnostic. Verify only. |

### Register references

| File | Status | Notes |
|------|:------:|-------|
| `brand.md` | ⬜ | Brand register reference. Reflex-reject aesthetic lanes likely transfer; verify and add mobile-specific lanes (Material 3 defaults, Cupertino-cream, neon-on-black AI app, etc.). |
| `product.md` | ⬜ | Product register reference. Verify and update tool examples (Linear/Figma/Notion → Things/Linear-mobile/Notion-mobile/Cron/Fantastical). |

---

## Tally

- ✅ Done: 16 (`teach`, `shape`, `craft`, `document`, `audit`, `critique`, `polish`, `bolder`, `quieter`, `distill`, `codex`, `spatial-design`, `typography`, `motion-design`, `color-and-contrast`, `interaction-design`)
- 🟡 In progress: 0
- 🔵 No-op (verify only): 5
- ⬜ Todo: 13
- ❌ Removed: 1 (`live`)

**Next up:** finish the refinement set — `harden` → `onboard`. Then enhance set (`animate` → `colorize` → `typeset` → `layout` → `delight` → `overdrive`), fix set (`clarify` → `adapt` → `optimize`), build leftover (`extract`), register references (`brand`, `product`), then resolve `responsive-design.md` fate (fold into `adapt.md` or keep).
