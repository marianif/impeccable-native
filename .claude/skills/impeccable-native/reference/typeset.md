> **Additional context needed**: brand stance (system-font default vs custom family), platform fidelity (`cupertino-android-pragmatic`, `material-everywhere`, `cupertino-everywhere`, `custom-cross-platform`), and whether a `tokens.type` ramp already exists.

Typography carries most of the information on a mobile screen, on a surface a third the size of a laptop. Replace generic defaults (Inter everywhere, a flat 14/16/18 ramp, system fallback at no contrast) with type that reflects the brand, scales with Dynamic Type, and survives the iOS/Android weight divergence.

`/impeccable-native typeset` is the *procedure* for fixing type on a target. The deep lookup — scale tables, platform weight matrix, custom-font loading snippets, `fontVariant` portability, all-caps tracking math — lives in [typography.md](typography.md). Read that file before applying anything here.

Before typesetting: confirm `node .claude/skills/impeccable-native/scripts/detect-rn-flavor.mjs` has run and that `load-context.mjs` has surfaced `PRODUCT.md` + `DESIGN.md`. The `Platform Fidelity` field and the existing `tokens.type` shape define what changes are allowed.

---

## Register

**Brand** (portfolio, marketing app, launch experience): pairing follows the brand's lane — display serif + system sans for editorial/luxury, one committed sans for tech, monospace display for technical/builder brands. Hierarchy ratio ≥ 1.33. A custom font is justified because the typography is doing real identity work; accept the loading cost.

**Product** (dashboards, utilities, social, fintech, productivity): the system font is almost always the right answer. SF Pro on iOS and Roboto on Android are highly tuned, ship with the OS at zero load cost, support Dynamic Type's optical-size variants, and respect every accessibility setting the user has configured. Hierarchy ratio 1.2–1.33 with tighter contrast between adjacent steps. Reach for a custom font only when a specific letterform is doing design work the system font cannot.

If unsure, default to system fonts and put the design budget into hierarchy, weight contrast, and `letterSpacing` discipline instead.

---

## Assess Current Typography

Read every screen in scope on iOS Simulator and Android Emulator side by side. Capture a baseline via `node .claude/skills/impeccable-native/scripts/screenshot.mjs` so the before/after is concrete. Then diagnose:

1. **Font choices**:
   - Are we using invisible defaults? (Inter on a brand-led app, Roboto on iOS where SF Pro would carry, a humanist sans on a productivity app "for warmth").
   - Does the font match the brand register? A playful kids' app on a corporate geometric sans is a tell; a finance app on a friendly rounded display is a different tell.
   - Are there more than two families? Two is the ceiling on mobile. Three is almost always drift.
   - If custom: is it loaded via `expo-font` / `@expo-google-fonts` behind a splash-screen gate, or does the app flash system font on first paint?

2. **Scale & hierarchy**:
   - Is there a named role ramp in `tokens.type` (`caption` / `label` / `body` / `title` / `headline` / `display`), or is each screen picking sizes ad hoc?
   - Are sizes too close to distinguish? `13` / `14` / `15` / `16` reads as muddy on a 6.1" screen.
   - Are weight contrasts strong enough? `Regular` vs `Medium` is barely visible on Android where Roboto snaps intermediate weights.
   - Are roles named by role (`body`) or by value (`size16`)? Value-named tokens are a finding.

3. **Platform divergence**:
   - Does the design depend on a weight that ships only on iOS? Roboto reliably ships `100` / `300` / `400` / `500` / `700` / `900`; everything else snaps to the nearest available, often invisibly.
   - Does any italic style differ between platforms (true italic faces on iOS vs mechanical slant on Android)?
   - If a custom font is in use: are all weights/italics bundled for *both* platforms, or does one platform silently fall back?

4. **Dynamic Type / font scale**:
   - Does any `<Text>` set `allowFontScaling={false}` without a load-bearing reason? That is an accessibility violation.
   - Test the surface at 2× iOS Dynamic Type and Android "Largest" font size. What clips, overlaps, or pushes off-screen?
   - Are headlines and tab labels capped with `maxFontSizeMultiplier` to bound layout damage, or do they break entirely at 310%?

5. **Numeric & feature details**:
   - Do digit columns (prices, timers, counters) use `fontVariant: ['tabular-nums']`? Without it, `1.00` and `0.99` are different widths and rows jiggle on update.
   - Do all-caps labels carry positive `letterSpacing` (0.5–1.5pt, roughly 5–12% of `fontSize`)? Default-spaced uppercase reads as cramped and immature.

