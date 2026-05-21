Space is the most underused design tool on mobile. Find the layout's actual problem — monotone spacing, weak hierarchy, identical card grids, no navigation structure — and fix the structure, not the surface.

---

## Register

Brand: asymmetric compositions, deliberate rhythm, layout-breaking moments for emphasis. Tight groupings paired with generous separations. The grid exists to be broken with intention.

Product: predictable grids, consistent densities, familiar navigation shells. Adaptive behavior is structural (phone-to-tablet column expansion, orientation lock). Consistency IS an affordance.

---

## Assess Current Layout

Before touching anything, diagnose the actual problem. Misdiagnosing layout problems leads to cosmetic fixes over structural rot.

1. **Navigation shell**: which shell is in use — stack, tab, drawer, or a composition? Does it match what the content demands? A modal stack where bottom tabs would surface equal-weight destinations is a structural miss, not a visual one.

2. **Spacing and rhythm**:
   - Is spacing consistent, or are there arbitrary values outside the token scale?
   - Is all spacing equal? Equal padding everywhere means no rhythm — related elements should be grouped tightly, groups separated generously.
   - Do sibling spacings use `gap` (RN ≥ 0.71) or a consistent `marginBottom` pattern?

3. **Visual hierarchy** — run the squint test (see [spatial-design.md](spatial-design.md)): blur your vision or screenshot and apply 4px Gaussian blur. Can you still identify the primary action, the most important content, and clear groupings? If everything looks flat, the hierarchy problem is spatial before it is typographic.

4. **List choice**: is the right scroll primitive in use?
   - `ScrollView` for short, static content
   - `FlatList` for long, uniform lists
   - `SectionList` for grouped lists
   - `FlashList` for performance-critical lists (1000+ items, fast scroll)
   - Nested `ScrollView`s without `nestedScrollEnabled` will silently eat gestures

5. **Touch targets**: are pressable areas ≥ 44pt on iOS / 48dp on Android? Visual size and tap size are independent — check both.

6. **Safe area handling**: are screens hardcoding inset values (`paddingTop: 44`) or composing correctly with `useSafeAreaInsets()`?

**CRITICAL**: platform parity is a gate, not a suggestion. A layout that looks correct on iOS Simulator and broken on Android Emulator has not been assessed. Run both before planning.

---

## Plan Layout Improvements

Consult [spatial-design.md](spatial-design.md) for the spacing scale, Yoga flexbox rules, safe area composition, touch target patterns, and depth/elevation guidance. Do not duplicate that content here — cross-reference and apply it.

Create a plan across four axes:

- **Spacing system**: all values from `tokens.space.*`. The step name (`tokens.space['4']`) is more meaningful than the raw number (`16`).
- **Hierarchy strategy**: how will space, size, weight, and position communicate importance? Pick 2–3 dimensions in combination — space alone can be enough for strong hierarchy.
- **Layout structure**: which Yoga flex composition fits the content? Column stacks for screens, row arrangements for toolbars and list rows. No `display: grid` — use nested flexes or `FlatList numColumns` for grid-shaped layouts.
- **Scroll primitive and navigation shell**: confirm the right choice for the content's length and grouping; confirm the navigation shell matches the information architecture.

---

## Implement Layout Improvements

### Yoga Flexbox Fundamentals

RN uses Yoga, a flexbox implementation with two divergences from web that will bite you if you forget them:

- **`flexDirection` defaults to `'column'`**, not `'row'`. Most screens are column flexes without declaring it. Row arrangements require explicit `flexDirection: 'row'`.
- **No `display: grid`**. Grid-shaped layouts use nested flex containers or `FlatList numColumns`. For masonry / uneven 2D, `react-native-masonry-list` is the standard library.
- **No `position: sticky`**. Sticky headers live inside `FlatList` / `SectionList` via `stickyHeaderIndices` or `renderSectionHeader`, not CSS positioning.
- **`gap` requires RN ≥ 0.71**. On older versions, fall back to `marginBottom` per child. Always check `detect-rn-flavor.mjs` `rnVersion`. See [spatial-design.md](spatial-design.md) for the fallback pattern.

```tsx
// Yoga column stack — the default screen shape
<View style={{ flex: 1, gap: tokens.space['4'] }}>
  <Header />
  <Content />
  <Footer />
</View>

// Explicit row — toolbar, list row, button group
<View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['2'] }}>
  <Icon size={20} />
  <Text style={tokens.type.body}>{label}</Text>
  <Chevron />
</View>
```

### Scroll Primitive Decision Tree

Choose the right primitive before writing any scroll container. Swapping later is disruptive.

```
Content length + structure
├── Short / static (< ~20 items, no virtualization needed)
│   └── ScrollView
│       └── Never nest ScrollViews without nestedScrollEnabled={true}
│           on the inner one (and even then, prefer alternatives)
├── Long / uniform items
│   └── FlatList  ← default choice for any dynamic list
├── Long / grouped items (sections with headers)
│   └── SectionList
└── Performance-critical (1000+ items, fast scroll, animation-adjacent)
    └── FlashList (@shopify/flash-list)
        └── Must provide estimatedItemSize; keyExtractor mandatory
```

