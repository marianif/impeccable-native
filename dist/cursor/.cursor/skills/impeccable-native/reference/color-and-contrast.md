# Color & Contrast

## Color Spaces: Design in OKLCH, Emit Hex

**Think in OKLCH.** It's perceptually uniform — equal steps in lightness *look* equal, unlike HSL where 50% lightness in yellow looks bright while 50% in blue looks dark. OKLCH takes three components: `oklch(lightness chroma hue)` where lightness is 0–100%, chroma is roughly 0–0.4, and hue is 0–360.

To build a primary color and its lighter / darker variants, hold the chroma+hue roughly constant and vary the lightness — but **reduce chroma as you approach white or black**, because high chroma at extreme lightness looks garish.

**Emit hex (or rgba) in `tokens.ts`.** React Native's StyleSheet doesn't accept OKLCH strings — they pass through without error and render as transparent on iOS, garbage on Android. So the workflow is:

1. Design the palette in OKLCH using a tool (Sip, Stark, [oklch.com](https://oklch.com), or an OKLCH plugin in Figma).
2. Convert to hex when landing in `tokens.ts`. Note the OKLCH source in a comment so the next design pass can adjust correctly.

```ts
const light = {
  // accent: oklch(60% 0.18 30) — warm coral
  accent: '#D4522A',
  // accentSubtle: oklch(94% 0.04 30)
  accentSubtle: '#FBE8E0',
  // accentStrong: oklch(50% 0.18 30) — pressed/active state
  accentStrong: '#A83D1C',
};
```

The hue you pick is a brand decision and should not come from a default. Do not reach for blue (hue 250) or warm orange (hue 60) by reflex — those are the dominant AI-design defaults, not the right answer for any specific brand. The same applies to teal-on-white (every health app), navy-and-gold (every fintech), and purple gradients (every AI tool).

## Building Functional Palettes

### Tinted Neutrals

**Pure gray is dead.** A neutral with zero chroma feels lifeless next to a colored brand. Add a tiny chroma value (0.005–0.015) to all your neutrals, hued toward whatever your brand color is. Small enough not to read as "tinted" consciously, but it creates subconscious cohesion between brand color and UI surfaces.

```ts
// brand accent: oklch(60% 0.18 30) — warm coral
// neutrals tint toward the same 30 hue at chroma 0.005
const light = {
  background: '#F9F7F4',    // oklch(96% 0.005 30)
  surface: '#FFFFFF',
  surfaceSubtle: '#F2F0ED', // oklch(94% 0.005 30)
  textPrimary: '#1A1816',   // oklch(15% 0.005 30)
};
```

The hue you tint toward comes from THIS project's brand, not from a "warm = friendly, cool = tech" formula. If your brand is teal, your neutrals lean toward teal. If your brand is amber, they lean toward amber. The point is cohesion with the *specific* brand, not a stock palette.

**Avoid** the trap of always tinting toward warm orange or always tinting toward cool blue. Those are the two laziest defaults and they create their own monoculture across mobile apps.

### Palette Structure

A complete RN system needs:

| Role | Purpose | Typical Token Count |
|------|---------|---------------------|
| **Accent** | Brand, primary CTAs, active tabs | 1 hue, 3 shades (subtle / regular / strong) |
| **Surface** | Background, card, sheet | 3 surfaces (background / surface / surfaceSubtle) |
| **Text** | Primary / secondary / tertiary / inverse | 4 shades on neutral, 1 inverse for accent surfaces |
| **Semantic** | Error, warning, success, info | 4 colors, 1 shade each (sometimes 2) |
| **Border** | Hairlines, structural separation | 2 shades (border / borderStrong) |

**Skip secondary/tertiary accents unless you need them.** Most apps work fine with one accent. Adding more creates decision fatigue and visual noise, and on a phone the screen is too small to forgive a busy palette.

### The 60-30-10 Rule (Applied Correctly)

This rule is about **visual weight**, not pixel count:

- **60%**: Neutral backgrounds, surfaces, content padding
- **30%**: Secondary colors — body text, borders, inactive tab states, icon glyphs
- **10%**: Accent — primary CTA, active tab indicator, focus state, key data emphasis

The common mistake: using the accent everywhere because it's "the brand color." Accent colors work *because* they're rare. Overuse kills their power. On mobile, where the user's eye is locked to a small viewport, this is even more pronounced — every accent appearance should be intentional.

## Theming: Light & Dark Mode

Dark mode is non-negotiable on mobile. Users expect it, the OS exposes the preference, and not supporting it reads as a half-shipped app.

### Dark Mode Is Not Inverted Light Mode

You can't just swap colors. Dark mode requires different design decisions:

| Light Mode | Dark Mode |
|------------|-----------|
| Shadows convey depth | Lighter surfaces convey depth (shadows mostly invisible on dark backgrounds) |
| Dark text on light surfaces | Light text on dark surfaces (consider stepping up weight + letterSpacing — see typography.md) |
| Vibrant accents | Desaturate accents slightly; saturated colors on dark vibrate uncomfortably |
| White backgrounds | **Never pure black.** Use dark gray with brand-hue chroma (oklch 12–18%, chroma 0.01) |

In dark mode, depth comes from surface lightness, not shadow. Build a 3-step surface scale where higher elevations are *lighter* (e.g. `background` at 12% lightness, `surface` at 18%, `surfaceSubtle` at 22%). Use the same hue and chroma as your brand and vary only lightness.

### Defining the Token Sets

In `tokens.ts`, define `light` and `dark` as two parallel objects with identical keys:

```ts
const light = {
  background: '#F9F7F4',
  surface: '#FFFFFF',
  textPrimary: '#1A1816',
  accent: '#D4522A',
  // ... etc, all roles
};

const dark = {
  background: '#141210',    // not #000000
  surface: '#1E1C1A',       // lighter than background, no shadow needed
  textPrimary: '#F0EDE8',   // not #FFFFFF
  accent: '#E8673D',        // slightly less saturated than light-mode accent
  // ... etc, same keys
};

export const tokens = { color: { light, dark }, /* ... */ };
```

### Consuming Both Modes

Use `useColorScheme()` from `react-native` (not from the deprecated `Appearance` API directly) and a small theme hook to select the active palette once per component:

```tsx
import { useColorScheme } from 'react-native';
import { tokens } from './tokens';

export function useTheme() {
  const scheme = useColorScheme();  // 'light' | 'dark' | null
  return tokens.color[scheme ?? 'light'];
}
```

Then components consume the resolved palette, not the raw token tree:

```tsx
const colors = useTheme();

<View style={{ backgroundColor: colors.surface }}>
  <Text style={{ color: colors.textPrimary }}>Hello</Text>
</View>
```

**Don't sprinkle ternaries through component code** (`scheme === 'dark' ? '#FFF' : '#000'`). The token system is the abstraction — if you find yourself reading `useColorScheme()` repeatedly in a render tree, hoist the lookup to a single `useTheme()` call.

### iOS Tint Color & Android Material You

Both platforms have system-level color opinions you have to take a stance on:

- **iOS tint color** (UIView.tintColor) propagates to nav bar buttons, switch active states, sheet handles, default `Pressable` accents on some primitives. By default it's iOS's system blue. RN respects it for some built-in components (`Switch`, `ActivityIndicator`). State your stance in PRODUCT.md's `platform-fidelity`:
  - `cupertino-everywhere` or `cupertino-android-pragmatic`: leave iOS tint as system blue on system components, use your brand accent on your own components. Reads as native.
  - `custom-cross-platform`: override iOS tint at the screen level (`<View tintColor={colors.accent}>`) so every primitive consumes your brand.

- **Android Material You** extracts a palette from the user's wallpaper and applies it to system primitives (Switch, Slider, default ripple). On Android 12+, this is opt-in for your app's components but unavoidable for stock OS UI (notification shade, settings). If you want to opt out of dynamic color in your own components, define explicit colors on every primitive — don't rely on the default. Most apps should opt out for the in-app surface and accept that the system shade follows the user's preference.

## Contrast & Accessibility

### WCAG Requirements

Mobile WCAG contrast requirements are the same as web, applied to the *rendered hex* not the OKLCH source:

| Content Type | AA Minimum | AAA Target |
|--------------|------------|------------|
| Body text | 4.5:1 | 7:1 |
| Large text (≥18pt, or ≥14pt bold) | 3:1 | 4.5:1 |
| UI components, icons, focus indicators | 3:1 | 4.5:1 |
| Decorative-only elements | None | None |

**The placeholder gotcha**: `placeholderTextColor` defaults vary by platform and almost always fail 4.5:1 if you pick a light gray. Either bump to a darker tone (`textTertiary` at minimum) or accept that it's effectively decoration and the input itself must convey its purpose.

### Dangerous Color Combinations

These commonly fail contrast or cause readability issues on mobile:

- Light gray text on white (the #1 accessibility fail)
- Gray text on any colored background — gray looks washed out and dead on color; use a darker shade of the *background's own hue* instead, or transparency on a known-contrast neutral
- Red on green, or green on red — 8% of men can't distinguish these
- Blue on red (vibrates visually)
- Yellow on white (almost always fails)
- Thin light text on images — unpredictable; either add a scrim or use heavier weight
- Dark mode accents on dark surfaces with insufficient contrast — saturated brand colors can look striking but fail 3:1 on hex check

### Never Use Pure Gray or Pure Black

Pure gray (`#808080`, OKLCH `50% 0 0`) and pure black (`#000000`) don't exist in nature; real shadows always have a color cast. Even a chroma of 0.005–0.01 is enough to feel natural without being obviously tinted. On OLED displays (every modern iPhone, most flagship Android), `#000000` reads as off — a true zero-pixel state — which is sometimes the intent, but more often a regression from the warmer near-black the brand actually wants.

### Testing

Don't trust your eyes. Tools that work for mobile output:

- **Stark** (Figma plugin + Mac app) — runs contrast checks on hex pairs.
- **WebAIM Contrast Checker** — paste the hex values you emit; web/mobile is the same math.
- **iOS Simulator → Accessibility Inspector → Color Contrast** — checks running screens.
- **Android Studio → Layout Inspector → Accessibility** — same for Android.
- **Color blindness simulators** — iOS Simulator has "Color Filters" in accessibility settings (Protanopia / Deuteranopia / Tritanopia). Test the screens that depend on red/green/yellow distinction.

## Alpha Is A Design Smell

Heavy use of transparency (`rgba`, `hsla` strings, or RN's `opacity` prop on layers) usually means an incomplete palette. Alpha creates unpredictable contrast against whatever's behind, performance overhead on Android (overdraw), and inconsistency across the app.

Define explicit overlay tokens for each context instead:

```ts
// Instead of: <View style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
// Define: scrim, surfaceTranslucent, etc.
const light = {
  scrimSheet: 'rgba(20, 18, 16, 0.4)',     // modal/sheet backdrop
  scrimPress: 'rgba(20, 18, 16, 0.08)',    // Pressable pressed overlay
};
```

The token names what the alpha is *for*; the value is still rgba, but the indirection means a redesign touches one constant, not every overlay across the app.

**Exceptions where alpha is correct:**
- Pressable / Ripple pressed states
- Sheet backdrops and modal scrims
- Disabled-state opacity (`opacity: 0.4` on a disabled button is fine)
- Loading shimmer (Reanimated-driven gradient)

## Status Bar & Navigation Bar

Color extends to system chrome. Mobile-specific:

- **Status bar**: set `<StatusBar style="light" />` or `"dark"` from `expo-status-bar` to match the surface below it. Sometimes per-screen — a brand-magenta hero screen wants light status bar text, the settings screen wants dark.
- **Android navigation bar** (the bottom system bar with back/home): theming via `expo-navigation-bar` or `react-native-navigation-bar-color`. Match it to your screen's background so the seam between app and system UI disappears.
- **Tab bar / sheet handles**: use `tokens.color.surface` consistently; mixing surfaces between the screen and the navigator chrome reads as a bug.

---

**Avoid**:
- Hex colors hardcoded in StyleSheet calls — every color reads from `useTheme()` / `tokens.color.{light|dark}`.
- Pure `#000000` or `#FFFFFF` anywhere (including dark mode backgrounds).
- OKLCH strings emitted to StyleSheet (silently fails / renders garbage).
- A single token tree without `light` + `dark` siblings.
- Ternary `colorScheme === 'dark' ? ... : ...` scattered through components (hoist to `useTheme`).
- Relying on color alone to convey state — pair with text, icon, or position.
- Light gray text on white (the #1 contrast fail).
- Alpha for what should be a defined color (saturating overlays through transparency rather than designing them).
- Saturated brand colors on dark surfaces without a contrast check.
- Skipping color-blindness simulation in iOS Simulator.
