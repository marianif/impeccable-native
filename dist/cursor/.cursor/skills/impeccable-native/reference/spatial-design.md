# Spatial Design

## Spacing Systems

### Use a 4pt Base

Mobile spacing is unit-numeric (RN doesn't have units; values are points / density-independent pixels). An 8pt scale is too coarse — you'll frequently need 12 (between 8 and 16). Use a 4pt scale: `4, 8, 12, 16, 24, 32, 48, 64, 96`.

In `tokens.ts`, name them numerically by step:

```ts
space: {
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '6': 24,
  '8': 32,
  '12': 48,
  '16': 64,
  '24': 96,
}
```

Consume by step number, not by literal value, everywhere — `padding: tokens.space['4']` reads as "4 units," not "16 pixels." That decoupling is the whole point of a scale.

### Use `gap` for Sibling Spacing

When the target RN version is 0.71 or higher (check `detect-rn-flavor.mjs` `rnVersion`), prefer `gap` on flex containers over per-child `marginBottom`. It composes cleanly with conditional rendering — no last-child reset needed. On older RN versions, fall back to `marginBottom` on each child except the last.

```tsx
// RN >= 0.71
<View style={{ gap: tokens.space['3'] }}>
  <Row />
  <Row />
  <Row />
</View>

// RN < 0.71 fallback
<View>
  {rows.map((r, i) => (
    <Row key={r.id} style={{ marginBottom: i === rows.length - 1 ? 0 : tokens.space['3'] }} />
  ))}
</View>
```

## Layout: Yoga Flexbox

RN uses Yoga, a flexbox implementation with two divergences from web you must hold in mind:

- **`flexDirection` defaults to `column`**, not `row`. Most of your screens will be column flexes.
- **There is no `display: grid`**. For grid-shaped layouts use nested flexes or `FlatList numColumns`. For uneven 2D layouts, compose with absolute positioning + flex children, or reach for a library (`react-native-masonry-list` is the common one).

### The Self-Adjusting List

Tablet-friendly multi-column lists use `FlatList numColumns` driven by screen width:

```tsx
import { useWindowDimensions, FlatList } from 'react-native';

const { width } = useWindowDimensions();
const numColumns = width >= 768 ? 2 : 1; // tablet → 2-up, phone → 1-up

<FlatList
  data={items}
  numColumns={numColumns}
  key={numColumns} // RN requires a key change when numColumns flips
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <Card item={item} />}
  contentContainerStyle={{ gap: tokens.space['3'], padding: tokens.space['4'] }}
  columnWrapperStyle={numColumns > 1 ? { gap: tokens.space['3'] } : undefined}
/>
```

The `key={numColumns}` is non-negotiable — FlatList caches measurement state by index and refuses to re-layout when `numColumns` changes without a key.

## Visual Hierarchy

### The Squint Test

Run the screen on simulator, then squint (or screenshot and apply a 4px Gaussian blur in Preview / a screenshot viewer). Can you still identify:

- The primary action?
- The most important content?
- Clear groupings?

If everything looks the same weight blurred, you have a hierarchy problem. On mobile this test is more important than on web — there's less screen real estate to forgive a flat hierarchy.

### Hierarchy Through Multiple Dimensions

Don't rely on size alone. Combine:

| Tool | Strong Hierarchy | Weak Hierarchy |
|------|------------------|----------------|
| **Size** | 3:1 ratio between display and body | <2:1 |
| **Weight** | `'700'` vs `'400'` | `'500'` vs `'400'` |
| **Color** | `textPrimary` vs `textTertiary` (high contrast) | `textPrimary` vs `textSecondary` (close tones) |
| **Position** | Top of screen, leading edge | Trailing edge, below the fold |
| **Space** | Surrounded by `tokens.space['8']`+ | Crowded against siblings |

The best hierarchy uses 2–3 dimensions at once: a screen title that's larger, bolder, **and** has more space below it before the first content block.

### Cards Are Not Required

Cards are the mobile reflex — the FlatList-of-identical-cards trap. Use spacing and alignment to group naturally before reaching for a card. Use a card only when:

- Content is genuinely distinct and tappable as a single unit
- Items need visual comparison side-by-side (rare on phone, common on tablet)
- Content needs an explicit interaction boundary (swipe actions, drag handle)

**Never nest cards inside cards.** Use spacing, typography, and `StyleSheet.hairlineWidth` dividers (`borderTopWidth: StyleSheet.hairlineWidth`) for hierarchy within a card.

If your list is a FlatList of identical card components with icon + title + subtitle, you're hitting an absolute ban from SKILL.md. Vary layout, surface contextual density, or use list rows with swipe actions instead.

## Safe Areas: Spacing's Hidden Geometry

The notch, Dynamic Island, status bar, and home indicator are part of your spatial system, not decoration to ignore. Every screen consumes safe-area insets explicitly:

```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();

<View style={{
  paddingTop: insets.top + tokens.space['4'],
  paddingBottom: insets.bottom + tokens.space['4'],
  paddingHorizontal: tokens.space['4'],
}}>
  {/* content */}
</View>
```

Add token space *on top of* the inset — the inset is the floor, not the total padding. Hardcoding `paddingTop: 44` works on iPhone 13 and breaks on every other device. The same content reads correctly on iPhone SE (no notch), iPhone 15 Pro (Dynamic Island), iPhone 15 Pro Max (large notch), and Pixel 7 (status bar height varies) when you compose `inset + token`.

For full-screen surfaces (modals, sheets, splash), wrap in `<SafeAreaView edges={['top', 'bottom']}>` instead of computing insets manually — the component handles the math.

## Touch Targets: Visual Size vs Tap Size

Buttons can look small but must offer a 44pt (iOS HIG) / 48dp (Android) tap target minimum. The icon glyph is 20–24pt; the pressable hit area is 44+. Two patterns:

**Padding to grow the touch area:**

```tsx
<Pressable
  onPress={onPress}
  style={({ pressed }) => ({
    padding: tokens.space['3'], // 12pt padding × 4 sides + 24pt icon = 48pt tap target
    opacity: pressed ? 0.6 : 1,
  })}
  accessibilityRole="button"
  accessibilityLabel="Close"
>
  <CloseIcon size={24} />
</Pressable>
```

**`hitSlop` when padding would distort the layout:**

```tsx
<Pressable
  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
  onPress={onPress}
>
  <Text style={tokens.type.label}>Skip</Text>
</Pressable>
```

`hitSlop` extends the touchable area without affecting layout. Use it for tight headers, inline chevrons, and any control that can't afford visual padding. Don't use it to rescue a button that's visually too small overall — fix the visual size first.

## Optical Adjustments

Geometrically centered icons often look off-center. The classic offenders:

- A **play triangle** ▶ in a circular button needs to shift right by 1–2pt; its visual mass leans left.
- An **arrow** needs to shift toward its direction; the head carries more weight than the tail.
- A **left chevron** ‹ in a back button reads as flush against the leading edge — add 2pt of leading padding.

These adjustments live in the icon component or its container's `padding`, not in `tokens` (they're per-icon, not systemic).