6. **Readability**:
   - Is body text at least 16pt for primary reading content?
   - Is `lineHeight` declared as a total-point literal (`24`) rather than a multiplier (`1.5`)? RN expects the total line-box height in points.
   - On dark surfaces: has perceived weight been compensated on three axes — `lineHeight +1–2pt`, `letterSpacing +0.2`, weight bumped one notch? Adjusting only one of these still reads as too thin.

7. **Consistency**:
   - Are same-role elements typeset the same way across screens? A section header at `17/500` here and `18/600` there is drift.
   - Are intermediate values (e.g. `fontSize: 17`) leaking past the token scale?

**CRITICAL**: the goal isn't to make text fancier. It's to make hierarchy unmistakable, reading comfortable, and the type respectful of every accessibility setting the user has configured. Good mobile typography is invisible; bad mobile typography is the thing the user blames when the app feels off.

---

## Plan Typography Improvements

Cross-reference [typography.md](typography.md) for the canonical scale table, platform weight matrix, and Dynamic Type guidance. Then write a plan with these elements:

- **Font decision**: stay on system fonts, or commit to a custom family with full weight bundles for both platforms?
- **Token ramp**: define / refine `tokens.type` with role-named entries (`caption`, `label`, `body`, `title`, `headline`, `display`). Five to six roles cover almost every screen.
- **Weight strategy**: which weights are load-bearing? Stick to `400` / `500` / `700` if the design needs to render identically on both platforms; otherwise document where you accept iOS/Android divergence.
- **Dynamic Type strategy**: which screens / labels need `maxFontSizeMultiplier` caps? Default is none — let type grow.
- **Special features**: where does `fontVariant: ['tabular-nums']` apply? Which labels need positive `letterSpacing` for all-caps?

Confirm the plan against `Platform Fidelity` from PRODUCT.md before changing tokens. A `cupertino-android-pragmatic` brief tolerates SF/Roboto divergence; `custom-cross-platform` does not.

---

## Improve Typography Systematically

### Font selection

If the brief justifies a custom font, load it through `@expo-google-fonts` (or `expo-font` for self-hosted) behind a splash-screen gate:

```tsx
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_700Bold } from '@expo-google-fonts/instrument-sans';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [loaded] = useFonts({
    'InstrumentSans-Regular': InstrumentSans_400Regular,
    'InstrumentSans-Medium':  InstrumentSans_500Medium,
    'InstrumentSans-Bold':    InstrumentSans_700Bold,
  });

  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);
  if (!loaded) return null;
  return <YourApp />;
}
```

Two non-negotiables: every weight you use is loaded as a *distinct family name* (RN does not honor `fontWeight` against a single-file family the way the web does), and the splash screen does not clear until `useFonts` returns `loaded`. Otherwise the first paint flashes system font — the RN equivalent of FOUT, but worse because the layout reflows.

Avoid variable fonts. Android support is version-dependent and limited; one weight per file is the portable answer.

For system-font roles, omit `fontFamily` entirely. RN resolves missing `fontFamily` to SF Pro on iOS and Roboto on Android automatically, with full Dynamic Type behavior.

### Establish the token ramp

Build `tokens.type` with **role-named entries**, never value-named. Each role declares `fontSize`, `lineHeight` (total points, not a multiplier), `fontWeight` as a string literal with `as const`, and optionally `letterSpacing` and `fontFamily`:

```ts
type: {
  caption:  { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
  label:    { fontSize: 14, lineHeight: 20, fontWeight: '500' as const, letterSpacing: 0.2 },
  body:     { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  title:    { fontSize: 18, lineHeight: 26, fontWeight: '600' as const },
  headline: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const },
  display:  { fontSize: 36, lineHeight: 42, fontWeight: '700' as const, fontFamily: 'InstrumentSerif-Italic' },
}
```

Combine dimensions (size + weight + color + space) for hierarchy. Don't rely on size alone — on a 390pt screen, the difference between 14 and 16 is barely perceptible without weight or color contrast backing it up.

### Honor platform weight reality

The single biggest typography failure on RN is "I designed at weight `600` and it looks right on iOS and wrong on Android." See [typography.md](typography.md) for the full matrix; the short version:

- SF Pro ships `100` through `900` in clean steps with true italic faces.
- Roboto reliably ships `100`, `300`, `400`, `500`, `700`, `900`; intermediate values snap to the nearest available, sometimes invisibly.
- Italics on Android are a mechanical slant on most weights; iOS has true italic faces.

