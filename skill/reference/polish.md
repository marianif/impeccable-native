> **Additional context needed**: quality bar (MVP vs flagship).

Perform a meticulous final pass on a React Native / Expo surface to catch the small details that separate shipped from polished. Polish is the last 10% that takes 90% of the taste.

Static scanners and the iOS+Android probes are defect evidence only. A clean `a11y-audit.mjs` or `platform-parity.mjs` result is never proof that the design is strong; capture screenshots from both simulators and walk the real interaction path with a thumb.

Before polishing: confirm the flavor detector has run (`node {{scripts_path}}/detect-rn-flavor.mjs`) and that `load-context.mjs` surfaced PRODUCT.md + DESIGN.md. `Platform Fidelity` and `Primary Devices` define the bar for what polish even means on this project.

## Design System Discovery

Aligning the feature to the design system is **not optional**. Polish without alignment is decoration on top of drift, and it makes the next person's job harder. Discovery comes before any other polish work.

1. **Find the design system**: locate `tokens.ts` (or the equivalent module surfaced by DESIGN.md), the shared components folder, the `useTheme()` provider, and any motion / haptic conventions. Study the core patterns: color roles (accent/surface/text/semantic/border), space scale, type roles, radius scale, platform-split shadow tokens, motion timing tokens, the spring presets, the haptic vocabulary.
2. **Note the conventions**: how are shared components imported? What space steps are used (`tokens.space['4']` vs raw numbers)? Which colors come from `useTheme()` vs hard-coded hex? Are shadows consumed with `Platform.OS === 'ios' ? token.ios : token.android`? What flow shapes exist for comparable actions (modal stack vs bottom sheet vs inline expansion, save-on-blur vs explicit submit, optimistic vs pessimistic)?
3. **Identify drift, then name the root cause**: for every deviation, classify it as a **missing token** (the value should exist in `tokens.ts` but doesn't), a **one-off implementation** (a shared `Button` / `Sheet` / `ListRow` already exists but wasn't used), or a **conceptual misalignment** (the screen's flow, IA, or hierarchy doesn't match neighboring screens). The fix differs by category: patch the token, swap to the shared component, or rework the flow. Fixing the symptom without naming the cause is how drift compounds.

If a design system exists, polish **must** align the feature with it. If none exists, polish against the conventions visible in the codebase. **If anything about the system is ambiguous, ask. Never guess at design system principles.**

## Pre-Polish Assessment

Understand the current state and goals before touching anything:

1. **Review completeness**:
   - Is it functionally complete on both iOS and Android?
   - Are there known issues to preserve (mark with TODOs)?
   - What's the quality bar? (MVP vs flagship feature?)
   - When does it ship? (How much time for polish?)

2. **Think experience-first**: who actually uses this, on what device, in what posture? A feature that looks beautiful on a 15 Pro on a desk but fights a thumb on a commute is not polished. Walk the path from their perspective — one-handed, on Android, with Large font scale — before opening the inspector.

3. **Identify polish areas**:
   - Visual inconsistencies (token leakage, hex literals, raw pixel numbers)
   - Spacing and alignment (off-grid values, missing optical adjustments)
   - Interaction state gaps (pressed/disabled/loading/error missing on `Pressable`s)
   - Copy inconsistencies (labels, error messages, sentence vs title case)
   - Edge cases (offline, slow network, background-to-foreground, app-killed-and-restored)
   - Loading and transition smoothness (FlatList scroll jank, animation thread, spring tuning)
   - Information architecture and flow drift (does this screen reveal complexity the way neighboring screens do?)

4. **Pull in any prior critique** (optional signal): if `{{command_prefix}}impeccable-native critique` has been run on the same target, its priority issues are a useful prior for what to address first. Resolve the target to a file path, then:
   ```bash
   slug=$(node {{scripts_path}}/critique-storage.mjs slug "<resolved-path>")
   node {{scripts_path}}/critique-storage.mjs latest "$slug"
   ```
   Exit 0 with body = found; fold the P0/P1 items into your polish list and mention the snapshot path so the user sees what you read. Exit 2 = no snapshot, continue without it. The critique is one input among many. Do your own pass either way.