## Depth & Elevation

Mobile depth is two-platform: iOS uses `shadow*` props, Android uses `elevation`. Pair them in tokens (already shown in DESIGN.md):

```ts
shadow: {
  sm: {
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
    android: { elevation: 2 },
  },
  md: { /* ... */ },
  lg: { /* ... */ },
}
```

Apply with `Platform.OS`:

```tsx
<View style={[
  styles.card,
  Platform.OS === 'ios' ? tokens.shadow.md.ios : tokens.shadow.md.android,
]}>
```

Two rules:

- **Flat by default.** Surfaces rest flat — no decorative shadow. Reach for shadow only when an element is interactive (Pressable `pressed` state lift), genuinely elevated (modal sheet, floating banner), or needs to separate from a busy backdrop.
- **Low alpha.** `shadowOpacity` stays below 0.16. Higher reads as 2014 Material Design — an immediate tell that the design wasn't considered.

Avoid arbitrary `zIndex`. RN's z-axis composes from sibling order in most cases; explicit `zIndex` is mostly needed inside a `position: 'absolute'` stack. When you do need it, keep a semantic scale in tokens (modal=100, sheet=200, toast=300, tooltip=400) rather than 1/9/999/9999.

---

**Avoid**:
- Arbitrary spacing values outside the token scale. Hardcoded `12` should be `tokens.space['3']`.
- Equal spacing everywhere — variety creates hierarchy.
- Hierarchy through size alone — combine size, weight, color, and space.
- Hardcoded safe-area math (`paddingTop: 44` etc.).
- Tap targets under 44pt / 48dp without explicit `hitSlop`.
- Decorative shadows on non-interactive, non-elevated surfaces.
- `shadowOpacity` above 0.16.
