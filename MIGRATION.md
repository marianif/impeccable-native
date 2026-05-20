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
| `document.md` | ⬜ | Near-total | Hardwired to Google Stitch DESIGN.md format + CSS custom properties. Needs rewrite for `tokens.ts` extraction (parse StyleSheet.create calls, surface duplicated literals). |
| `shape.md` | ✅ | Direct port | RN anchor references (Revolut/Duolingo/Things 3); RN constraints (RN version, new arch, safe areas, foldables); Yoga/FlatList layout vocabulary; touch/swipe/haptics interaction model; expo-image/SVG/Skia content sourcing. |
| `craft.md` | ✅ | Significant | Already RN-native pre-session — flavor detection at Step 0, iOS+Android parity gate, production bar with tokens/SafeArea/Dynamic Type/Reanimated 3/expo-image/FlatList perf/VoiceOver+TalkBack. |
| `extract.md` | ⬜ | Significant | Extracts to design system. Web version parses CSS; RN version parses TS/TSX, extracts to `tokens.ts` + components folder. |

### Evaluate

| File | Status | Weight | Notes |
|------|:------:|--------|-------|
| `critique.md` | ⬜ | Direct port | Assessment orchestration + scoring structure is reusable. Swap heuristics: WCAG/ARIA → accessibilityRole/VoiceOver, layout-thrash → re-render hot paths. |
| `audit.md` | ⬜ | Significant | New 5-dimension matrix per IMPECCABLE.md Phase 3: A11y (VoiceOver+TalkBack parity), Performance (re-render hot paths, FlatList config, JS thread blocking), Theming (useColorScheme), Adaptive (phone/tablet, safe areas, Dynamic Type), RN anti-patterns (FAB-default, hamburger-over-tabs, modal-instead-of-bottom-sheet, deep nested ScrollViews, inline styles in hot paths). Plus new dimension: platform fidelity. |

### Refine

| File | Status | Weight | Notes |
|------|:------:|--------|-------|
| `polish.md` | ⬜ | Direct port | Methodology survives, examples rewrite for RN. |
| `bolder.md` | ⬜ | Direct port | Methodology survives, examples rewrite. |
| `quieter.md` | ⬜ | Direct port | Methodology survives, examples rewrite. |
| `distill.md` | ⬜ | Direct port | Methodology survives, examples rewrite. |
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

- ✅ Done: 9 (`teach`, `shape`, `craft`, `codex`, `spatial-design`, `typography`, `motion-design`, `color-and-contrast`, `interaction-design`)
- 🟡 In progress: 0
- 🔵 No-op (verify only): 5
- ⬜ Todo: 20
- ❌ Removed: 1 (`live`)

**Next up:** `spatial-design.md`, then `typography.md`, then `motion-design.md`, then back to command files in dogfood order (`document` → `audit` → `critique` → refinement set → enhance set → fix set).
