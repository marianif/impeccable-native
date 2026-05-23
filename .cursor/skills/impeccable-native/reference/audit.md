Run systematic **technical** quality checks on a React Native / Expo surface and generate a comprehensive report. Don't fix issues; document them for other commands to address.

This is a code-level audit, not a design critique. Check what's measurable and verifiable in the implementation across iOS and Android.

Before scanning: confirm the flavor detector has run for this session (`node .cursor/skills/impeccable-native/scripts/detect-rn-flavor.mjs`) and that `load-context.mjs` has surfaced PRODUCT.md + DESIGN.md. Score against the project's actual stance — `Platform Fidelity` and `Primary Devices` in PRODUCT.md set the bar for dimensions 4 and 6.

## Diagnostic Scan

Run comprehensive checks across **6 dimensions**. Score each dimension 0–4 using the criteria below.

### 1. Accessibility (A11y)

**Check for**:

- **`accessibilityRole` coverage**: every `Pressable` / `TouchableOpacity` / `TouchableHighlight` declares a role (`button`, `link`, `tab`, `switch`, `header`, `image`, etc.). Custom interactive views without a role read as a generic touchable to screen readers.
- **`accessibilityLabel` + `accessibilityHint` pairing**: icon-only buttons, decorative pressables, and any control whose visible text is ambiguous carry a label. Hints exist where the action's consequence isn't obvious from the label alone.
- **`accessibilityState`**: toggles, tabs, checkboxes, expanded/collapsed sections, and selected list rows announce state (`selected`, `checked`, `expanded`, `disabled`, `busy`).
- **Decorative imagery hidden**: `accessibilityElementsHidden` (iOS) + `importantForAccessibility="no-hide-descendants"` (Android) on purely decorative `Image` and gradient/background layers so they don't pollute screen-reader narration.
- **Contrast ratios**: text contrast ≥ 4.5:1 (WCAG AA) for body, ≥ 3:1 for large text (≥ 18 pt / 14 pt bold). Both light and dark themes.
- **VoiceOver ↔ TalkBack parity**: read the screen with both. Order is logical on both, custom actions exist on both, announcements fire on both. iOS-only or Android-only a11y is a finding.
- **Focus order**: nested `Pressable`s and overlapping touch zones do not leave the screen reader stuck. Modal sheets and bottom sheets trap focus; dismissing them returns focus to the trigger.
- **Dynamic Type / font scaling**: layouts hold at 2× system font scale on both platforms. No clipped text, no overlapping rows, no horizontally cut buttons.
- **`useReducedMotion()` respected**: every animated component reads it and substitutes a snap or fade when `true`.
- **Form inputs labeled**: every `TextInput` paired with a visible label or `accessibilityLabel`. Error messages associated via `accessibilityLabel` updates or live regions.

