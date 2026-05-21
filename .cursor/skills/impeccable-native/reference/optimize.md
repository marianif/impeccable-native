Performance is a feature. Identify the actual bottleneck for THIS interface, fix it, then measure. Don't optimize what isn't slow — and don't skip Android. Low-end Android hardware is where most RN performance issues first surface; a Pixel 7a under mild load is a more honest benchmark than an iPhone 15 Pro on a desk.

## Measure First

A measurement baseline is not optional. Optimizing without one is guessing.

**Before any optimization work:**

1. Capture the symptom precisely — dropped frames, slow mount, sluggish scroll, inflated memory? On which platform and device?
2. Record a baseline with the appropriate tool.
3. Fix one thing.
4. Measure again. Compare. Ship the diff only if the numbers moved.

**Profiling toolchain by problem type:**

| Problem | Tool |
|---|---|
| JS thread blocking | React Native DevTools (new arch) or Flipper (old arch) → Performance tab |
| Frame drops on scroll | Systrace on Android; Metal Performance HUD on iOS Simulator (Debug → Color Blended Layers) |
| Re-render hot spots | `why-did-you-render` — add to dev build, read the console noise |
| Custom timing | `react-native-performance` — `performance.mark()` / `performance.measure()` for startup phases, screen mount, data-fetch-to-render |
| Image memory | Android Studio Profiler → Memory; Xcode Instruments → Allocations |
| Bridge call volume (old arch) | Flipper → React Native → Native Calls |

**Architecture context:** if `detect-rn-flavor.mjs` reports `newArch: true`, Fabric + TurboModules remove most bridge serialization costs. Bridge-batching advice below is specifically for old arch projects. Hermes bytecode is on by default in Expo SDK 50+ — don't disable it.

**CRITICAL**: never report that a surface is optimized without before/after measurements on both platforms. Android perf variance is real; iOS numbers don't transfer.

---

## Identify Bottlenecks

After measuring, classify the bottleneck before touching any code. The fix is different for each category.

### Re-render hot paths

The most common RN performance issue and the easiest to fix. Symptoms: React Native DevTools shows components re-rendering far more than their data changes. `why-did-you-render` pinpoints the cause.

**Root causes in order of frequency:**

- **Inline style objects** — `style={{ margin: 8, padding: 16 }}` inside render creates a new object on every render cycle. Defeats `React.memo` on child components. Move to `StyleSheet.create` outside the component body.
- **Inline arrays** — `style={[styles.base, { color }]}` is fine for occasional use. In a `FlatList` `renderItem` that runs hundreds of times, it becomes the bottleneck. Memoize with `useMemo` when the color depends on state; else pre-compute in `StyleSheet.create`.
- **Unstable callback references** — `onPress={() => fn(id)}` in list items creates a new function every render and defeats `React.memo`. Wrap with `useCallback`.
- **Unstable data references** — `data={items.filter(pred)}` passed directly creates a new array on every parent render. Memoize with `useMemo`.
- **Context over-subscription** — a context that holds both color scheme and user session data will re-render every subscriber when either changes. Split into narrower contexts so a theme change doesn't re-render the whole tree.
- **Missing `React.memo`** — pure list item components re-render whenever the parent does. Wrap with `React.memo`; add a custom `areEqual` when props are object-typed.

### FlatList virtualization

FlatList's virtual window is the primary reason long lists are usable at all. Misconfigured, it either re-renders too much or causes visible jank.

**Configuration checklist:**

- **`keyExtractor`** — must be stable, unique, and return a string. Index keys (`(_, i) => String(i)`) break diffing when items are added, removed, or reordered; rows flash or jump. Use item IDs.
- **`getItemLayout`** — provide when row height is fixed. Allows `scrollToIndex` to work and skips layout measurement on mount. Signature: `(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })`.
- **`windowSize`** — default is 21 (10 screen-lengths above + 10 below the viewport). For rows with heavy images or Skia canvases, reduce to 5–7. Lower = less memory; lower = more blank flash when scrolling fast. Tune to the actual row cost.
- **`removeClippedSubviews={true}`** — unmounts off-screen items from the native view hierarchy. On Android, this can cause blank row flashes on rapid scroll; test on a real Android device before shipping it.
- **`initialNumToRender`** — only what actually fits on screen at startup. Default is 10; on a phone with tall rows this is too many. Measure the visible row count and match it.
- **`maxToRenderPerBatch`** + **`updateCellsBatchingPeriod`** — control how many rows render per JS frame and how often. On old arch, reducing `maxToRenderPerBatch` to 5–8 and increasing `updateCellsBatchingPeriod` to 100ms lowers JS thread pressure during fast scroll.

**FlashList** (Shopify) is a drop-in replacement for very long, uniform lists. It recycles native cell views via `recyclingKey` rather than unmounting them, which is significantly faster than FlatList on lists > 500 rows or on low-end Android.

```tsx
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={items}
  renderItem={renderItem}
  estimatedItemSize={72}   // required; calibrate to real row height
  keyExtractor={(item) => item.id}
/>
```

### Image performance

