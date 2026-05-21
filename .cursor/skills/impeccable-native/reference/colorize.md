> **Additional context needed**: existing brand accent (if any), `platform-fidelity` from PRODUCT.md, and the current `tokens.ts` if one exists.

Replace timid grayscale, lone-accent designs, or hex-littered StyleSheets with a token-driven palette that ships parallel light and dark sets, respects platform color conventions, and reads cohesive on iOS and Android. More color is not better. Strategic color, expressed once in tokens and consumed via `useTheme()`, beats hex sprinkled through screen files.

Before colorizing: confirm the flavor detector has run (`node .cursor/skills/impeccable-native/scripts/detect-rn-flavor.mjs`) and that `load-context.mjs` surfaced PRODUCT.md + DESIGN.md. The `platform-fidelity` field (cupertino-android-pragmatic | material-everywhere | cupertino-everywhere | custom-cross-platform) decides how aggressively your brand color overrides system tints; the styling flavor decides where the tokens land.

Treat this file as the **command procedure**. For the underlying color theory, OKLCH-to-hex workflow, palette structure, contrast thresholds, and dark-mode rules, defer to `reference/color-and-contrast.md` — do not duplicate it here.

---

## Register

**Brand**: palette IS voice. Pick a color strategy first per SKILL.md (Restrained / Committed / Full palette / Drenched) and follow its dosage. Committed, Full palette, and Drenched deliberately exceed the ≤10% rule; that rule is Restrained only. On mobile, drenched surfaces hit harder because the viewport is small — one full-bleed brand color owns the whole screen, not a hero band.

**Product**: semantic-first and almost always Restrained. Accent is reserved for primary action, current selection, and state indicators. Not decoration. Every color has a consistent meaning across every screen. On a phone, where users glance for under a second, semantic consistency is non-negotiable — if green means success on screen A and "active" on screen B, the app feels untrustworthy.

---

## Assess Color Opportunity

Analyze the current state across **both platforms** before proposing changes:

1. **Where does color currently live?**
   - Hex literals in StyleSheet calls? (drift — needs hoisting)
   - A `tokens.ts` with one flat color object? (incomplete — needs `light` + `dark` siblings)
   - Ternaries on `useColorScheme()` scattered through components? (hoisting needed — see Plan)
   - Platform-divergent colors (`shadowColor` on iOS, no elevation tint on Android)? (parity issue)

2. **What needs color?**
   - **Semantic meaning**: success, error, warning, info — each should resolve through tokens, not ad-hoc greens.
   - **Hierarchy**: primary CTA, active tab, focused field, selected row.
   - **Wayfinding**: tab bar active state, current step in onboarding, header chrome per section.
   - **Emotional tone**: surface tinting (warm / cool / neutral) that matches brand voice without screaming.
   - **System chrome**: status bar style, Android nav bar background, sheet handles, keyboard accessory tint.

3. **Brand inputs**: existing accent, anti-references (e.g. "not another Material 3 default", "not a Stripe-cream finance app"), and `platform-fidelity`. If unclear, ask the user directly to clarify what you cannot infer..

**CRITICAL**: more color is not better. Strategic color beats rainbow vomit. Every token earns its slot in `tokens.ts` by being used somewhere meaningful.

---

## Plan Color Strategy

Produce a written plan before touching code. The plan answers:

- **Hue family**: which OKLCH hue (or two) the brand owns. Do not reach for hue 250 (blue) or hue 60 (warm orange) by reflex — those are the dominant AI-design defaults. See `color-and-contrast.md` for the OKLCH-think → hex-emit workflow.
- **Tinted neutrals**: which direction the neutrals lean (toward the brand hue at chroma 0.005–0.015). Pure gray is dead on mobile next to a tinted accent.
- **Palette roles**: accent (subtle / regular / strong), surface (background / surface / surfaceSubtle), text (primary / secondary / tertiary / inverse), semantic (error / warning / success / info), border (border / borderStrong). Skip secondary accents unless the brand strategy demands them.
- **Dark-mode adjustments**: which accents desaturate, which surfaces lighten with elevation rather than darken, what the "near-black" is (never `#000000` — see OLED warning below).
- **Platform stance**: based on `platform-fidelity`, how you handle iOS tint color and Android Material You (detailed below).
- **System chrome**: status bar style per screen archetype, Android nav bar background, splash + app icon color story.

Get user approval on the strategy before emitting tokens. A wrong hue choice ripples through every screen.

---

## Constitution Gate: iOS + Android Parity

Before emitting any tokens, commit to inspecting the result on **both platforms**. Constitution Principle IV: a colorize pass that only verified on the iOS simulator is not done. Specifically:

- The same hex renders differently on iOS (Display P3 wide gamut) and Android (sRGB by default) — saturated accents can look noticeably duller on Android. Verify; do not assume.
- Dark mode follow-system works differently: iOS exposes user override in Settings → Display, Android in Settings → Display. Test both with system dark on and with the app's optional in-app override.
- Status bar and Android nav bar are not optional polish — they are part of the color deliverable.