**Score 0–4**: 0 = Inaccessible (no roles, no labels, screen readers can't operate the surface), 1 = Major gaps (most controls lack roles or labels, contrast fails widely), 2 = Partial (basic roles and labels in place, hint/state coverage spotty, Dynamic Type breaks layout), 3 = Good (WCAG AA mostly met, VoiceOver narration coherent, minor gaps), 4 = Excellent (VoiceOver and TalkBack parity verified, Dynamic Type 2× holds, reduced motion respected, decorative content hidden).

### 2. Performance

**Check for**:

- **Inline styles in hot paths**: `style={{ ... }}` literals inside `FlatList` `renderItem`, `SectionList` `renderItem`, animated components, or any view that renders more than a handful of times. Each render allocates a new object, defeating list virtualization and `memo()`.
- **FlatList / SectionList / FlashList configuration**: stable `keyExtractor` (not array index for mutable lists), `getItemLayout` when row height is known, `windowSize` tuned for the row size, `removeClippedSubviews={true}` on long lists, `initialNumToRender` bounded, `maxToRenderPerBatch` set.
- **`renderItem` stability**: memoized via `useCallback` or extracted to a top-level component; row component wrapped in `React.memo` with a custom `areEqual` when props are object-typed.
- **Re-render hot spots**: parent components passing new object/array literals on every render to memoized children (defeats memoization). Context values not memoized. State lifted higher than necessary.
- **Animations on the correct thread**: Reanimated 3 worklets via `useSharedValue` + `useAnimatedStyle` keep animation on the UI thread. Bare `Animated` API with `useNativeDriver: true` for `transform` / `opacity`. Animating `width` / `height` / `top` / `left` / `padding` / `margin` forces JS-thread layout.
- **Image strategy**: `expo-image` (Expo) or `react-native-fast-image` (bare) with explicit `width` and `height`, `contentFit` set, blurhash or low-res placeholder for hero images, `recyclingKey` for list images. Raw RN `Image` for >100 KB assets is a finding.
- **Bridge calls on old architecture**: if `newArch: false`, audit synchronous native module calls in hot paths. New arch (Fabric + TurboModules) removes most of this concern; legacy bridge accumulates serialization cost.
- **Hermes engine on**: verify Hermes is enabled (`expo.jsEngine: "hermes"` or `hermesEnabled=true` in `gradle.properties`). Hermes byte-code precompilation cuts startup measurably.
- **Heavy effects bounded**: `BlurView`, `Shadow`, Skia canvases, particle systems clipped to a region. Full-screen blur or shadow over scrolling content drops frames.
- **Memory pressure on Android**: large images uncached, oversized `ScrollView` (preferred only for small content), unbounded `useState` accumulation in long sessions.

**Score 0–4**: 0 = Severe (inline styles in lists, animating layout properties, JS-thread animations, no FlatList tuning), 1 = Major (some optimization, several hot-path defects), 2 = Partial (lists configured but inline styles linger, animations mixed thread), 3 = Good (mostly UI-thread animations, list config tuned, minor re-render issues), 4 = Excellent (worklets throughout, lists tuned for the data shape, images strategy-correct, Hermes on, no JS-thread blocking).

### 3. Theming

**Check for**:

- **Tokens-as-source-of-truth**: every color, type, space, radius, shadow, and motion value reads from `tokens.ts` (via `useTheme()` or direct import). Component-level hex literals, raw pixel numbers, and one-off durations are findings.
- **Light and dark coverage**: every color token has both `light` and `dark` values, and every screen flips correctly. Open the surface in light mode, then in dark mode — text remains legible, accents stay visible, no near-white surfaces glow on OLED.
- **`useColorScheme()` called once at the provider level**: a single `useTheme()` (or equivalent) reads it; components consume `colors.x`. Inline `useColorScheme() === 'dark' ? ... : ...` scattered through components is a finding.
- **System-theme follow vs forced**: PRODUCT.md states the intent; the code matches. If "follow system" is the stance, `Appearance` is the source. If "in-app override," persistence is wired and tested across app restarts.
- **Token consumption consistency**: no mixing of token sources (e.g. some components read `tokens.color.light.accent` directly and bypass `useTheme()`, others go through). One canonical path.
- **Platform-correct shadow tokens**: every shadow token consumed with both branches (`Platform.OS === 'ios' ? token.ios : token.android`). iOS-only shadow tokens are findings, since Android renders nothing.
- **Custom fonts loaded before first paint**: `expo-font` or equivalent finishes before the splash clears. First render does not flash system font.

**Score 0–4**: 0 = No tokens (hex literals everywhere, no dark mode), 1 = Minimal (a tokens file exists but most components bypass it), 2 = Partial (tokens consumed in some places, hardcoded values linger, dark mode incomplete), 3 = Good (tokens drive most styling, dark mode works, minor leakage), 4 = Excellent (full token system, light and dark verified on both platforms, shadows platform-split, fonts loaded clean).

### 4. Adaptive (devices, orientation, safe areas, Dynamic Type)

This is the RN equivalent of responsive design. Score against PRODUCT.md's `Primary Devices` field.

**Check for**:

- **Safe areas on every screen**: `useSafeAreaInsets()` or `SafeAreaView` with explicit `edges`. Tab bars, sticky headers, modal sheets, FABs, and bottom CTAs all clear the home indicator and notch. No hardcoded `paddingTop: 44` style insets.
- **Touch targets ≥ 44 pt iOS / 48 dp Android**: pressables, tab items, icon buttons, list-row affordances meet the minimum. Use `hitSlop` to extend the touch zone of small visual elements.
- **Phone ↔ tablet** (if `phone-and-tablet` or `phone-tablet-foldable` in scope): layout adapts via `useWindowDimensions()` or `react-native-responsive-screen`. Two-column layouts on tablet where one-column on phone would waste space. Sidebar/master-detail patterns where appropriate.
- **Foldable support** (if `phone-tablet-foldable`): screen folding causes a re-layout, not clipping or stretching.
- **Orientation**: if portrait + landscape are both in scope, layouts hold in both. If portrait-only, `app.json` / `Info.plist` / `AndroidManifest.xml` lock orientation rather than letting layouts break visually.
- **Keyboard avoidance**: `KeyboardAvoidingView` wraps forms with `behavior="padding"` on iOS and `behavior="height"` on Android (or both with `Platform.select`). Inputs remain visible above the keyboard on both platforms. `keyboardShouldPersistTaps="handled"` on `ScrollView` so tapping a button while the keyboard is open works.
- **Dynamic Type / font scaling**: layouts hold at 2× system font scale. Containers expand, text wraps, no clipping. Buttons remain tappable. If `allowFontScaling={false}` is used, the justification is documented (a logo wordmark, a numeric counter, etc.) — not for body or labels.
- **Long content**: long names, long emails, long titles wrap or truncate with `numberOfLines` + `ellipsizeMode`. No horizontal overflow.
- **Notch / Dynamic Island / status bar**: status bar style set per screen via `expo-status-bar` or `StatusBar`. Dynamic Island clearance on iPhone 14/15 Pro and newer.

**Score 0–4**: 0 = Phone-portrait-only with hardcoded insets, breaks on any other device, 1 = Major issues (safe areas spotty, Dynamic Type breaks layout, no tablet support where promised), 2 = Partial (safe areas present, Dynamic Type rough, tablet barely works), 3 = Good (safe areas + Dynamic Type + keyboard avoidance correct, tablet acceptable), 4 = Excellent (every device class in PRODUCT.md verified, Dynamic Type 2× clean, orientation/foldables handled).

### 5. Anti-Patterns (CRITICAL)

Check against ALL the DON'T guidelines from the impeccable-native shared design laws (already loaded in this context). Two passes: AI-slop tells and RN-specific anti-patterns.

**AI-slop tells (first-order training-data reflexes)**:

- AI color palette (purple-to-pink gradient, dark mode with neon accents, "ChatGPT lavender", glassmorphism)
- Gradient buttons that scream "AI app"
- Generic Material 3 defaults shipped unchanged
- "Hero metrics" cards (3 big numbers in a row) without earned data
- Identical card grids (3 or 4 cards, same size, same shape, alternating image positions)
- Gray-on-color text, gray-on-image text without scrim
- Bounce easing on everything (`Easing.bounce`, springs with `damping: 8`)
- Generic font choices that match the product category exactly (a fintech in Inter, a wellness app in Söhne, a kids' app in Comic Sans-adjacent)

**RN-specific anti-patterns**:

- **FAB-as-default**: Floating Action Button used for any secondary action. FAB earns its slot only when there's exactly one dominant action across multiple screens (Gmail compose, Maps directions). Most other uses belong in a header button or inline.
- **Hamburger over bottom tabs**: hamburger menu shipped when 3–5 primary destinations would fit a bottom tab bar. Hamburger hides destinations and adds taps.
- **Modal-as-first-thought**: every secondary action triggers a full-screen modal. Exhaust stack push, inline expansion, swipe action, and bottom sheet first.
- **Deep nested `ScrollView`**: `ScrollView` inside `ScrollView` (same axis) breaks scroll handoff. Use `FlatList` / `SectionList` with `ListHeaderComponent` / `ListFooterComponent` instead.
- **`Image` over `expo-image` for hero assets**: raw `Image` doesn't cache, blurhash, or memory-bound. Hero imagery deserves `expo-image` or FastImage.
- **Missing `keyExtractor` on lists**: lists falling back to index keys when items can be reordered, removed, or paginated. Diffing breaks; rows re-render or flash.
- **Inline styles inside `renderItem`**: covered in dimension 2 but also a design anti-pattern — it tells you the design system isn't trusted.
- **Six or more bottom tabs**: tab bars cap at 5 destinations comfortably. Six tabs cramp labels and lose touch-target spacing.
- **Bottom sheet for every disclosure**: bottom sheets are a strong pattern for picking, editing, or confirming. They're not a replacement for inline progressive disclosure.
- **Custom Material You / iOS tint overrides that fight the platform**: forcing a brand color into the system tint slot when `Platform Fidelity` says `cupertino-everywhere` is a self-inflicted divergence.

**Score 0–4**: 0 = AI-slop gallery (5+ tells), 1 = Heavy AI aesthetic (3–4 tells), 2 = Some tells (1–2 noticeable), 3 = Mostly clean (subtle issues only), 4 = Distinctive and intentional, no slop tells, RN patterns chosen for fit.

### 6. Platform Fidelity (CRITICAL — Constitution Principle IV)

Score against PRODUCT.md's `Platform Fidelity` field. **iOS-only verification is itself a failure** — every audit inspects both platforms.

**Check for**:

- **iOS feels iOS-native where the stance demands it**: `cupertino-everywhere` or `cupertino-android-pragmatic` → SF Pro defaults (or licensed equivalent), iOS-style nav with chevron back, sheet presentations via `react-native-screens` formSheet, spring animations with iOS-like damping, system tint behavior, large titles in headers where appropriate.
- **Android feels Android-native where the stance demands it**: `material-everywhere` or `cupertino-android-pragmatic` → Roboto defaults, Material ripple on Pressables, FAB only where Material guidelines actually call for one, Material-style nav (back arrow + screen title), `elevation`-driven shadows that read as Material surfaces.
- **`custom-cross-platform` coherence**: if the stance is custom, both platforms render the same design language. No iOS-only chrome leaking through (large titles, swipe-to-back appearing only on iOS), no Android-only ripples surprising iOS users. Shadows resolve to comparable visual weight via the platform-split tokens.
- **Shadow tokens consumed with both branches**: every shadow uses `Platform.OS === 'ios' ? token.ios : token.android`. iOS-only shadows show an empty surface on Android.
- **Haptics use the platform-appropriate type**: iOS via `expo-haptics` (light/medium/heavy impact, notification success/warning/error, selection). Android via `expo-haptics` (which maps to a single intensity on most devices) or `react-native-haptic-feedback` if finer control is needed. Hardcoded iOS-only haptics are a finding.
- **System back behavior**: Android hardware/gesture back navigates correctly. Modals and bottom sheets close on Android back. Deep stacks don't leak out of the app on Android back.
- **Status bar style per screen**: light content on dark headers, dark content on light headers, both platforms.
- **Keyboard and gesture handlers behave platform-correctly**: `KeyboardAvoidingView` with the right `behavior` per platform. Swipe-to-go-back enabled on iOS where appropriate; not faked on Android.
- **Font fallback**: custom fonts that are missing a weight fall back to a comparable platform face, not to "almost the right thing" on one platform and wrong on the other.

**Score 0–4**: 0 = One platform verified only (Principle IV gate failed), 1 = Both platforms run but heavy divergence (shadows missing on Android, haptics iOS-only, ripples leaking into a `cupertino-everywhere` stance), 2 = Partial parity (most surfaces work both, some platform-specific bugs), 3 = Good (stance honored, platform-correct primitives, minor polish remaining), 4 = Excellent (stance-aligned and verified on iOS Simulator + Android Emulator, haptics and shadows platform-correct, no divergence accidents).

## Generate Report

### Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | ? | [most critical a11y issue or "--"] |
| 2 | Performance | ? | |
| 3 | Theming | ? | |
| 4 | Adaptive | ? | |
| 5 | Anti-Patterns | ? | |
| 6 | Platform Fidelity | ? | |
| **Total** | | **??/24** | **[Rating band]** |

**Rating bands**: 22–24 Excellent (minor polish), 17–21 Good (address weak dimensions), 12–16 Acceptable (significant work needed), 7–11 Poor (major overhaul), 0–6 Critical (fundamental issues).

### Anti-Patterns Verdict

**Start here.** Pass/fail: does this surface look AI-generated, or like a mobile app made of platform shortcuts? List specific tells (AI-slop tells from dimension 5 and RN-specific anti-patterns). Be brutally honest. If `Platform Fidelity` in PRODUCT.md is violated, name the violation.

### Executive Summary

- Audit Health Score: **??/24** ([rating band])
- Total issues found (count by severity: P0/P1/P2/P3)
- Platform coverage verified: iOS [devices] / Android [devices] / light + dark / Dynamic Type 2×
- Top 3–5 critical issues
- Recommended next steps

### Detailed Findings by Severity

Tag every issue with **P0–P3 severity**:

- **P0 Blocking**: prevents task completion on at least one platform, breaks a11y, or fails Constitution Principle IV (platform parity). Fix immediately.
- **P1 Major**: significant difficulty, WCAG AA violation, or a clearly-visible platform divergence. Fix before release.
- **P2 Minor**: annoyance, workaround exists. Fix in next pass.
- **P3 Polish**: nice-to-fix, no real user impact. Fix if time permits.

For each issue, document:

- **[P?] Issue name**
- **Location**: component, file, line
- **Platform**: iOS / Android / both
- **Category**: Accessibility / Performance / Theming / Adaptive / Anti-Pattern / Platform Fidelity
- **Impact**: how it affects users (which user, which moment, which platform)
- **WCAG / Standard**: which standard it violates (if applicable)
- **Recommendation**: how to fix it (specific RN primitive, token, or pattern)
- **Suggested command**: which impeccable-native command to use (prefer: /impeccable adapt, /impeccable animate, /impeccable audit, /impeccable bolder, /impeccable clarify, /impeccable colorize, /impeccable craft, /impeccable critique, /impeccable delight, /impeccable distill, /impeccable document, /impeccable extract, /impeccable flow, /impeccable harden, /impeccable layout, /impeccable migration, /impeccable onboard, /impeccable optimize, /impeccable overdrive, /impeccable polish, /impeccable quieter, /impeccable rethink, /impeccable shape, /impeccable teach, /impeccable typeset)

### Patterns & Systemic Issues

Identify recurring problems that indicate systemic gaps rather than one-off mistakes:

- "Hex literals appear in 14 components, should route through `useTheme()`."
- "Touch targets consistently below 44 pt across the settings screen — entire screen needs a spacing/hitSlop pass."
- "iOS-only haptics in 7 interaction points — Android users get no feedback."
- "Inline `style={{ ... }}` literals inside `FlatList` `renderItem` across three list screens — virtualization regressing."

### Positive Findings

Note what's working well: tokens consumed cleanly, Reanimated worklets on the UI thread, VoiceOver narration coherent, etc. Celebrate what works.

## Recommended Actions

List recommended commands in priority order (P0 first, then P1, then P2):

1. **[P?] `/impeccable-native <command>`**: brief description (specific context from audit findings).
2. **[P?] `/impeccable-native <command>`**: brief description (specific context).

**Rules**: only recommend commands from: /impeccable adapt, /impeccable animate, /impeccable audit, /impeccable bolder, /impeccable clarify, /impeccable colorize, /impeccable craft, /impeccable critique, /impeccable delight, /impeccable distill, /impeccable document, /impeccable extract, /impeccable flow, /impeccable harden, /impeccable layout, /impeccable migration, /impeccable onboard, /impeccable optimize, /impeccable overdrive, /impeccable polish, /impeccable quieter, /impeccable rethink, /impeccable shape, /impeccable teach, /impeccable typeset. Map findings to the most appropriate command. End with `/impeccable-native polish` as the final step if any fixes were recommended.

After presenting the summary, tell the user:

> You can ask me to run these one at a time, all at once, or in any order you prefer.
>
> Re-run `/impeccable-native audit` after fixes to see your score improve.

**IMPORTANT**: be thorough but actionable. Too many P3 issues create noise. Focus on what actually matters on a phone in a thumb in motion.

**NEVER**:

- Report issues without explaining impact (which user, which moment, which platform).
- Provide generic recommendations (be specific: name the primitive, token, or hook).
- Skip positive findings (celebrate what works).
- Forget to prioritize (everything can't be P0).
- Report false positives without verification on the actual platform.
- **Score Platform Fidelity from one platform only.** If only iOS or only Android was inspected, dimension 6 is automatically P0 and the overall score is incomplete.