**FlatList minimum correct setup**:

```tsx
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <Row item={item} />}
  contentContainerStyle={{
    padding: tokens.space['4'],
    gap: tokens.space['2'],      // RN >= 0.71
  }}
  removeClippedSubviews          // reclaim memory off-screen
  windowSize={10}                // default 21 is too large for most lists
  initialNumToRender={12}        // match visible viewport
/>
```

For tablet-adaptive multi-column lists, drive `numColumns` from `useWindowDimensions()` and always change the `key` prop when it flips — FlatList caches measurement state per index. Full pattern in [spatial-design.md](spatial-design.md).

**Never nest a ScrollView inside a FlatList** (or vice versa) without explicit `nestedScrollEnabled`. The outer scroll container captures gestures and the inner one becomes unscrollable. When you need a scrollable header above a list, use `FlatList` `ListHeaderComponent` — not a ScrollView wrapping a FlatList.

### Safe Area Composition

Every screen edge composes the inset with a token step. The inset is the floor, not the total padding.

```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();

<View style={{
  paddingTop: insets.top + tokens.space['4'],
  paddingBottom: insets.bottom + tokens.space['6'],
  paddingHorizontal: tokens.space['4'],
}}>
```

For full-screen surfaces (modals, sheets, splash), use `<SafeAreaView edges={['top', 'bottom']}>` instead of computing manually. Hardcoding `paddingTop: 44` is a finding — it works on one device and breaks on the rest. See [spatial-design.md](spatial-design.md) for the full safe-area pattern and device coverage rationale.

### Touch Targets

Visual size and tap size are independent. Icons can look 20pt; the pressable area must be ≥ 44pt (iOS) / 48dp (Android). Two patterns — use whichever fits the surrounding layout:

**Padding to grow the touch area** (preferred when layout allows):

```tsx
<Pressable
  onPress={onPress}
  style={({ pressed }) => ({
    padding: tokens.space['3'],   // 12pt × 4 = 48pt minimum
    opacity: pressed ? 0.7 : 1,
  })}
  accessibilityRole="button"
  accessibilityLabel="Close"
>
  <CloseIcon size={24} />
</Pressable>
```

**`hitSlop` when padding would distort the layout** (tight headers, inline chevrons):

```tsx
<Pressable
  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
  onPress={onPress}
  accessibilityRole="button"
>
  <ChevronRight size={16} />
</Pressable>
```

Do not use `hitSlop` to rescue a button that is visually too small. Fix the visual size first, reach for `hitSlop` only when the tap zone cannot grow visually.

### Navigation Shell Composition

The navigation shell is part of the layout. Getting the shell wrong means the layout will fight every screen built inside it.

**Stack navigator** — sequential flows: onboarding, settings detail, drill-down content. Each screen pushes onto a stack; swipe-back is the natural back gesture on iOS. On Android, hardware/gesture back must be wired correctly — every modal and bottom sheet needs a `BackHandler` or the system back will do the wrong thing.

**Bottom tab navigator** — equal-weight top-level destinations (max 5 tabs). Use when destinations are coordinate, not hierarchical. Never replace bottom tabs with a hamburger menu when 5 or fewer items fit. The thumb lives at the bottom of the screen; hiding navigation behind a top-left control defeats mobile ergonomics.

**Drawer navigator** — secondary navigation for deep settings trees, multi-account switching, or contextual panels. Not a replacement for bottom tabs on the main navigation. Drawer-as-primary-nav is an anti-pattern — it hides structure.

**Bottom sheets** — for secondary actions, contextual menus, confirmation flows, and any action that doesn't warrant a full-screen push. Use `@gorhom/bottom-sheet`:

```tsx
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

const snapPoints = useMemo(() => ['40%', '80%'], []);

<BottomSheet
  ref={bottomSheetRef}
  index={-1}                     // -1 = closed
  snapPoints={snapPoints}
  enablePanDownToClose
  backgroundStyle={{ backgroundColor: tokens.color.surface }}
>
  <BottomSheetView style={{ padding: tokens.space['4'] }}>
    {/* content */}
  </BottomSheetView>
</BottomSheet>
```

Three snap points is usually one too many. Start with one (action height) or two (compact / expanded). Every sheet needs three ways to close: swipe down, tap the scrim, and Android system back. See [interaction-design.md](interaction-design.md) for the full sheet/modal hierarchy decision tree.

**Never use a bottom sheet for every secondary action.** It is the mobile equivalent of the modal-as-first-thought anti-pattern. Inline expansion, context menus (`UIContextMenuInteraction` via `Pressable` `onLongPress`), and sheet-on-explicit-tap are different tools — use the right one.

### Spacing Rhythm