If you cannot inspect on Android (no emulator, no device), stop and say so. Do not ship colors verified only on iOS.

---

## Emit Tokens, Not Hex

The palette lives in **one place**: `tokens.ts` (or whatever DESIGN.md names). Two parallel objects, identical keys:

```ts
// tokens.ts
const light = {
  // accent: oklch(60% 0.18 30) — warm coral
  accent: '#D4522A',
  accentSubtle: '#FBE8E0',
  accentStrong: '#A83D1C',

  background: '#F9F7F4',     // oklch(96% 0.005 30) — warm-tinted neutral
  surface: '#FFFFFF',
  surfaceSubtle: '#F2F0ED',

  textPrimary: '#1A1816',
  textSecondary: '#5A524C',
  textTertiary: '#8A827C',
  textInverse: '#FFFFFF',

  border: '#E8E4DF',
  borderStrong: '#C9C2BC',

  success: '#2E7D5B',
  warning: '#C97A14',
  error:   '#B33A2A',
  info:    '#2A6FB3',
};

const dark = {
  accent: '#E8673D',          // desaturated from light-mode accent
  accentSubtle: '#3A1F15',
  accentStrong: '#F58B5C',

  background: '#0A0A0B',      // NOT #000000 (see OLED warning)
  surface: '#1A1816',         // lighter than background; depth via lightness, not shadow
  surfaceSubtle: '#221F1C',

  textPrimary: '#F0EDE8',     // NOT #FFFFFF
  textSecondary: '#B8B0A8',
  textTertiary: '#7A7268',
  textInverse: '#1A1816',

  border: '#2A2724',
  borderStrong: '#3A3632',

  success: '#5BC48F',
  warning: '#E8A848',
  error:   '#E86A5C',
  info:    '#6BA8E0',
};

export const tokens = { color: { light, dark } /* ...type, space, etc */ };
```

Notes the emit must respect:

- **OKLCH stays in comments only.** React Native's StyleSheet does not accept OKLCH strings; they fail silently on iOS and render garbage on Android. Design in OKLCH, ship hex/rgba.
- **`light` and `dark` have identical keys.** A key present in one but not the other will runtime-crash the first time the user toggles theme on a screen that touches it.
- **No `#000000` background in dark mode.** Use `#0A0A0B` or near-neutral with the brand hue at chroma 0.005. Pure black on OLED reads as a dead pixel state; saturated accents vibrate against it; and brand cohesion dies.
- **No `#FFFFFF` text in dark mode.** Step down to `#F0EDE8` (or tinted equivalent) — pure white on dark surfaces is fatiguing at sustained read length.

---

## The `useTheme()` Hook Is the Only Consumer Pattern

One hook resolves the active palette per render. Components never read `useColorScheme()` directly.

```tsx
// theme.ts
import { useColorScheme } from 'react-native';
import { tokens } from './tokens';

export function useTheme() {
  const scheme = useColorScheme();           // 'light' | 'dark' | null
  return tokens.color[scheme ?? 'light'];
}
```

Then in a component:

```tsx
const colors = useTheme();

return (
  <View style={{ backgroundColor: colors.surface }}>
    <Text style={{ color: colors.textPrimary }}>Hello</Text>
  </View>
);
```

**Forbidden patterns** (the colorize pass exists in part to delete these):

- `const isDark = useColorScheme() === 'dark'` followed by inline ternaries on every color prop.
- Hex literals inside StyleSheet.create — every color routes through `useTheme()`.
- A single flat `tokens.color` (no `light` / `dark` split) with components flipping colors manually.
- Importing `tokens.color.light.accent` directly into a component (breaks dark mode silently).

If the project uses NativeWind or Unistyles, the same rule applies: tokens drive theme variants, components consume the resolved value. NativeWind: `dark:` variants compile from a token config, never from hex literals in className strings. Unistyles: theme-aware `createStyleSheet` reads from the tokens module.

---

## Platform Color Stances

`platform-fidelity` decides what you do with system tints. The four stances:

### `cupertino-android-pragmatic` (most common)
- **iOS tint color**: leave iOS system blue on system primitives (`Switch`, `ActivityIndicator`, default segmented controls). Use brand accent only on your own components.
- **Android Material You**: opt out for in-app surfaces by setting explicit colors on every primitive. Accept that the system notification shade and quick settings follow the user's wallpaper — that is not your surface.
- Status bar: per-screen, matched to the surface beneath.

### `cupertino-everywhere`
- iOS: same as above — defer to system blue where it would naturally appear.
- Android: replicate iOS conventions. Switch becomes a custom component with iOS-style track + thumb in your accent. Material You is opted out everywhere.
- Reads "iOS app on Android" — sometimes correct (brand-strict apps), sometimes off-putting (productivity apps Android users expect to feel native).

### `material-everywhere`
- Embrace Material 3 dynamic color or pin Material colors deliberately. Use `react-native-paper` or a Material-aware component library.
- iOS gets Material chrome. This is a strong stance — only ship if the brand demands it.

