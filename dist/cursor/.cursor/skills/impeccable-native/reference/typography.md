# Typography

## Classic Typography Principles

### Vertical Rhythm

`lineHeight` is the base unit for vertical spacing. If body text has `fontSize: 16` with `lineHeight: 24`, your `tokens.space` step that pairs with body content should be `24` (`space['6']`) or a clean multiple. Text and surrounding space sharing the same mathematical foundation creates the subconscious calm that "good typography" usually means.

In RN, `lineHeight` is the *total* line box height in points, not a multiplier (`24` literal, not `1.5`). State the literal value in tokens so it's unambiguous on both platforms.

### Modular Scale & Hierarchy

The common mistake on mobile: six font sizes that are too close (12, 13, 14, 15, 16, 18). The screen is too small to forgive muddy hierarchy. Use fewer sizes with more contrast — a 5-size system covers almost every mobile screen:

| Role | Typical Size | Use Case |
|------|--------------|----------|
| caption | 12 | Captions, metadata, legal microcopy |
| label | 14 | Buttons, secondary labels, list metadata |
| body | 16 | Default reading text, list rows |
| title | 18 | Section headings within a screen |
| headline | 24 | Screen titles |
| display | 36+ | Hero moments, splash, onboarding |

Popular ratios: 1.25 (major third), 1.333 (perfect fourth), 1.5 (perfect fifth). Pick one and commit — the values above use roughly 1.33. Tokens in `tokens.ts` are stable across the project; specific screens consume them by role, never by literal size.

### Readability & Measure

On a 390pt-wide phone (iPhone 15), a 16pt body line at standard padding wraps around 30–40 characters — narrower than the web 65–75ch comfortable measure. Mobile readers tolerate this because thumb scrolling makes line breaks cheap. **Don't try to force 65ch on a phone** by shrinking type; let the platform's natural measure win.

For long-form reading screens (article, FAQ, terms-of-service), cap content width on tablet with `maxWidth` so measure doesn't blow past 75ch on iPad. Use `Dimensions.get('window').width` or `useWindowDimensions` to decide.

**Light text on dark surfaces needs compensation on three axes.** When the same type role flips for dark mode, the perceived weight drops — counter it on three fronts at once:

- Bump `lineHeight` by 1–2pt
- Add `letterSpacing: 0.2` (or roughly 1–2% of fontSize)
- Step the weight up one notch (`'400'` → `'500'`)

If you only adjust one, the text reads as too thin. Adjust all three.

## Font Selection & Loading

### Anti-reflexes worth defending against

- A productivity app does NOT need a humanist sans "for warmth." Most productivity apps should let SF Pro / Roboto do their job.
- An editorial app does NOT need the expressive serif everyone else is using right now. Premium can be Swiss-modern, can be a quiet humanist sans, can be a literal monospace.
- A kids' app does NOT need a rounded display font. Real children's typography is more varied.
- A "modern" brief does NOT need a geometric sans. The most modern thing you can do on mobile is let the platform's system font carry, and put your weight into hierarchy and density instead.

### System fonts are the default

On iOS, RN's `fontFamily: 'System'` (or no `fontFamily` at all) resolves to **SF Pro** with full Dynamic Type support, optical sizing across weights, and proper kerning. On Android, the equivalent default is **Roboto**.

**For most product apps, this is the right answer.** SF Pro and Roboto are highly readable, ship with the OS at zero load cost, and respect every accessibility setting the user has configured. Reach for a custom font only when:

- The brief is brand-led and the typography is part of the brand identity
- A specific letterform character (a distinctive `g`, a wide italic) is doing real design work
- The platform fidelity stance is `custom-cross-platform` and a unified font is part of that decision

If you're going custom, accept the cost: load delay, fallback shift, multi-weight bundle size, and the loss of Dynamic Type's optical-size variants.

### Loading custom fonts

Use `expo-font` (managed) or `@expo-google-fonts/*` (managed, easier). On bare RN, link fonts via `react-native-asset` or native asset catalogs.

```tsx
// expo with @expo-google-fonts
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, InstrumentSans_400Regular, InstrumentSans_500Medium } from '@expo-google-fonts/instrument-sans';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [loaded] = useFonts({
    'InstrumentSans-Regular': InstrumentSans_400Regular,
    'InstrumentSans-Medium': InstrumentSans_500Medium,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;
  return <YourApp />;
}
```

Two non-negotiables:

- **Load fonts before the splash screen clears.** Otherwise text flashes the system font on first render — the RN equivalent of FOUT. Use `expo-splash-screen.preventAutoHideAsync()` and hide it only after `useFonts` returns `loaded: true`.
- **One file per weight.** RN doesn't support variable fonts cleanly across both platforms (Android support is limited and version-dependent). Load each weight as a separate file with a distinct family name (`InstrumentSans-Regular`, `InstrumentSans-Medium`).

In `tokens.type`, omit `fontFamily` for system-font roles and add it explicitly only for branded ones:

```ts
type: {
  display:  { fontFamily: 'InstrumentSerif-Italic', fontSize: 36, lineHeight: 42, fontWeight: '400' as const },
  body:     { fontSize: 16, lineHeight: 24, fontWeight: '400' as const }, // system default
}
```

### Platform font reality

| Aspect | iOS (SF Pro) | Android (Roboto) |
|--------|--------------|------------------|
| Available weights | 100, 200, 300, 400, 500, 600, 700, 800, 900 | Limited — `100`, `300`, `400`, `500`, `700`, `900`; intermediate weights snap to nearest |
| Italic | Native italic + true italic faces | Mechanical slant on most weights |
| Optical sizing | Yes (Dynamic Type uses size-appropriate variants) | No |
| Numeric features | `fontVariant: ['tabular-nums']` supported | Supported on Android API 26+ |