Apply the 4pt scale from `tokens.space` to build rhythm through contrast — tight groupings inside sections, generous gaps between them.

```tsx
// Section with internal tight grouping, generous external separation
<View style={{ marginBottom: tokens.space['8'] }}>        {/* 32pt between sections */}
  <Text style={tokens.type.label}>Recent</Text>
  <View style={{ marginTop: tokens.space['2'], gap: tokens.space['2'] }}>  {/* 8pt between rows */}
    {items.map((item) => <Row key={item.id} item={item} />)}
  </View>
</View>
```

Avoid equal spacing everywhere. Equal padding on every element removes rhythm. The visual beat comes from alternating tight and generous spacing — see [spatial-design.md](spatial-design.md) for the full hierarchy-through-spacing model.

### Grid Layouts (No `display: grid`)

For card grids on tablet or multi-column feature layouts, compose with `FlatList numColumns` or nested flex with `flexWrap`:

```tsx
// Flex wrap grid — static content, known item count
<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['3'] }}>
  {items.map((item) => (
    <View
      key={item.id}
      style={{ width: (screenWidth - tokens.space['4'] * 2 - tokens.space['3']) / 2 }}
    >
      <Card item={item} />
    </View>
  ))}
</View>

// FlatList numColumns — dynamic, virtualized
// Full pattern: see spatial-design.md "The Self-Adjusting List"
```

`flexWrap` works for static grids. For long lists, `FlatList numColumns` is mandatory — `flexWrap` on a long list defeats virtualization.

### Breaking Card Grid Monotony

A `FlatList` of identical card components with icon + title + subtitle is an absolute ban (SKILL.md). Before reaching for a card:

- Can spacing and alignment group the content naturally?
- Would list rows with swipe actions provide clearer affordance?
- Is the content genuinely distinct and tappable as a single unit?

Use a card only when content needs an explicit interaction boundary. Never nest cards inside cards — use `StyleSheet.hairlineWidth` dividers (`borderTopWidth: StyleSheet.hairlineWidth`) for hierarchy within a card. Vary card sizes, break rows with featured items, or mix card and row layouts to avoid identical-grid monotony.

### Depth and Elevation

Shadows are platform-split. iOS uses `shadow*` props; Android uses `elevation`. Pair them in tokens and apply with `Platform.OS`. Full token pattern in [spatial-design.md](spatial-design.md).

Two rules: flat by default (reach for shadow only on interactive, elevated, or backdrop-separated surfaces), and low alpha (`shadowOpacity` stays below 0.16). Higher reads as 2014 Material Design. Avoid arbitrary `zIndex` — when you need it, use the semantic scale in `tokens` (modal=100, sheet=200, toast=300, tooltip=400).

---

## Verify Layout Improvements

Run both platforms before considering the layout done. A single-platform verify is a partial result.

- **Squint test**: screenshot the screen and blur it mentally (or literally). Can you identify primary action, most important content, and clear groupings?
- **Rhythm**: does the layout have a satisfying beat of tight and generous spacing?
- **Touch targets**: tap every interactive element. Does it register without hunting? Check with one thumb, not a mouse.
- **Safe areas**: test on a device or simulator with a notch/Dynamic Island (iPhone 15 Pro sim) AND one without (iPhone SE). Test on Android with status bar of varying height (Pixel 7 sim). Hardcoded insets will fail visibly.
- **Scroll primitives**: scroll every list to its end. No gesture conflicts, no swallowed touches. Check `nestedScrollEnabled` on any nested scroll.
- **Navigation shell**: test the Android back gesture and hardware back button on every sheet, modal, and push screen. Back must always do the right thing.
- **Tablet / orientation** (if in scope): run on an iPad or large-screen Android simulator. Check landscape orientation if not locked.
- **Dynamic Type 2×**: enable large accessibility text. Nothing clips, truncates unexpectedly, or overlaps.
- **Token discipline**: no raw pixel numbers in spacing, no hardcoded `paddingTop: 44`, no `gap` on RN < 0.71 without a fallback.

When rhythm and hierarchy land on both platforms, hand off to `/impeccable-native polish` for the final pass.

**NEVER**:
- Use arbitrary spacing values outside `tokens.space`
- Hardcode safe-area insets (`paddingTop: 44`, `paddingBottom: 34`)
- Nest `ScrollView` inside `FlatList` (or vice versa) without `nestedScrollEnabled`
- Use `ScrollView` for lists that may grow long — virtualization is not optional at scale
- Forget `key={numColumns}` when flipping `FlatList numColumns`
- Default to bottom sheets for every secondary action (bottom-sheet-for-everything is an anti-pattern)
- Use a drawer or hamburger menu when bottom tabs fit 5 or fewer items
- Apply `gap` without checking `rnVersion` against 0.71
- Use `flexWrap` for long dynamic lists — use `FlatList numColumns`
- Verify only on iOS and consider the layout done (Constitution Principle IV)