Images are the #1 cause of Android OOM kills on low-end devices (2GB RAM). Two changes cover 90% of image performance issues.

**`expo-image` over React Native's `Image`:** `expo-image` has disk + memory caching, `contentFit` (cover/contain/fill), `recyclingKey` for list reuse, blurhash or thumbhash placeholders, and format negotiation. The raw RN `Image` component has none of this.

```tsx
import { Image } from 'expo-image';

// In a FlatList renderItem:
<Image
  source={{ uri: item.thumbnailUrl }}
  style={styles.thumbnail}
  contentFit="cover"
  recyclingKey={item.id}          // resets the image when the cell is recycled to a new item
  placeholder={item.blurhash}
  transition={150}
/>
```

**Size to display size × device pixel ratio.** Loading a 1200 × 1200 image into a 48 × 48 cell wastes memory on the decode, strains the GPU texture cache, and contributes to OOM pressure on Android. Serve images at the size they're displayed, multiplied by the device pixel ratio (2× or 3×).

**`recyclingKey` is load-bearing in lists.** When a FlatList cell is reused for a different item, `expo-image` without `recyclingKey` may flash the previous item's image. Set it to the item's unique ID.

### JS thread vs UI thread

The JS thread and UI thread are the core mental model for RN animation and interaction performance.

- **The UI thread** runs the native renderer, gestures, and — crucially — Reanimated worklets. Animations on the UI thread are immune to JS thread jank.
- **The JS thread** runs your React code, event handlers, and state updates. A blocked JS thread drops touch events and freezes animations driven from JS.

**Move animations to the UI thread.** Any `Animated.Value` driven by a scroll handler, gesture, or timer on the JS thread is a re-render timebomb. Migrate to Reanimated 3 worklets:

```tsx
// Before: JS-thread scroll handler (drops frames when JS is busy)
const scrollY = useRef(new Animated.Value(0)).current;
<ScrollView onScroll={Animated.event(
  [{ nativeEvent: { contentOffset: { y: scrollY } } }],
  { useNativeDriver: true }
)} />

// After: UI-thread scroll handler via Reanimated (immune to JS jank)
import { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';

const scrollY = useSharedValue(0);
const scrollHandler = useAnimatedScrollHandler({
  onScroll: (e) => { scrollY.value = e.contentOffset.y; },
});
<Animated.ScrollView onScroll={scrollHandler} />
```

**Defer heavy work off the mount path.** Filtering, sorting, or transforming large arrays during component mount stalls the first render. Use `InteractionManager.runAfterInteractions` to defer work until after the screen transition settles:

```tsx
import { InteractionManager } from 'react-native';

useEffect(() => {
  const task = InteractionManager.runAfterInteractions(() => {
    const result = expensiveTransform(rawData);
    setProcessedData(result);
  });
  return () => task.cancel();
}, [rawData]);
```

For long-running computation that can't be deferred (cryptography, large JSON parsing), consider a native module or a JSI-based library rather than blocking the JS thread.

**Never call JS-thread code in a Reanimated worklet.** Worklets run on the UI thread and cannot call most JS APIs. Use `runOnJS` to bridge back to the JS world for side effects (navigation, state updates, analytics), and keep that bridge thin — every `runOnJS` call crosses the thread boundary.

### Old arch: bridge serialization costs

On projects where `newArch: false`, every JS↔native call crosses the async bridge with JSON serialization. This matters in hot paths:

- **Batch native calls.** Instead of one `setNativeProps` per frame, batch updates and apply them in one call.
- **Avoid waterfalls.** A chain of async bridge calls (A waits for B, B waits for C) compounds the serialization cost. Restructure to parallelize where possible.
- **Use `useNativeDriver: true`** on all `Animated` values that animate `transform` and `opacity`. This moves those animations to the native side of the bridge; without it they cross on every frame.

On new arch (Fabric + TurboModules), JSI calls are synchronous and there is no serialization overhead. Bridge-batching advice does not apply; layout recalculations and re-renders are still relevant.

### Memory pressure on Android

Low-end Android devices (2 GB RAM) OOM-kill aggressively when image memory spikes.

- **`expo-image` recycles automatically.** Use it for any image in a list.
- **Cap `ScrollView` usage.** `ScrollView` renders all children at mount and holds them in memory. Use `FlatList` for anything that scrolls more than one screen's worth of content.
- **Avoid large JS arrays in component state when only a slice is displayed.** Keep the full dataset in a ref or a store; put only the rendered slice into state.
- **Unsubscribe everything.** Event listeners, timers, and subscriptions left dangling after unmount accumulate over a session and eventually cause pressure. Clean up in `useEffect` return functions.

---

## Optimize Systematically

Work top-down: re-renders → list configuration → image strategy → thread model → memory.

### Step 1: Eliminate re-render hot paths

