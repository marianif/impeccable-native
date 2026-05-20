When asked for "bolder," AI defaults to the same tired mobile tricks: cyan/purple gradient hero, glassmorphism cards on a blurred photo, neon accents on pure `#000`, a gradient-filled FAB, oversized rounded rectangles with a single colored border. These are the opposite of bold on mobile — they are the AI-app aesthetic. Reject them first, then increase visual confidence through stronger hierarchy, committed point sizes, decisive negative space, and one sharper accent.

---

## Register

Brand: "bolder" means distinctive. Committed display sizes, a typographic POV, an unexpected accent, full-bleed hero imagery that owns the screen.

Product: "bolder" rarely means theatrics on a phone — a 6-inch screen punishes drama. It means stronger weight contrast inside the 5-role type scale, more decisive negative space against safe-area insets, one accent doing real work, and tab bar / sheet hierarchy that reads at a glance. The amplification is in clarity and decisiveness, not effects.

---

## Assess Current State

Analyze what makes the design feel too safe or boring on the device:

1. **Identify weakness sources** (verify on iOS Simulator AND Android Emulator per Constitution Principle IV — many "timid" defects show up on one platform only):
   - **Generic choices**: Default SF Pro / Roboto across every role, neutral grays from a generic palette, stock Material 3 components
   - **Timid scale**: `headline` and `title` only 6pt apart (e.g. 24 / 18) with body at 16 — no drama
   - **Low weight contrast**: Everything at `'400'` or `'500'`; no `'700'` or `'800'` anchoring the screen
   - **Soft negative space**: `space['3']` and `space['4']` everywhere; no committed `space['10']`+ gaps around hero moments
   - **Diluted accent**: Two or three accent colors sharing the spotlight instead of one owning it
   - **Flat hierarchy**: Tab bar icons indistinguishable from inline icons; CTA reads at the same weight as a list row
   - **Inert**: No haptic on primary action, no spring entrance, no `Layout.springify()` on list inserts

2. **Understand the context**:
   - Platform fidelity stance (from PRODUCT.md): `cupertino-android-pragmatic`, `material-everywhere`, `cupertino-everywhere`, or `custom-cross-platform`? Bolder pushes harder under `custom-cross-platform`; it has to behave more conservatively when respecting native conventions.
   - Register (brand vs product) and primary device (phone-only, phone+tablet)
   - Audience and constraints (Dynamic Type ceiling, reduce-motion users, slow Android devices)

If any of these are unclear from PRODUCT.md / DESIGN.md, STOP and call the AskUserQuestion tool to clarify.

**CRITICAL**: "Bolder" on mobile doesn't mean louder. It means *decisive*. A confident screen has one display-size moment, one accent owning ~60% of the chromatic weight, and negative space that feels deliberate against the safe-area inset — not chaos.

**WARNING - AI SLOP TRAP**: Review ALL the DON'T guidelines from the parent impeccable-native skill (already loaded). Bold means distinctive, not "more effects." A glassmorphic card over a blurred image is not bold — it is the default AI mobile app.

## Plan Amplification

Create a strategy to increase impact while maintaining usability on a thumb-driven screen:

- **Focal point**: One hero moment per screen. A full-bleed `expo-image` with a blurhash placeholder + a safe-area-aware overlay; or a single display-size number; or a Skia mark. Pick ONE and let it dominate.
- **Personality direction**: Choose a lane and commit. Editorial-quiet, brutalist-typographic, expressive-illustrative, monochrome-confident. The lane informs every subsequent decision.
- **Risk budget**: Brand register tolerates more departure from platform convention; product register stays closer. Either way, the bolder pass should not break VoiceOver order, Dynamic Type reflow, or Android back.
- **Hierarchy amplification**: Widen the gap between roles in `tokens.type` (display 36 vs body 16, not 24 vs 16). Widen the gap in `tokens.space` (use `space['10']` and `space['12']` against hero moments, not just up to `space['6']`).

**IMPORTANT**: Bold mobile design must still be reachable. Touch targets stay ≥44pt (iOS) / 48dp (Android). Safe areas still get respected. A hero that crashes into the home indicator is broken, not bold.

## Amplify the Design

Systematically increase impact across these dimensions. Edit `tokens.ts` first; let the screens inherit.

### Typography Amplification

