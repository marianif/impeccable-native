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
| `extract.md` | ✅ | Significant | 83 lines. Light surgical rewrite (~30%). 6-step structure kept. Added pre-step: `extract-tokens.mjs --dry-run` runs before manual discovery to surface duplicated literals across `StyleSheet.create` blocks. Step 2 patterns rewritten for RN: `StyleSheet.create` duplication, repeated `Text` style triples, `View` wrapper patterns, animation literals. Step 4 components: ARIA/keyboard → `accessibilityRole`/`Label`/`State` + VoiceOver/TalkBack. Step 4 tokens: output is `tokens.ts` (cross-ref to `document.md` as authoritative shape). Step 5 migrate: glob patterns `.tsx`/`.ts`, `extract-tokens.mjs --dry-run` as checklist source, Principle IV gate. NEVER block: prohibits CSS custom-property concepts (`var()`, `:root`, `@layer`). 3-use threshold and premature-abstraction warning kept verbatim. |

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
| `harden.md` | ✅ | Significant | 348 → 544 lines. Web browser/CSS layer replaced with: **App Lifecycle** (`AppState` background-to-foreground refresh, session re-auth, app-killed-and-restored nav persistence, push notification tap routing, permission-revoked-mid-session recovery, iOS `memoryWarning` cache trim); **Navigation & Deep Links** (auth-gated deep links with `pendingRoute` pattern, 404/deleted-resource empty states, Android `BackHandler` per-sheet, three required close paths for every sheet/modal); **Keyboard** (`KeyboardAvoidingView` platform-split `behavior`, `keyboardShouldPersistTaps`, `onSubmitEditing` focus chain, `keyboardType`/`autoComplete`/`textContentType` table); `numberOfLines`+`ellipsizeMode` replaces CSS overflow; `accessibilityRole`/`State`/`useReducedMotion()` replaces WCAG/ARIA; Principle IV parity gate throughout. Added `<codex>` triage list of the 7 most common hardening failures ranked by frequency. |
| `onboard.md` | ✅ | Direct port | 235 → 507 lines. Added: **Splash handoff** (`SplashScreen.preventAutoHideAsync/hideAsync` three-condition gate + Reanimated fade-in transition); **Permissions priming protocol** (sequence-at-first-use, `Linking.openSettings()` denied-recovery, full permissions reference table, always/when-in-use location distinction); **Notifications opt-in as standalone section** (never on cold launch, after first win, `getPermissionsAsync` guard); **ATT priming** (App Tracking Transparency before system prompt); `ListEmptyComponent` mandate + `react-native-svg` vector requirement for empty states; Android `BackHandler` during onboarding; Sign in with Apple requirement (App Store Guideline 4.8); `expo-local-authentication` biometric offer pattern; `AsyncStorage` versioned key for re-onboarding; deep-link resume state. Dropped: Tippy.js/Intro.js/Shepherd/`localStorage`. |

### Enhance

