> **Additional context needed**: target adaptation scope — phone-to-tablet, orientation, Dynamic Type, foldables, or a combination.

Adapt an existing React Native screen or component to a new device context: phone to tablet, portrait to landscape, large-text accessibility mode, safe-area variation, or foldable form factor. The trap is treating adaptation as scaling. The job is rethinking the layout for the new context.

There is no `@media` in React Native. There are no CSS breakpoints, no `min-width` queries, no `clamp()`. Responsiveness is imperative: you read window dimensions at runtime, branch on them, and compose layouts accordingly. That shift in mental model is the whole rewrite.

---

## Assess Adaptation Challenge

Before touching code, understand exactly what needs to adapt and why.

**1. Identify the source context**

- What device was this built and tested on? (iPhone 14 Pro? Pixel 7? Both?)
- What assumptions are baked in? (Single column? Portrait lock? Notch not present? No Dynamic Island?)
- What works well and must be preserved?

**2. Identify the target context(s)**

Each dimension is independent. Scope the work clearly — don't fix orientation if only tablet layout was requested.

| Dimension | Signals a problem |
|---|---|
| Phone → Tablet | Single-column layout wastes horizontal space; bottom tab bar extends awkwardly across 11" |
| Portrait → Landscape | Fixed-height hero sections are cropped; keyboard covers entire screen |
| Dynamic Type / font scale | Text overflows containers; truncation cuts critical information; tab labels clip |
| Safe areas | Notch / Dynamic Island / home indicator / punch-hole camera clips content or is unaccounted for |
| Foldables | Layout stretches or breaks when the device unfolds and width doubles mid-session |

**3. Audit the current responsive posture**

Look for these defects:

- `Dimensions.get('window')` called at module level (static snapshot, doesn't update on rotation or fold)
- Hardcoded pixel values used as breakpoints (`if (width === 390)`)
- `paddingTop: 44` or `paddingBottom: 34` hardcoded (breaks on every device that isn't iPhone 13)
- `allowFontScaling={false}` on non-trivial text (accessibility violation)
- No `maxFontSizeMultiplier` on labels that would break layout at 2× scale
- No orientation handling in a screen that is not explicitly locked

**CRITICAL**: Platform parity is a gate, not a suggestion (Constitution Principle IV). A layout that adapts correctly on iPhone and breaks on a Pixel 8 Pro is not adapted. Assess on both platforms before planning.

---

## Plan Adaptation Strategy

Create a scoped plan. Not every screen needs every dimension. Pick the dimensions in scope and design the branch logic for each.

### The responsive hook — `useWindowDimensions()`

This is the RN-native responsive primitive. It replaces `@media`. It re-renders the component when dimensions change (rotation, foldable unfold, split-screen entry). **Always prefer it over the `Dimensions` API**, which returns a static snapshot and will not update.

```ts
// utils/useBreakpoint.ts
import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'phone' | 'tablet';

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  return width >= 768 ? 'tablet' : 'phone';
}

export function useIsTablet(): boolean {
  return useBreakpoint() === 'tablet';
}

export function useIsLandscape(): boolean {
  const { width, height } = useWindowDimensions();
  return width > height;
}
```

Extract this to `utils/useBreakpoint.ts` or alongside `tokens.ts`. The `width >= 768` threshold is the standard RN tablet breakpoint — it covers all iPad sizes in portrait and the Galaxy Tab series. Do not scatter the literal `768` across components; reference the hook.

**Never use `Dimensions.get('window')` for layout branching.** It is a static snapshot. On rotation, or when a foldable unfolds, the component will not re-render with the new size. `useWindowDimensions()` is reactive; `Dimensions.get` is not.

### Phone layouts

- Single column, full-width components
- Bottom tab navigation (`@react-navigation/bottom-tabs`)
- Vertical stack, content scrolls
- `FlatList numColumns={1}`
- Modals presented as full-screen sheets

### Tablet layouts

- Two-column master-detail (list on the left, detail on the right)
- Side navigation drawer in place of bottom tab bar
- `FlatList numColumns={2}` driven by `useBreakpoint()`
- Modals presented as popovers or centered cards (not full-screen)
- Forms in a max-width container centered in the wider canvas

### Orientation

Detect via `useWindowDimensions()` — no separate library needed:

```ts
const { width, height } = useWindowDimensions();
const isLandscape = width > height;
```

Orientation strategy by screen type:

| Screen type | Portrait | Landscape |
|---|---|---|
| Detail / reading | Full width, generous line height | Max-width container, two-column if content allows |
| Form | Full-width inputs | Side-by-side fields if width > 600 |
| Media (camera, video) | 16:9 preview with controls below | Full-bleed; hide non-essential chrome |
| Dashboard | Single-column cards | Two-column grid |

Orientation that is genuinely unsupported should be locked explicitly in `app.json` (`orientation: "portrait"` or `"landscape"`). Do not leave it unlocked and hope users don't rotate.

### Safe areas

Safe areas are not decoration — they are the floor your layout sits on. Every screen edge must compose the safe-area inset with a token step:

```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();

<View style={{
  paddingTop: insets.top + tokens.space['4'],
  paddingBottom: insets.bottom + tokens.space['4'],
  paddingHorizontal: tokens.space['4'],
}}>
```

The inset is the floor, not the total padding. A hardcoded `paddingTop: 44` works on iPhone 13 and fails on iPhone SE (no notch), iPhone 15 Pro (Dynamic Island, different geometry), and every Android device (status bar height is not 44dp).

Platform-specific safe-area anatomy:

| Region | iOS | Android |
|---|---|---|
| Top | Notch (Face ID iPhones) / Dynamic Island (iPhone 14 Pro+) / status bar (older) | Status bar + punch-hole camera inset |
| Bottom | Home indicator (swipe-up iPhones) | Gesture nav bar height (varies by ROM) |
| Sides | Notch on older landscape iPhones | Minimal; varies by device |

For full-screen surfaces (modals, splash, media views), use `<SafeAreaView edges={['top', 'bottom']}>` rather than computing insets manually. See [spatial-design.md](spatial-design.md) for the full pattern and device coverage rationale.

---

## Implement Adaptations

Work dimension by dimension. Keep the branch logic close to the layout — inline `isTablet ? ... : ...` for small divergences, separate layout components for deep structural differences.

### Phone ↔ Tablet layout

**FlatList with adaptive columns:**

```tsx
import { useWindowDimensions, FlatList } from 'react-native';

const { width } = useWindowDimensions();
const numColumns = width >= 768 ? 2 : 1;

<FlatList
  data={items}
  numColumns={numColumns}
  key={numColumns}                          // non-negotiable: forces remount on column flip
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <Card item={item} />}
  contentContainerStyle={{
    padding: tokens.space['4'],
    gap: tokens.space['3'],
  }}
  columnWrapperStyle={numColumns > 1 ? { gap: tokens.space['3'] } : undefined}
/>
```

The `key={numColumns}` prop is mandatory. FlatList caches measurement state per index. Without a key change when `numColumns` flips, it retains stale cell geometry and renders incorrectly. Do not omit it.

**Master-detail on tablet:**

```tsx
import { useIsTablet } from '../utils/useBreakpoint';

function AppNavigator() {
  const isTablet = useIsTablet();

  if (isTablet) {
    return (
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ width: 320, borderRightWidth: StyleSheet.hairlineWidth }}>
          <ListScreen />
        </View>
        <View style={{ flex: 1 }}>
          <DetailScreen />
        </View>
      </View>
    );
  }

  return <StackNavigator />;  // phone: push navigation
}
```

**Navigation shell switch:**

Do not use a bottom tab bar on tablet when the layout has a persistent sidebar column. Bottom tabs on a 12" iPad consume screen real estate without offering the spatial orientation benefit they provide on phone. Replace with a drawer or a persistent side rail.

### Orientation adaptation

```tsx
import { useWindowDimensions } from 'react-native';

function FormScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  return (
    <ScrollView
      contentContainerStyle={{
        flexDirection: isLandscape ? 'row' : 'column',
        gap: tokens.space['4'],
        padding: tokens.space['4'],
      }}
    >
      <View style={isLandscape ? { flex: 1 } : {}}>
        <FieldGroup />
      </View>
      <View style={isLandscape ? { flex: 1 } : {}}>
        <SubmitSection />
      </View>
    </ScrollView>
  );
}
```

Avoid hardcoding screen heights in landscape. The available height in landscape on an iPhone 15 Pro is around 390pt — many "fixed height" hero sections clip entirely. Use `flex: 1` and let the layout fill what's available.

### Dynamic Type (iOS) and font scale (Android)

By default in RN, `allowFontScaling` is `true`. Every `<Text>` respects the user's system font size. **Do not disable it.** Turning off Dynamic Type is an accessibility violation and a common AI tell.

The real work is making layouts survive scale-up:

```tsx
// Tab label that must not break at large text sizes
<Text
  style={tokens.type.label}
  numberOfLines={1}
  ellipsizeMode="tail"
  maxFontSizeMultiplier={1.4}
>
  Settings
</Text>
```

`maxFontSizeMultiplier={1.4}` caps scaling at 140% of the base size — it still respects the user's preference, just within a layout-safe bound. Use it on:

- Tab bar labels
- Tightly-fitted CTA buttons where 2× scale would break the row
- Navigation titles in compact header bars

Do not use it as a blanket setting on all text. Body copy and informational text should scale freely. Capping is for structural labels where the layout genuinely cannot accommodate unconstrained growth.

Test targets:

- **iOS Simulator**: Settings → Accessibility → Display & Text Size → Larger Text → drag to maximum. Or: Simulator → I/O menu → Toggle Larger Accessibility Sizes.
- **Android Emulator**: Settings → Display → Font size → slide to Largest.

Every screen must be walked at maximum scale before adaptation is considered done.

**Layout patterns that survive large text:**

- Use `flex: 1` on text containers instead of fixed widths — text reflows naturally
- Pair `numberOfLines` with `ellipsizeMode="tail"` on single-line labels
- Avoid fixed-height containers around text; use `minHeight` if a floor is needed
- Test rows that contain both an icon and a text label — at 2× scale, the text may wrap while the icon stays fixed, breaking the alignment

See [typography.md](typography.md) for the full Dynamic Type / `maxFontSizeMultiplier` vocabulary and the `PixelRatio.getFontScale()` escape hatch.

### Foldables (Samsung Galaxy Fold, Pixel Fold)

Foldables present a unique adaptation challenge: the device's width can double mid-session when the user unfolds it. Layouts that were sized for a phone suddenly have tablet width and must re-layout without a screen transition.

Because `useWindowDimensions()` is reactive, a component using it will automatically re-render when the window size changes on fold/unfold. The risk is:

- Fixed-width containers that don't respond to the new width
- Absolute-positioned elements sized to the old geometry
- `Dimensions.get('window')` calls that return the stale folded size

**Detection pattern:**

```ts
import { useWindowDimensions } from 'react-native';

// Folded Galaxy Fold 5: ~360pt wide (narrow phone)
// Unfolded Galaxy Fold 5: ~768pt wide (tablet-class)
// Use the standard useBreakpoint() hook — no special foldable API needed
// for layout branching. The width change itself drives the branch.
```

For hinge-aware layouts (placing content on one half of the display, avoiding the crease), use `react-native-device-info` or the `react-native-window-size` package, which surfaces `WindowInfoState` including `foldingFeature`. This is advanced territory — only pursue it if the PRODUCT.md explicitly lists foldables as a target device.

The minimum requirement is that the layout does not break when width doubles. The `useBreakpoint()` hook handles this automatically if all layout branching goes through it.

### Large-text accessibility mode

Large-text mode is distinct from Dynamic Type — it is the accessibility setting, not the default text size preference. At maximum iOS accessibility size, the system font scale can reach 3.1×. At maximum Android font scale, it reaches 2.0×.

Defects that appear at large-text scale:

- Row heights that clip text (fixed `height` on a row containing `<Text>`)
- Tab bar labels that wrap or are cut off
- Buttons whose label overflows their border radius
- Form fields where the label and placeholder overlap
- Lists where item heights vary but `getItemLayout` assumes a fixed height

For each of these, the fix is structural, not cosmetic:

```tsx
// Before: fixed height clips scaled text
<View style={{ height: 56, flexDirection: 'row', alignItems: 'center' }}>
  <Text style={tokens.type.body}>{label}</Text>
</View>

// After: minimum height, allows growth
<View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingVertical: tokens.space['3'] }}>
  <Text style={tokens.type.body}>{label}</Text>
</View>
```

Cross-reference [harden.md](harden.md) for the full large-text defect checklist.

### `Platform.OS` for platform-specific adaptation

`Platform.OS` is valid for affordance differences between iOS and Android — it is not a substitute for responsive layout. Use it for:

- Navigation back behavior (iOS swipe-back vs Android hardware/gesture back)
- Shadow tokens (`shadow*` on iOS, `elevation` on Android)
- `KeyboardAvoidingView` behavior (`'padding'` on iOS, `'height'` on Android)
- Status bar content style

Do not use `Platform.OS` to paper over a layout that only works on one platform. If a layout requires a platform branch, the underlying structure has a problem.

---

## Verify Adaptations

Run verification across every dimension that was in scope. One-platform verification is an incomplete result.

**Breakpoint verification:**

- [ ] Phone layout: iPhone SE (375pt wide — the narrowest commonly used phone)
- [ ] Tablet layout: iPad 9th gen Simulator (768pt wide in portrait) and iPad Pro 12.9" (1024pt)
- [ ] `useBreakpoint()` hook covers both; no `Dimensions.get` calls in layout-branching code

**Orientation verification:**

- [ ] Portrait and landscape both hold on iPhone 15 Pro Simulator
- [ ] Portrait and landscape both hold on Pixel 8 Android Emulator
- [ ] Keyboard-avoidance works in landscape (form inputs remain visible)
- [ ] Hero sections do not clip in landscape; `flex: 1` fills available height

**Safe area verification:**

- [ ] iPhone 15 Pro Simulator (Dynamic Island): content clears the island and home indicator
- [ ] iPhone SE Simulator (no notch): no unnecessary blank space at top
- [ ] Pixel 7 Android Emulator: status bar and gesture nav bar respected
- [ ] No hardcoded `paddingTop: 44` or `paddingBottom: 34` anywhere in scope

**Dynamic Type / font scale verification:**

- [ ] iOS Simulator at maximum Larger Accessibility Text: no overflow, no clipping, no truncation of critical labels
- [ ] Android Emulator at largest Font Size: same checklist
- [ ] `maxFontSizeMultiplier` applied to structural labels (tabs, CTAs); not applied to body / informational text
- [ ] `allowFontScaling={false}` absent except with explicit justification

**Foldable verification (if in scope):**

- [ ] Android Emulator with foldable skin (Galaxy Z Fold 5): unfold triggers re-layout, not stretching
- [ ] No `Dimensions.get` calls in layout paths; all via `useWindowDimensions()`

**Platform parity gate (Constitution Principle IV):**

- [ ] Every adapted screen verified on iOS Simulator AND Android Emulator
- [ ] No adaptation that applies only to one platform without explicit justification

When adaptation holds across all in-scope dimensions on both platforms, hand off to `{{command_prefix}}impeccable-native polish` for the final pass.

**NEVER**:
- Use `Dimensions.get('window')` for layout branching (static, does not update on rotation or fold)
- Hardcode device-specific values as breakpoints (`if (width === 390)`)
- Hardcode safe-area insets (`paddingTop: 44`, `paddingBottom: 34`)
- Set `allowFontScaling={false}` as a fix for layout overflow — fix the layout
- Omit `key={numColumns}` when `FlatList numColumns` changes
- Verify only on iOS and call it done
- Leave orientation unlocked on screens that genuinely only support one orientation
- Use `Platform.OS` to branch layout logic — use `useWindowDimensions()` breakpoints instead
- Reference `responsive-design.md` (web-only file, deleted)
- Use CSS, `@media`, `min-width`, or `clamp()` — none of these exist in React Native