- **Recommit to system fonts before reaching for custom.** SF Pro at `'800'` is more confident than Inter at `'600'`. If the brief is genuinely brand-led, load a single display family via `expo-font` / `@expo-google-fonts` behind `SplashScreen.preventAutoHideAsync()` so the bold display doesn't flash the system fallback (see [typography.md](typography.md)).
- **Widen role gaps.** Push `display` to 36–48pt with `lineHeight` tight (1.0–1.1× — e.g. `fontSize: 44, lineHeight: 48`). Keep `body` at 16. The 3× ratio between them is what reads as confident.
- **Weight contrast on a single axis.** Pair `display` at `'800'` with `body` at `'400'` — not `'600'` with `'400'`. On Android, snap to weights that map cleanly: `400`, `500`, `700`, `900`. Intermediate weights collapse to the nearest available on Android (see the platform weight table in [typography.md](typography.md)).
- **All-caps as eyebrow, not paragraph.** A 12pt `caption` at `'600'` with `letterSpacing: 1.2` and `textTransform: 'uppercase'` over a display headline reads as authored, not corporate.
- **Honor Dynamic Type while you push scale.** A 44pt display still respects `allowFontScaling`; cap with `maxFontSizeMultiplier={1.4}` on hero moments where 2× would clip past the safe area. Never `allowFontScaling={false}`.
- **Reach for tabular numerals.** `fontVariant: ['tabular-nums']` on any large changing number (balance, timer, count). A jumping decimal in a 36pt display is the opposite of confident.

### Color Intensification

- **Commit to one accent.** Move accent from "supporting" to "dominant" — let it carry the primary CTA, the active tab icon, the hero accent stroke, and one piece of typographic emphasis. Strip the second and third accents back to neutral.
- **Tinted neutrals over true gray.** In `tokens.color.light` and `tokens.color.dark`, regenerate the gray ramp with a few degrees of the accent hue mixed in. Pure neutral gray reads as Material 3 default. Tinted neutral reads as authored.
- **Push saturation, not luminosity.** Bumping chroma is bolder than bumping brightness. Verify contrast against the emitted hex in both `light` and `dark` token sets via a contrast checker — not against the OKLCH source.
- **OLED dark mode: do not use `#000`.** A `tokens.color.dark.background` of `#0A0A0B` or `#0E0F12` with the accent at full chroma reads bolder than `#000` with the same accent, because the accent doesn't have to fight a black hole. Reserve `#000` for press states or accent-on-black moments only (see [color-and-contrast.md](color-and-contrast.md)).
- **Both themes get the bolder pass.** A confident light theme that turns into a muddy dark theme means the dark theme wasn't actually designed. Walk every screen in `useColorScheme()` light AND dark.

### Spatial Drama

- **Extreme step jumps.** `space['10']` (40pt) or `space['12']` (48pt) above a section title; `space['2']` (8pt) inside the row. The contrast — not the absolute value — reads as confident.
- **Full-bleed elements.** Hero `expo-image`, edge-to-edge headers, and `FlatList` ListHeaderComponents that extend to `width: '100%'` past horizontal screen padding. Compose against the safe area top inset with `useSafeAreaInsets()` — the image goes under the status bar, the *content* respects the inset.
- **Asymmetric layouts.** Stop centering. Push the display headline hard-left against `space['6']` of horizontal padding; let the meta sit on the next line at the same left edge. Centered hero text is the Material 3 default.
- **Decisive radii.** Pick a radius posture and commit across the surface. `tokens.radius.lg = 20` everywhere, or `tokens.radius.sm = 4` everywhere — not a chaotic mix of 8 / 12 / 16 / 20 / 24. A single committed radius reads bolder than a finely graduated set.
- **Generous around the hero, tight inside it.** A 32pt top margin above a display headline + 4pt below it pairs better than a uniform 16pt around everything.

### Surface & Depth

- **Platform-split shadows or no shadows.** Either invest in a real elevation pair (`tokens.shadow.card.ios` with low-alpha `shadowColor` + offset + radius, `tokens.shadow.card.android` with `elevation`) consumed via `Platform.OS === 'ios' ? token.ios : token.android`, or strip shadows entirely and lean on borders / surface contrast. A generic web-style drop shadow on rounded rectangles is the AI-app default.
- **Borders as commitment.** A 1pt or 2pt border at full contrast (`tokens.color.text.primary` at 20% alpha) is bolder than a soft shadow. Borders also survive both themes without re-tuning.
- **No glassmorphism by default.** `expo-blur` is for specific moments (sticky header over scrolling content, modal scrim) — not a generic surface treatment.
- **Vector hero marks via `react-native-svg`.** A single decisive SVG mark behind a display headline scales sharper than a raster on every pixel density. For complex generative or shader-driven marks, reach for Skia (see [overdrive] for the toolkit).