| File | Status | Weight | Notes |
|------|:------:|--------|-------|
| `animate.md` | ✅ | Near-total | 175 → 268 lines. Rewritten for RN: Reanimated 3 fundamentals (shared values, `useAnimatedStyle`, `withSpring`/`withTiming`/`useDerivedValue`), layout animations (`Layout`, `FadeIn`/`FadeOut`), gesture-driven motion via `react-native-gesture-handler`, Moti as higher-level option, Skia deferred to overdrive.md, haptics via `expo-haptics`. Action-oriented (preflight → assess → plan → implement → verify); numeric tables live in `motion-design.md` via cross-reference. Constitution Principle IV gate at preflight + checklist + NEVER list. `useReducedMotion()` as design floor, 120Hz ProMotion awareness, `tokens.motion.*` source of truth, JS-thread anti-pattern called out. animate-vs-overdrive boundary: stays here if motion is `transform`/`opacity`/`color`/`borderRadius` on `Animated.View`; moves to overdrive once `Canvas`/`Path`/`Shader`/`useClockValue` enter. |
| `colorize.md` | ✅ | Significant | 154 → 295 lines. Rewritten for RN: action-oriented procedure (Assess → Plan → Constitution Gate → Emit Tokens → `useTheme()` Hook → Platform Stances → Status Bar/Nav Bar → Apply Roles → A11y Verify). Theory + tables stay in `color-and-contrast.md` via cross-reference (no duplication). OKLCH-think-emit-hex workflow with parallel `light`+`dark` token sets in `tokens.ts`. `useColorScheme()` + `useTheme()` provider hook is the only consumer pattern — no scattered ternaries. Four platform-fidelity stances structured as decision tree (cupertino-android-pragmatic / material-everywhere / cupertino-everywhere / custom-cross-platform). OLED `#000` warning → `#0A0A0B`. Status bar + Android nav bar theming as deliverable. Live-mode params dropped (web-only). |
| `typeset.md` | ✅ | Significant | 124 → 235 lines. Rewritten for RN: action-only procedure (Assess → Plan → Improve → Verify). Font selection (SF Pro / Roboto defaults, custom via `expo-font` + `@expo-google-fonts` with `SplashScreen.preventAutoHideAsync` gate). `tokens.type` 5-role scale (role-named, never `text-lg`). Honor platform weight reality: Roboto reliably ships 400/500/700/900 only; custom Android weights frequently absent — parity-fail trap made an explicit verify step. Dynamic Type discipline: `maxFontSizeMultiplier={1.4}` cap pattern, never blanket-disable `allowFontScaling`. Tabular figures via `fontVariant: ['tabular-nums']`. Variable fonts treated as hard avoid (Android inconsistency). Canonical scale table + full platform weight matrix + dark-mode three-axis math cross-referenced to `typography.md`. |
| `layout.md` | ✅ | Significant | 290 lines. Rewritten for RN: Yoga flexbox (column default, `gap` ≥ RN 0.71 with fallback pattern), scroll primitive decision tree (ScrollView → FlatList → SectionList → FlashList with branching logic), safe area composition via `useSafeAreaInsets()`, touch target minimum 44pt/48dp via padding + `hitSlop`, navigation shell composition (stack/tab/drawer/bottom-sheet absorbed here — no separate nav ref), spacing rhythm from `tokens.space.*`, grid layouts with `FlatList numColumns`, depth/elevation via platform-split tokens. `position: sticky` drop noted. Nested ScrollView trap with `nestedScrollEnabled` guard. Cross-references `spatial-design.md` for tables/theory. Principle IV gate present. |
| `delight.md` | ✅ | Direct port | 370 lines. Rewritten for RN: delight philosophy preserved, web implementations replaced. Five core principles (amplifies-never-blocks, peak-not-filler, surprise-and-discovery, appropriate-to-context, compound-over-time) front-loaded. Haptics as mobile-only design tool — `expo-haptics` impact + notification types, iOS-only flag with Android fallback strategy, peak-not-filler rule elevated to principle level. Micro-animations via Reanimated 3 (checkmark draw, scale-pulse, layout animations for list adds/removes), Moti as higher-level option. Sound feedback via `expo-av` with explicit Android latency warning; not a required deliverable. `useReducedMotion()` fallback paths throughout. Celebration moments, personality-in-copy section. Principle IV gate at verify. |
| `overdrive.md` | ✅ | Near-total | 487 lines. Rewritten for RN: multi-direction proposal gate preserved (2–3 directions, explicit approval before any code). Full toolkit: Skia canvas (paths, shaders, image filters, particle systems), Reanimated worklets on UI thread (vs JS thread — critical distinction), Gesture Handler composition (pan + pinch + rotation, Simultaneous/Exclusive/Race resolvers), MaskedView, native BlurView (`expo-blur` + Android fallback), shared element transitions (Expo Router experimental + react-navigation-shared-element), expo-haptics as choreography tool, 120Hz ProMotion + high-refresh Android. Progressive enhancement mandatory, 60fps floor, `useReducedMotion()` fallback path. animate.md boundary stated twice: overdrive starts when `Canvas`/`Path`/`Shader`/`useClockValue` enter, or when gesture composition + Skia are used together. WebGL / View Transitions / `@property` dropped. |