If the design demands cross-platform identity, restrict to `400` / `500` / `700` or ship a custom font with full weight bundles. Otherwise document the divergence as intentional under `cupertino-android-pragmatic`.

### Dynamic Type discipline

Every `<Text>` respects `allowFontScaling` (default `true`). **Never blanket-disable.** Disabling Dynamic Type is an accessibility violation and a common AI tell.

The real work is making layouts survive the scale-up:

- Titles that must fit one line get `numberOfLines={1}` + `ellipsizeMode="tail"`.
- Body paragraphs stay unbounded; they reflow.
- Tab labels, FAB labels, and tightly-fitted CTAs cap with `maxFontSizeMultiplier={1.4}` rather than disabling scaling.

```tsx
<Text style={tokens.type.label} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.4}>
  Settings
</Text>
```

Test every screen at 2× iOS Dynamic Type (Simulator → I/O → Toggle Larger Accessibility Sizes) and Android "Largest" (Emulator → Settings → Display → Font size). Defects are real bugs, not stylistic remarks.

### Refine details

- **Tabular numbers**: `fontVariant: ['tabular-nums']` on prices, timers, counters, scoreboards — anywhere digits update in place. Without it, the row twitches.
- **All-caps tracking**: positive `letterSpacing` (0.5–1.5pt, ~5–12% of fontSize) on short uppercase labels (eyebrows, button text, section headers). Don't `textTransform: 'uppercase'` body paragraphs — uppercase is for emphasis, not reading.
- **Dark-mode compensation**: when type flips to light-on-dark, bump `lineHeight` by 1–2pt, add `letterSpacing: 0.2`, step weight up one notch. Adjust all three or it reads as too thin.
- **Measure**: on phone, let the natural 30–40 character measure win. On tablet, cap content width with `maxWidth` so a long-form screen doesn't blow past 75ch on iPad.

### Weight consistency

- Define one weight per role and stick to it. Don't use `Semibold` for "title" on one screen and `Bold` for "title" on another.
- 3–4 weights cover almost every UI. Load only what you actually use — every weight is a separate file and a real bundle cost.

**NEVER**:
- Use more than 2 font families per app.
- Use `lineHeight` as a multiplier (`1.5`). RN expects the total line box in points (`24`).
- Set `allowFontScaling={false}` without an explicit, documented layout reason (and even then, prefer `maxFontSizeMultiplier`).
- Ship custom fonts that load after the splash clears.
- Ship variable fonts and assume Android renders them.
- Pair two similar-but-not-identical sans-serifs (Inter + SF Pro, Manrope + Geist).
- Set body text below 16pt for primary reading content.
- Name tokens by value (`size16`, `font14`). Use roles.
- Forget `fontVariant: ['tabular-nums']` on digit columns.
- Forget positive `letterSpacing` on all-caps labels.
- Assume `fontWeight: '600'` looks the same on iOS and Android.

---

## Verify Typography Improvements

Verify each item on **both** iOS Simulator and Android Emulator. A clean run on one platform is not evidence; Constitution Principle IV makes parity unskippable.

- **Hierarchy**: can you identify caption / body / title / headline at a glance, on both platforms?
- **Token discipline**: every `<Text>` reads `tokens.type.<role>`. No raw `fontSize: 17` or `lineHeight: 1.5` literals remain. (`node .claude/skills/impeccable-native/scripts/extract-tokens.mjs --dry-run` surfaces leakage.)
- **Custom-font gate**: first paint shows the brand font, not system fallback. The splash screen holds until `useFonts` returns `loaded`.
- **Weight parity**: every load-bearing weight renders identically on iOS and Android, or the divergence is documented as intentional.
- **Dynamic Type survives**: at 2× iOS / Largest Android, nothing clips, overlaps, or pushes content off-screen. Caps via `maxFontSizeMultiplier` are scoped to the labels that genuinely need them.
- **`allowFontScaling` audit**: no blanket `false`. Any `false` instance has a justifying comment.
- **Numbers**: every digit column carries `fontVariant: ['tabular-nums']`. Updating values do not twitch.
- **All-caps**: every uppercase label carries positive `letterSpacing`.
- **Dark-mode pass**: light-on-dark text has been compensated on `lineHeight`, `letterSpacing`, and weight. Reads at the same density as the light-mode equivalent.
- **VoiceOver + TalkBack**: screen titles carry `accessibilityRole="header"`. Decorative or abbreviated text (`$1.2k`) carries a full `accessibilityLabel`.

When the type carries the hierarchy on its own, hand off to `/impeccable-native polish` for the final pass.