5. **Triage cosmetic vs functional**: classify each issue as **cosmetic** (looks off, doesn't impede the user) or **functional** (breaks, blocks, confuses, or fails on one platform). When polish time is tight, functional issues ship first; cosmetic ones land in a follow-up. Quality should be consistent; never perfect one corner while leaving another rough.

**CRITICAL**: polish is the last step, not the first. Don't polish work that isn't functionally complete on iOS **and** Android (Constitution Principle IV).

## Polish Systematically

Work through these dimensions methodically. Verify each pass on iOS Simulator and Android Emulator. Capture before/after via `node {{scripts_path}}/screenshot.mjs` when changes are visual.

### Visual Alignment & Spacing

- **Token-step spacing**: every gap, padding, and margin reads from `tokens.space` (e.g. `tokens.space['4']`), not a raw `12` or `13`. Off-scale numbers are the loudest tell of polish debt.
- **Yoga flexbox discipline**: `gap` on RN ≥ 0.71 for evenly-spaced children; fall back to `marginRight` / `marginBottom` on older versions. No alternating `marginLeft` / `marginRight` to fake `gap`.
- **Optical alignment**: icons next to text often need a 1–2 pt nudge for optical centering; chevrons and arrows rarely sit on the math center. Adjust visually, not by formula.
- **Safe-area composition**: every screen edge uses `useSafeAreaInsets()` composed with token-step padding (`paddingTop: insets.top + tokens.space['4']`). No hardcoded `paddingTop: 44`. Tab bars, sticky headers, bottom CTAs, and FABs all clear the home indicator and Dynamic Island.
- **Touch-target spacing**: pressables ≥ 44 pt iOS / 48 dp Android. For visually small affordances (icon-only buttons, list-row chevrons), extend the touch zone with `hitSlop` rather than inflating the visual.
- **Adaptive consistency**: layout holds on iPhone SE, on a Pixel 7a, on iPad if `phone-and-tablet` is in scope, at default and 2× Dynamic Type.

**Check**:
- Open the surface on iOS Simulator and Android Emulator side by side.
- Toggle Dynamic Type to 2× / font scale Large; nothing clips or overlaps.
- Squint at the screen — what feels off usually is.

### Information Architecture & Flow

Visual polish on a misshapen flow is wasted work. Match the *shape* of the experience to the system, not just the surface.

- **Progressive disclosure**: match how much is revealed when, compared to neighboring screens. A settings screen surfacing 40 rows when the rest of the app reveals 5 at a time is drift, even if every row is perfectly styled.
- **Established flow shapes**: multi-step actions follow the same pattern as comparable flows: stack push vs bottom sheet (`@gorhom/bottom-sheet`) vs modal presentation vs inline expansion; save-on-blur vs explicit submit; optimistic vs pessimistic updates. A bottom sheet here should not become a full-screen modal three screens away.
- **Hierarchy & complexity**: the same conceptual weight gets the same visual weight throughout. Primary actions don't slip to tertiary in one corner; tertiary actions don't shout.
- **Empty, loading, and arrival transitions**: how content arrives, updates, and leaves matches adjacent screens. Skeleton vs spinner is chosen consistently; pull-to-refresh feedback is uniform; list-row enter animations match.
- **Naming and mental model**: the feature uses the same nouns and verbs as the rest of the system. A "Workspace" here shouldn't be a "Project" three screens away.

### Typography Refinement

- **Role-named tokens**: every `Text` reads `tokens.type.body` / `tokens.type.title` / etc., not a raw `fontSize: 17`. Roles, not values.
- **Hierarchy consistency**: same conceptual element uses the same role throughout (section headers, row titles, captions).
- **Line height in points**: `lineHeight` is the total point value, not a multiplier. Verify long-content rows breathe.
- **Numbers**: `fontVariant: ['tabular-nums']` on counters, timestamps, and any column of digits.
- **All-caps tracking**: small caps and labels get positive `letterSpacing`; body text doesn't.
- **`numberOfLines` + `ellipsizeMode`**: long names, long emails, long titles truncate cleanly. `numberOfLines={2}` for two-line list rows; `ellipsizeMode="tail"` for names.
- **`allowFontScaling` discipline**: defaults to `true`. Use `maxFontSizeMultiplier` to cap headlines that break layout at extreme scale. Setting `allowFontScaling={false}` is a finding unless it's a logo wordmark or a numeric counter, with justification.
- **Custom fonts loaded clean**: `expo-font` finishes before the splash clears. First paint does not flash system font.

### Color & Contrast

- **Tokens-as-source-of-truth**: every color reads from `useTheme()` (which routes to `tokens.color.light.*` or `tokens.color.dark.*` based on `useColorScheme()`). Hex literals in components are findings.
- **Contrast ratios**: body text ≥ 4.5:1, large text ≥ 3:1 (WCAG AA), in **both** light and dark themes. Verify against the emitted hex, not the OKLCH source.
- **Tinted neutrals**: no pure gray or pure black; tokens carry a brand tint baked in at the source.
- **OLED stance**: dark mode surfaces do not glow on OLED; pure `#000` is intentional, not accidental.
- **Theme parity**: every screen flips correctly. Open it in light, then dark — no near-white surfaces, no unreadable text, no accent that vanishes.
- **Status bar style**: `expo-status-bar` (or `StatusBar`) set per screen — light content on dark headers, dark content on light, both platforms.
- **Gray on color**: never put gray text on colored backgrounds; use a shade of that color or token alpha (`tokens.alpha.muted`).
- **Platform tint**: if `Platform Fidelity` is `cupertino-everywhere` or `cupertino-android-pragmatic`, iOS tint behavior is respected. If `material-everywhere`, Material You opt-in/out is intentional, not accidental.

### Interaction States

Every `Pressable` needs every state. No state is implicit on mobile.

- **Default**: resting style.
- **Pressed**: `Pressable` `({ pressed })` swaps color via token (`pressed ? tokens.color.surfaceMuted : tokens.color.surface`) or scales via Reanimated (`useSharedValue(1)` → `withSpring(0.96)` on press in, `withSpring(1)` on press out).
- **Focus**: only relevant on iPad with external keyboard, tvOS, or hardware keyboard input. Don't draw browser-style focus rings on phone-only surfaces; do support `focusable` and accessibility focus.
- **Disabled**: clearly non-interactive — reduced alpha via token, `accessibilityState={{ disabled: true }}`.
- **Loading**: async actions show a `ActivityIndicator` or skeleton in the button; the button does not relayout when its label is replaced.
- **Error**: validation or error state surfaces inline, not in an Alert dialog (which interrupts).
- **Success**: confirmation via toast, haptic, or inline checkmark — not a modal.

Missing states create confusion on mobile far faster than on web. A pressable with no pressed feedback feels broken in 200 ms.

### Haptics

Haptics are a real design tool on RN that web can't access. Use them intentionally, not decoratively.

- **`expo-haptics` vocabulary**: `Light` / `Medium` / `Heavy` impact for taps and selections; `Success` / `Warning` / `Error` notification for outcomes; `Selection` for picker / wheel / segmented control changes.
- **Peak-end rule**: haptic at the moment that matters (the moment of confirm, the moment of success), not on every tap. Haptic spam is worse than no haptic.
- **Platform parity**: iOS gets the full taptic vocabulary; Android maps most types to a single intensity. If finer Android control is needed, `react-native-haptic-feedback`. Never iOS-only haptics — Android users hearing silence on confirm reads as broken.
- **Reduced motion / haptics off**: respect system settings; haptics are part of motion for some users.

### Micro-interactions & Transitions

- **Reanimated 3 worklets**: animations live on the UI thread via `useSharedValue` + `useAnimatedStyle`. Layout-property animation (`width` / `height` / `top` / `padding`) is a finding — animate `transform` and `opacity` instead.
- **Spring tuning**: `withSpring(target, { damping: 18, stiffness: 200 })` for taps, `damping: 22, stiffness: 150` for sheets. Avoid bouncy defaults (`damping: 8`); they read as dated and AI-generated.
- **Timing tokens**: durations come from `tokens.motion` (e.g. `tokens.motion.fast` = 150ms, `tokens.motion.medium` = 250ms). No magic `300`.
- **Easing**: `Easing.out(Easing.quart)` or a `Easing.bezier` curve for natural deceleration. Never `Easing.bounce` or elastic.
- **120Hz ProMotion**: on devices that support it, animations should run at 120fps. Worklets do this automatically; JS-thread animations don't.
- **`useReducedMotion()`**: every animated component reads it from `react-native-reanimated` and substitutes a snap, fade, or skip. Spinning loaders should reduce to a static pulse or skeleton.
- **Layout animations**: `Layout` / `FadeIn` / `FadeOut` from Reanimated for list-row enter/exit, accordion expand/collapse. Use `entering` / `exiting` props on `Animated.View`.
- **No jank**: heavy effects (`BlurView`, Skia canvases, particle systems) are clipped to a region. Full-screen blur over scrolling content drops frames.

### Content & Copy

- **Consistent terminology**: same things called same names throughout the app.
- **Consistent capitalization**: title case vs sentence case applied consistently per role (nav titles vs button labels vs section headers).
- **Grammar & spelling**: no typos.
- **Appropriate length**: button labels fit one line at default Dynamic Type; row titles handle 2× via `numberOfLines`.
- **Punctuation**: no periods on labels (unless every label has them); periods on sentences.
- **Platform voice**: "Done" vs "OK" vs "Save" — match the platform convention where Platform Fidelity demands it.

### Icons & Images

- **Consistent style**: all icons from the same family (SF Symbols-style outline, Material rounded, Lucide, etc.) — no mixing weights or fill styles.
- **Vector-first**: `react-native-svg` for icons and simple illustrations. Raster only when the asset is photographic.
- **Optical sizing**: icons sized in steps that match the type role next to them. A 16 pt icon next to body text, a 20 pt icon next to title — not a 17 pt outlier.
- **Optical alignment**: icons sit on the optical baseline of adjacent text, not the math center. Nudge with `marginTop: -1` when needed.
- **`expo-image` for hero assets**: raw `Image` doesn't cache or memory-bound. Hero imagery, list thumbnails, and avatars use `expo-image` with `contentFit`, `recyclingKey` on lists, and a blurhash or low-res placeholder.
- **Multi-density**: if raster, @1x / @2x / @3x for iOS; mdpi → xxxhdpi for Android. Or push to `expo-image` + a single high-res source and let it scale.
- **`accessibilityLabel`**: every meaningful `Image` carries one. Decorative images get `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`.
- **Aspect ratio**: explicit `width` and `height` (or `aspectRatio`) so images don't cause layout shift when they load.

### Forms & Inputs

- **Labels, not placeholders**: every `TextInput` has a visible label. Placeholder text alone fails accessibility and disappears on focus.
- **`keyboardType` / `autoComplete` / `textContentType`**: numeric inputs get `keyboardType="number-pad"`, email gets `keyboardType="email-address"` and `autoComplete="email"`, name fields get `textContentType="name"`. Saves taps and unlocks iOS autofill.
- **`returnKeyType` chains**: multi-field forms set `returnKeyType="next"` and focus the next input via `ref.focus()`; final field uses `"done"` or `"go"`.
- **`KeyboardAvoidingView`**: wraps forms with `Platform.select({ ios: 'padding', android: 'height' })`. Inputs remain visible above the keyboard on both platforms.
- **`keyboardShouldPersistTaps="handled"`**: on `ScrollView` so tapping a button while the keyboard is open works.
- **Validation timing**: consistent across the app (on blur vs on submit).
- **Error messages**: inline below the field, not in an Alert.
- **Required indicators**: clear and consistent.

### Edge Cases & Error States

- **Loading states**: skeleton for content shapes that are known, spinner only for unknown duration. Optimistic UI where the cost of being wrong is low.
- **Empty states**: helpful copy + a primary action, not blank space. First-run empty states differ from "you deleted everything" empty states.
- **Error states**: clear messages with a recovery path (retry button, edit affordance). Never a raw stack trace.
- **Success states**: confirmation via toast + haptic, or inline checkmark. Modals for success are over-engineered.
- **Long content**: long names, descriptions, emails wrap or truncate cleanly. Test with a 60-character name.
- **No content**: missing fields render gracefully (no `undefined` in the UI).
- **Offline**: `NetInfo` or equivalent surfaces a banner or inline state when offline. Mutations queue or fail visibly.
- **Slow network**: skeletons hold for at least 300ms before content swap so flicker doesn't read as jank.
- **Background-to-foreground**: state restores correctly when the app resumes. No stuck spinners, no stale data without indication.
- **Deep links**: opening from a notification or universal link lands on the right screen with the right stack.

### Adaptive

- **Phone ↔ tablet**: if `phone-and-tablet` is in scope, layouts adapt via `useWindowDimensions()`. Two-column or sidebar on tablet where one-column wastes space on phone.
- **Orientation**: portrait + landscape both hold if both are in scope; otherwise orientation is locked in `app.json`.
- **Dynamic Type 2×**: layouts hold; nothing clips or overlaps.
- **Foldables**: if in scope, fold transitions cause re-layout, not stretching.
- **Notch / Dynamic Island**: respected via safe-area composition on every screen.

### Performance

- **No inline styles in hot paths**: `style={{ ... }}` literals inside `FlatList` `renderItem` defeat virtualization and `memo()`. Lift to `StyleSheet.create` or pass via prop.
- **FlatList tuning**: stable `keyExtractor`, `getItemLayout` when row height is fixed, `windowSize` tuned, `removeClippedSubviews` on long lists, `initialNumToRender` bounded.
- **`renderItem` memoized**: `useCallback` or top-level component; row component wrapped in `React.memo`.
- **No layout shift**: images carry explicit dimensions; fonts loaded before splash clears.
- **Hermes on**: verify in `app.json` (Expo) or `gradle.properties` (bare).
- **`expo-image` caching**: `recyclingKey` on list images, blurhash for heroes.
- **No JS-thread animation**: every animation runs via Reanimated worklet or `Animated` with `useNativeDriver: true`.

### Platform Fidelity

- **Stance honored**: if `cupertino-everywhere`, no Material ripples leaking through; if `material-everywhere`, no iOS-style chevron backs on Android.
- **Shadows platform-split**: every shadow consumed `Platform.OS === 'ios' ? token.shadow.ios : token.shadow.android`. iOS-only shadows render nothing on Android.
- **System back on Android**: hardware/gesture back closes modals, sheets, and stacks correctly. `BackHandler` wired where Android back should override default behavior.
- **Swipe-to-go-back**: enabled on iOS where appropriate; not faked on Android.
- **Font fallback**: missing weights fall back to a comparable platform face on both platforms, not "almost right on iOS, wrong on Android."

### Code Quality

- **No `console.log`**: remove debug logging.
- **No commented code**: delete it; git remembers.
- **No unused imports**: clean them up.
- **Consistent naming**: components, hooks, and styles follow project conventions.
- **No `any`**: TypeScript strict; no `@ts-ignore` without a comment explaining why.
- **Accessibility**: `accessibilityRole` + `accessibilityLabel` on every `Pressable` / `TouchableOpacity`; `accessibilityState` on toggles, tabs, expanded sections.

## Polish Checklist

Go through systematically — and verify each box on iOS Simulator and Android Emulator:

- [ ] Aligned to the design system (drift named and resolved by root cause)
- [ ] Information architecture and flow shape match neighboring screens
- [ ] Visual alignment holds on iPhone SE, on Pixel 7a, at 2× Dynamic Type
- [ ] Spacing uses `tokens.space` consistently; no raw pixel numbers
- [ ] Safe areas composed via `useSafeAreaInsets()` + token, no hardcoded insets
- [ ] Touch targets ≥ 44 pt / 48 dp; `hitSlop` on small affordances
- [ ] Typography uses role-named tokens; `numberOfLines` + `ellipsizeMode` on long text
- [ ] Colors route through `useTheme()`; no hex literals; light + dark verified on both platforms
- [ ] Every `Pressable` has pressed feedback (color swap or spring scale)
- [ ] Haptics applied at peak moments, parity across iOS + Android
- [ ] All animations on UI thread (Reanimated worklets or `useNativeDriver: true`)
- [ ] `useReducedMotion()` respected by every animated component
- [ ] Springs tuned (no `damping: 8` bounce); easing is `Easing.out(*)` not `Easing.bounce`
- [ ] Copy is consistent (terminology, capitalization, punctuation)
- [ ] Icons vector-first; `expo-image` for hero/list raster
- [ ] Forms use `keyboardType` / `autoComplete` / `textContentType`; `KeyboardAvoidingView` wired
- [ ] Loading, empty, error, success states all designed and consistent
- [ ] Offline / slow-network / background-to-foreground handled
- [ ] Contrast ratios meet WCAG AA in light and dark
- [ ] VoiceOver pass on iOS and TalkBack pass on Android both read coherently
- [ ] FlatList tuned (stable `keyExtractor`, `getItemLayout` where possible, no inline styles in `renderItem`)
- [ ] Shadows consumed with `Platform.OS` branch
- [ ] Status bar style set per screen
- [ ] Android back behavior correct
- [ ] Code clean (no `console.log`, no commented code, no `any`, no unused imports)

**IMPORTANT**: polish is about details. Zoom in. Squint at it. Use it with your thumb. The little things add up.

Sweat the details. Zoom in until the alignment is right and the spacing reads as deliberate. Then verify on the other platform. Then ship.

**NEVER**:
- Polish before it's functionally complete on **both** platforms
- Polish without aligning to the design system; that's decoration on drift
- Guess at design system principles instead of asking when something is ambiguous
- Spend hours on polish if it ships in 30 minutes (triage)
- Introduce bugs while polishing (run the surface after each pass)
- Ignore systematic issues (if hex literals appear in 14 components, fix the token system, not just one screen)
- Perfect one platform while leaving the other rough (Constitution Principle IV)
- Create new one-off components when the design system equivalent exists
- Hard-code values that should route through `tokens.ts`
- Introduce new flows or sheet patterns that diverge from established ones
- Ship iOS-only haptics, iOS-only shadows, or iOS-only animation thread choices

## Final Verification

Before marking as done:

- **Use it yourself**: actually run the surface on iOS Simulator **and** Android Emulator with a thumb. One-handed.
- **Test on a real device** where possible: the simulator lies about haptics, gestures, and frame timing.
- **Capture screenshots** of the polished state on both platforms via `node {{scripts_path}}/screenshot.mjs` for the record.
- **Run simulator probes**: VoiceOver pass (iOS), TalkBack pass (Android), Dynamic Type 2× (iOS), font scale Large (Android), Reduce Motion (iOS), Remove Animations (Android), Android system back, keyboard avoidance on every form.
- **Ask someone else to review**: fresh eyes catch things, especially on the platform you don't carry.
- **Compare to design**: match the intended design across both platforms.
- **Check all states**: don't just test happy path — empty, loading, error, offline, long content.
- **Treat automation carefully**: run `a11y-audit.mjs`, `platform-parity.mjs`, and `extract-tokens.mjs --dry-run` when they're available and relevant; fix their defects, but never cite a clean result as proof that the work is polished.

## Clean Up

After polishing, ensure code quality:

- **Replace custom implementations**: if the design system provides a `Button` / `Sheet` / `ListRow` you reimplemented, switch to the shared version.
- **Remove orphaned code**: delete unused `StyleSheet.create` entries, unused components, and files made obsolete by the polish pass.
- **Consolidate tokens**: if you introduced new color, space, or duration values, check whether they should be added to `tokens.ts`. Run `node {{scripts_path}}/extract-tokens.mjs --dry-run` on the polished file to surface duplicated literals.
- **Verify DRYness**: look for duplication introduced during polishing and consolidate into shared components or hooks.