```tsx
// Before
function FeedScreen({ userId }) {
  const [feed, setFeed] = useState([]);

  return (
    <FlatList
      data={feed.filter(item => item.visible)}   // new array every render
      renderItem={({ item }) => (
        <FeedRow                                  // new element every render
          item={item}
          onPress={() => openDetail(item.id)}     // new function every render
          style={{ paddingHorizontal: 16 }}       // new object every render
        />
      )}
    />
  );
}

// After
const styles = StyleSheet.create({
  row: { paddingHorizontal: 16 },
});

function FeedScreen({ userId }) {
  const [feed, setFeed] = useState([]);
  const visibleFeed = useMemo(
    () => feed.filter(item => item.visible),
    [feed]
  );
  const handlePress = useCallback((id) => openDetail(id), []);

  return (
    <FlatList
      data={visibleFeed}
      renderItem={({ item }) => (
        <FeedRow
          item={item}
          onPress={handlePress}
          style={styles.row}
        />
      )}
      keyExtractor={(item) => item.id}
    />
  );
}

const FeedRow = React.memo(function FeedRow({ item, onPress, style }) {
  // ...
});
```

### Step 2: Tune FlatList for the actual data shape

```tsx
const ITEM_HEIGHT = 72;

<FlatList
  data={visibleFeed}
  keyExtractor={(item) => item.id}
  renderItem={renderFeedRow}
  getItemLayout={(_, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
  windowSize={7}
  removeClippedSubviews                    // test on Android before shipping
  initialNumToRender={8}
  maxToRenderPerBatch={6}
  updateCellsBatchingPeriod={100}
/>
```

### Step 3: Replace RN `Image` with `expo-image`

```tsx
import { Image } from 'expo-image';

// Replace every instance in list renderItems:
<Image
  source={{ uri: item.coverUrl }}
  style={styles.cover}
  contentFit="cover"
  recyclingKey={item.id}
  placeholder={item.blurhash}
  transition={100}
/>
```

### Step 4: Move scroll-driven animation to the UI thread

See the `useAnimatedScrollHandler` example above. Cross-reference `animate.md` — the JS-thread anti-pattern vocabulary lives there.

### Step 5: Defer deferred work

Wrap any computation that doesn't need to block the initial render in `InteractionManager.runAfterInteractions`. Screen transitions complete before the heavy work starts.

---

## Verify Improvements

**Verify on both platforms. Android perf variance is not covered by iOS numbers (Constitution Principle IV).**

After each optimization:

1. Re-run the same profiling tool used to establish the baseline.
2. Compare JS thread frame budget: was there headroom before the optimization? Is the problem gone?
3. For re-render fixes: confirm with `why-did-you-render` that the hot path no longer fires excessively.
4. For FlatList changes: scroll fast, then scroll back. Look for blank cells, row flash, and jank — especially on Android.
5. For image changes: monitor Android Studio Profiler → Memory over a full scroll pass. Verify memory pressure is flat, not climbing.
6. For thread migrations: profile the UI thread in Systrace. Verify animation frames are consistent and not blocked by JS.

**Test matrix for a performance fix:**

| Test | iOS | Android |
|---|---|---|
| Normal scroll through list | Verify | Verify |
| Fast fling + abrupt stop | Verify | Verify |
| `removeClippedSubviews` blank flash | — | Verify |
| Memory stable over full scroll pass | — | Verify (Android Studio Profiler) |
| Animation under JS load | Verify | Verify |
| Cold start with Hermes | Verify | Verify |

**The fix is not done until both platforms pass.**

---

## Hermes and Startup

Hermes is enabled by default in Expo SDK 50+. No action needed — but verify it hasn't been disabled:

- Expo: `"jsEngine": "hermes"` in `app.json` under `expo`.
- Bare Android: `hermesEnabled=true` in `android/gradle.properties`.
- Bare iOS: `hermes_enabled => true` in `ios/Podfile`.

Hermes precompiles JS to bytecode at build time, which cuts the cold-start JS parse step. Don't disable it to "debug a startup issue" without measuring first; the issue is almost never Hermes.

For startup performance specifically: use `react-native-performance` marks around the critical path (splash hide → first meaningful paint → interactive). Measure before and after any change to the startup path. `InteractionManager.runAfterInteractions` is the standard tool for deferring non-critical startup work past the first meaningful paint.

---

## NEVER

- Optimize without a measurement baseline. Every optimization claim needs a before/after number.
- Disable Hermes to fix a startup issue without measuring whether Hermes is the cause.
- Ship `removeClippedSubviews={true}` without testing on a real Android device — blank-row flash is not visible in the iOS Simulator.
- Use index as `keyExtractor` for mutable lists. Diffing breaks silently; rows flash without obvious cause.
- Load full-resolution images into list thumbnails. Size to display × pixel ratio.
- Drive scroll animations from `setState`. Every scroll frame triggers a re-render; the JS thread cannot keep up.
- Inline styles (`style={{ ... }}`) in `FlatList` `renderItem`. New object per render, every row, every scroll frame.
- Optimize only on iOS. Constitution Principle IV — both platforms, or the optimization is untested.
- Call `runOnJS` in tight loops from worklets. Each call crosses the thread boundary; accumulate side effects and batch the bridge crossing.
- Hold the entire dataset in component state when only a slice is rendered. Keep large arrays in refs or stores; put the slice in state.

---

When the numbers are measurably better on both platforms, hand off to `/impeccable-native polish` for the final pass.