If a design depends on weight `600` looking exactly the same on both platforms, it won't. Either accept the divergence (cupertino-android-pragmatic), load a custom font with full weights on both (`custom-cross-platform`), or stick to weights that map cleanly: `400`, `500`, `700`.

### Pairing Principles

**You often don't need a second font.** One well-chosen family in 2–3 weights creates cleaner hierarchy than two competing typefaces. Only add a second when you need genuine contrast — display headlines + body sans, or a monospace for data.

When pairing, contrast on multiple axes:

- Serif + Sans (structure contrast)
- Geometric + Humanist (personality contrast)
- Condensed display + Wide body (proportion contrast)

**Never pair fonts that are similar but not identical** (e.g., Inter and SF Pro). They create visual tension without clear hierarchy.

## Dynamic Type & Font Scaling

**This is the single biggest source of mobile typography defects.** iOS users can crank text size up to 310%; Android users can hit 200%. Your screens *will* run at those scales.

By default in RN, `allowFontScaling` is `true`. Every `<Text>` respects the user's system font scale. **Do not disable it.** Disabling Dynamic Type is an accessibility violation and a common AI tell ("the AI app where text doesn't grow").

The real work is making your layout *survive* the scale-up:

- **Use `flex: 1` + `numberOfLines` thoughtfully.** A title that must fit one line gets `numberOfLines={1}` + `ellipsizeMode="tail"`. A body paragraph stays unbounded.
- **Test at 2× scale.** iOS Simulator → I/O menu → Toggle Larger Accessibility Sizes. Android Emulator → Settings → Display → Font size → Largest. Every screen reflows. Defects: clipping, overlapping text, broken tab bars, FAB labels pushed off-screen.
- **Use `maxFontSizeMultiplier` to cap, not to disable.** On a tab bar label or a tightly-fitted CTA where 2× would break the layout entirely, cap with `maxFontSizeMultiplier={1.4}` rather than `allowFontScaling={false}`. This still respects the user's preference, just bounded.

```tsx
<Text
  style={tokens.type.label}
  numberOfLines={1}
  ellipsizeMode="tail"
  maxFontSizeMultiplier={1.4}
>
  Settings
</Text>
```

For more aggressive responsive sizing (rare; usually a code smell), `PixelRatio.getFontScale()` returns the user's current scale, and you can compute custom-bounded sizes. Use sparingly — the system already does this work correctly 95% of the time.

## Numeric & Special Features

RN supports a small slice of OpenType. The portable bits:

```tsx
<Text style={{ fontVariant: ['tabular-nums'], ...tokens.type.body }}>
  $1,234.56
</Text>
```

**Use `tabular-nums` for**: prices, timers, counters, any digits that change in place. Without it, `1.00` and `0.99` have different widths and the row jiggles when the value updates.

Other `fontVariant` options (`small-caps`, `oldstyle-nums`, `lining-nums`) have inconsistent platform support — don't rely on them as load-bearing design.

There is no portable RN equivalent for `text-wrap: balance` or `text-wrap: pretty`. If you need a headline to break cleanly, control it manually (`\n`) or use `numberOfLines` with an `ellipsizeMode`.

## ALL-CAPS Tracking

At default `letterSpacing`, capitals sit too close. Add `letterSpacing: 0.5` to `1.5` (or roughly 5–12% of fontSize) on short all-caps labels, eyebrows, button labels. Without this, an uppercase CTA reads as cramped and immature.

```tsx
label: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const, letterSpacing: 1.0 }
```

Don't set `textTransform: 'uppercase'` on long passages — uppercase is for labels and emphasis, not paragraphs. And the tracking adjustment doesn't apply uniformly to mixed case; it's an all-caps treatment specifically.

## Typography System Architecture

Name tokens by role, not value. `tokens.type.body` not `tokens.type.size16`. The role survives a size change; the value name doesn't.

Every type role declares:

- `fontSize` (number, points)
- `lineHeight` (number, points — not a multiplier)
- `fontWeight` (string literal: `'400' as const`, etc. — `as const` keeps TypeScript happy)
- `letterSpacing` (optional; needed for all-caps labels and dark-mode body)
- `fontFamily` (optional; omit to use platform default)

## Accessibility

- **Don't disable `allowFontScaling`.** Cap with `maxFontSizeMultiplier` if you genuinely must bound.
- **Minimum 16pt body text** for primary reading. Smaller is acceptable for metadata, captions, list secondary lines.
- **Touch targets via padding or `hitSlop`** when a `<Text>` is itself the affordance (e.g. an inline link). Don't rely on the text's natural height to meet the 44pt / 48dp minimum.
- **`accessibilityRole="header"`** on screen titles and section headers so VoiceOver and TalkBack can navigate by heading.
- **`accessibilityLabel`** when displayed text is decorative or abbreviated. A `<Text>$1.2k</Text>` should announce "one thousand two hundred dollars."

---

**Avoid**:
- More than 2 font families per app.
- Disabling Dynamic Type (`allowFontScaling={false}`) anywhere except as a last-resort layout fix on a single label.
- Hardcoded font sizes outside the token type scale.
- Multipliers in `lineHeight` (`1.5`) — RN expects total line box in points (`24`).
- Pairing two similar fonts (Inter + SF Pro, Manrope + Geist).
- Custom fonts loaded after the splash clears (FOUT).
- All-caps text without tracking.
- Variable fonts (limited cross-platform support).