### Fix

| File | Status | Weight | Notes |
|------|:------:|--------|-------|
| `clarify.md` | 🔵 | None | UX copy / labels / errors. Genuinely platform-agnostic. No changes needed. |
| `adapt.md` | ✅ | Near-total | 395 lines. Rewritten for RN: `useWindowDimensions()` as the responsive hook (replaces `@media`); `useBreakpoint()` utility extracted to tokens/utils. Phone layouts (single column, bottom nav) vs tablet layouts (two-column master-detail, side drawer, `FlatList numColumns={2}`, modals-as-popovers). Orientation detection via `width > height`. Safe areas via `useSafeAreaInsets()` — iOS notch/Dynamic Island/home indicator vs Android punch-hole/gesture nav bar. Dynamic Type (iOS) + Android font scale: `maxFontSizeMultiplier={1.4}` cap, never disable. Foldables: `useWindowDimensions()` for layout re-branch on fold/unfold; hinge-aware API scoped as advanced/gated by PRODUCT.md target. Large-text mode: layout must not overflow at 2× font size, `numberOfLines`+`ellipsizeMode` as safety nets. `Dimensions` API caveat (static snapshot) documented. `responsive-design.md` deleted (web-only). Principle IV gate throughout. |
| `optimize.md` | ✅ | Near-total | 327 lines. Rewritten for RN: Measure First (profiling toolchain table by problem type — React Native DevTools / Flipper / Systrace / why-did-you-render / react-native-performance). Re-render hot paths: inline styles → `StyleSheet.create`, unstable callbacks → `useCallback`, context over-subscription → split contexts, `React.memo` for list items. FlatList virtualization: `keyExtractor` stability, `getItemLayout`, `windowSize` 5–7 for heavy items, `removeClippedSubviews` with Android caveat, `maxToRenderPerBatch`, FlashList as drop-in for very long lists. Image performance: `expo-image` disk+memory cache, `recyclingKey` in lists, size to display×DPR. JS thread vs UI thread: Reanimated worklets, `InteractionManager.runAfterInteractions`. Old arch bridge costs isolated as conditional subsection (skip on new arch). Memory pressure on Android: image recycling, avoid large arrays in state. Hermes startup section. NEVER block at end. Principle IV gate (Android = real perf surface). |

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
| `responsive-design.md` | ❌ | Removed | Web-only (`min-width`, `clamp()`, `@media`). Deleted. Adaptive content absorbed into `adapt.md`. |
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

- ✅ Done: 27 (`teach`, `shape`, `craft`, `document`, `audit`, `critique`, `polish`, `bolder`, `quieter`, `distill`, `harden`, `onboard`, `animate`, `colorize`, `typeset`, `layout`, `delight`, `overdrive`, `adapt`, `optimize`, `extract`, `codex`, `spatial-design`, `typography`, `motion-design`, `color-and-contrast`, `interaction-design`)
- 🟡 In progress: 0
- 🔵 No-op (verify only): 6 (`clarify`, `ux-writing`, `cognitive-load`, `heuristics-scoring`, `personas`, `brand`* — minor mobile reflex-reject additions welcome but not blocking)
- ⬜ Todo: 1 (`product.md` — verify register examples still apply to mobile apps)
- ❌ Removed: 2 (`live`, `responsive-design.md`)

**Status: functionally complete for React Native.** All load-bearing commands rewritten. Remaining: optional polish on `brand.md` (add mobile reflex-reject lanes) and `product.md` (verify tool examples). Next phase: new RN-specific scripts (`detect-rn-flavor.mjs`, `extract-tokens.mjs`, `platform-parity.mjs`, `a11y-audit.mjs`, `screenshot.mjs`) per IMPECCABLE.md Phase 5.