### `custom-cross-platform`
- Override iOS tint at the root (set `tintColor` on Image, replace Switch / Slider / ActivityIndicator with custom components consuming `useTheme()`). Material You is fully opted out.
- Both platforms render identical brand chrome. The brand wins, native conventions yield.

Whatever the stance, document it once in DESIGN.md so the next pass does not re-decide screen by screen.

---

## Status Bar & Android Navigation Bar

System chrome is part of the colorize deliverable. Two surfaces, often forgotten:

### Status bar (both platforms)

Use `expo-status-bar`:

```tsx
import { StatusBar } from 'expo-status-bar';

// In a screen with a light surface:
<StatusBar style="dark" />

// In a brand-magenta hero screen:
<StatusBar style="light" />
```

For complex apps, drive the style from the screen's surface token rather than hard-coding. A `useStatusBarStyle(colors.background)` helper that picks `light` or `dark` based on luminance keeps it correct across light/dark mode without per-screen ternaries.

### Android navigation bar (the bottom system bar)

Theme via `expo-navigation-bar` so the seam between app and system disappears:

```tsx
import * as NavigationBar from 'expo-navigation-bar';

useEffect(() => {
  NavigationBar.setBackgroundColorAsync(colors.background);
  NavigationBar.setButtonStyleAsync(scheme === 'dark' ? 'light' : 'dark');
}, [colors.background, scheme]);
```

Without this, the Android nav bar stays system-default (often black) under your tinted surface and the screen looks unfinished. Edge-to-edge layouts on Android 15+ require this to render correctly.

### Tab bar, sheet handles, keyboard accessory

Part of the chrome palette. Pull from `tokens.color.surface` (or a dedicated `surfaceChrome` if the project differentiates) and keep them consistent across navigator and screen. Mixing surfaces between the screen and the tab bar reads as a bug.

---

## Apply Color Across Roles

Once tokens emit and `useTheme()` is wired, walk the surface and apply roles intentionally:

### Semantic
- State indicators (success / error / warning / info) route through the semantic tokens, never raw hex.
- Status badges, validation messages, toasts, loading skeletons — all read from tokens.

### Accent
- Primary CTA (filled button background, or text color on a neutral button per brand).
- Active tab indicator and selected nav state.
- Focused field outline (paired with non-color signal — see Accessibility below).
- Key data emphasis (one number per screen, not every number).

### Surface
- Background (root), surface (cards, sheets, modals), surfaceSubtle (nested cards, pressed states without alpha).
- In dark mode, **depth comes from surface lightness**, not from shadow. Higher elevation surfaces are lighter, not darker. Shadows are mostly invisible on dark backgrounds.

### Borders
- Hairlines for structural separation, borderStrong for focus and emphasis.
- Never use `border-left` / `border-right` greater than 1px as a colored accent stripe — banned. Use a full hairline border, a leading icon, or a 4–8% accent surface tint instead.

### Text
- textPrimary for body and headings, textSecondary for labels and metadata, textTertiary for placeholders and de-emphasized chrome, textInverse for text on accent surfaces.
- Never put `textPrimary` on `accent` — the contrast math fails. That is what `textInverse` is for.

---

## Accessibility Verification

Color choices route through contrast checks before they ship. Defer to `color-and-contrast.md` for the full WCAG table; the colorize-specific checks are:

- Every accent-on-surface pair clears 4.5:1 for body, 3:1 for UI components and large text.
- Dark-mode accents re-checked against dark surfaces — saturated brand colors that pass on light often fail on dark.
- `placeholderTextColor` is `textTertiary` minimum, not the platform default (which usually fails 4.5:1).
- Color is paired with a non-color signal (icon, label, position) for every state — required for color-blind users and a forcing function for clarity.
- Color-blindness simulation run in iOS Simulator → Accessibility → Color Filters (Protanopia / Deuteranopia / Tritanopia) for screens that depend on red/green/yellow distinction (status, charts, calendar heat).

If anything fails, the token changes — not the component.

---

## Verify Color Addition

Test that colorize improved the experience on both platforms:

- **Hierarchy**: does color guide attention to the right action on each screen?
- **Meaning**: does the same color mean the same thing on every screen?
- **Theme**: does light mode look intentional, and dark mode look designed (not inverted)?
- **Platform**: does iOS feel iOS-correct and Android feel Android-correct per the chosen `platform-fidelity`?
- **System chrome**: status bar and Android nav bar match the surface beneath on every screen archetype?
- **Tokens**: zero hex literals in StyleSheet calls, zero `useColorScheme()` ternaries in components, every color through `useTheme()`?
- **Accessibility**: WCAG passes on both modes, color-blind simulation passes on critical screens?

Screenshot both simulators (`node .cursor/skills/impeccable-native/scripts/screenshot.mjs`) at the same screen, light and dark, side by side. If the dark-mode capture looks like "light mode with the lights off," redesign the dark palette — depth comes from lightness, not darkness.

When the palette earns its place and tokens are clean, hand off to `/impeccable-native polish` for the final pass.