### Motion as Confidence

- **Spring entrances on hero moments.** `entering={FadeInDown.springify().damping(14)}` on the display headline; `Layout.springify()` on list inserts. A confident screen lands with spring physics, not linear fades.
- **Haptic on the primary CTA.** `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)` on the one CTA per screen. Not on every Pressable — that's haptic fatigue.
- **120Hz where the device supports it.** Reanimated worklets run on the UI thread; keep animated values off the JS thread so ProMotion / high-refresh Android phones can hit 120fps.
- **Respect `useReducedMotion()`.** Substitute springs with quick opacity fades when the user has it on. Confidence ≠ ignoring accessibility.
- **No bounce on dismiss.** `Easing.out(Easing.quart)` or a critically-damped spring. Bouncy / elastic curves cheapen the moment.

### Composition Boldness

- **One display moment per screen.** If two compete, neither wins. A screen with a 44pt display title and a 36pt metric below it is fighting itself; demote the metric to `headline` (24pt) and let the title own the top third.
- **Full-bleed sheet presentation.** A `@gorhom/bottom-sheet` with a visible grabber and a single snap point at `90%` reads more decisive than a 50% / 75% / 90% three-step sheet for content that wants the full stage.
- **Tab bar with weight.** Bigger active icons (`28pt` vs `24pt`), labels at `caption` weight `'600'` instead of `'500'`, and the one accent doing the active state. A muted tab bar is where confidence goes to die.
- **Edge-to-edge headers.** Status bar transparent on Android (`StatusBar` translucent + content background extending under), `useSafeAreaInsets()` driving content offset. The hero image goes to the top of the device.

**NEVER**:
- Add a gradient FAB, glassmorphic card, or neon-on-`#000` accent. These are the AI-mobile-app defaults; bolder means *less* of them.
- Use a hamburger menu when bottom tabs would do the same job with more confidence.
- Push display sizes so far they break Dynamic Type at 2× scale. Verify in iOS Simulator → Toggle Larger Accessibility Sizes and Android Emulator → Settings → Display → Font size → Largest.
- Make everything heavy (`'700'` across the board). Then nothing reads heavy; you need contrast.
- Stack haptics. One haptic per primary moment. Multiple haptics on a single tap is a defect, not a feature.
- Forget Android. A bolder pass verified only on iOS Simulator is incomplete per Constitution Principle IV — Android shadow rendering, font weight snapping, and back-gesture behavior will quietly undermine the work.

## Verify Quality

Ensure amplification maintains usability and coherence across both platforms:

- **NOT AI slop**: Does this look like every other AI-generated mobile app — gradient hero, glass card, neon on `#000`, a single colored border on a rounded rectangle? If yes, start over.
- **Still functional**: Touch targets ≥44pt / 48dp, VoiceOver and TalkBack order intact, Android back works, keyboard avoidance survives, deep links still resolve.
- **Coherent across themes**: Both `tokens.color.light` and `tokens.color.dark` got the bolder pass; neither feels like an afterthought.
- **Coherent across platforms**: iOS Simulator AND Android Emulator both shipped — shadows render on both (platform-split tokens), font weights map cleanly, safe areas respected on notch and gesture-bar devices, navigation gestures feel native (Constitution Principle IV).
- **Adaptive**: Dynamic Type 2× / Android font scale Largest still reflows cleanly. No clipped tab bar labels, no overlapped display titles.
- **Performant**: Reanimated worklets on the UI thread, `expo-image` with blurhash on heroes, `FlatList` with stable `keyExtractor` and `getItemLayout` where the row height is known. Hermes-ready.
- **Memorable**: Will the user remember this app's screen vs the last AI-generated app they saw?

**The test**: If you took a screenshot via `screenshot.mjs` and showed it to a designer with the caption "AI made this bolder," would they believe you immediately? If yes, you've failed. Bolder on mobile means *decisive and authored*, not "more effects."

When the result feels right on both iOS and Android, hand off to `/impeccable-native polish` for the final pass.
