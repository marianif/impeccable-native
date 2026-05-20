# Motion Design

## Duration: The 100/300/500 Rule

Timing matters more than easing. These durations feel right for most mobile UI:

| Duration | Use Case | Examples |
|----------|----------|----------|
| **100–150ms** | Instant feedback | Pressable scale, toggle flip, color change, haptic pairing |
| **200–300ms** | State changes | Tooltip, contextual menu, tab indicator slide |
| **300–500ms** | Layout changes | Accordion expand, bottom sheet present, drawer open |
| **500–800ms** | Entrance animations | Screen push, hero reveal, onboarding slide |

**Exit animations are faster than entrances.** Use ~75% of enter duration. The user has already moved on by the time exit fires; lingering reads as latency.

In tokens, declare durations as numeric ms values:

```ts
motion: {
  duration: { fast: 150, normal: 300, slow: 500 },
}
```

Consume them in Reanimated:

```tsx
import { withTiming, Easing } from 'react-native-reanimated';

opacity.value = withTiming(1, {
  duration: tokens.motion.duration.normal,
  easing: Easing.out(Easing.quart),
});
```

## Easing: Pick the Right Curve

**Don't use `Easing.ease`.** It's a compromise that's rarely optimal. Instead:

| Curve | Use For | Reanimated |
|-------|---------|------------|
| **ease-out** | Elements entering | `Easing.out(Easing.quart)` |
| **ease-in** | Elements leaving | `Easing.in(Easing.quart)` |
| **ease-in-out** | State toggles (there → back) | `Easing.inOut(Easing.quart)` |

**For micro-interactions, use exponential curves.** They feel natural because they mimic real physics (friction, deceleration):

```tsx
import { Easing } from 'react-native-reanimated';

// Quart out — smooth, refined (recommended default)
Easing.out(Easing.quart)

// Quint out — slightly more dramatic
Easing.out(Easing.quint)

// Expo out — snappy, confident
Easing.out(Easing.exp)

// Custom curve (matches the upstream impeccable signature)
Easing.bezier(0.16, 1, 0.3, 1)
```

**Avoid bounce and elastic curves.** Trendy in 2015, tacky now. Real objects don't bounce when they stop — they decelerate smoothly. Overshoot draws attention to the animation itself rather than the content. The exception is celebratory micro-moments (success confirm, achievement unlock) where the overshoot is the point; even then, keep amplitude small.

## Springs: The RN-Native Motion Primitive

Reanimated 3's `withSpring` is more natural than any timing curve for state changes that respond to gesture or "settle into place" — pan-to-dismiss, sheet snap, toggle flip, list reorder. Spring physics is built in; you don't roll your own.

```tsx
import { withSpring } from 'react-native-reanimated';

translateY.value = withSpring(0, {
  damping: 18,        // higher = less oscillation
  stiffness: 200,     // higher = faster
  mass: 1,            // usually leave at 1
  overshootClamping: false,  // true to forbid any overshoot
});
```

Sensible starting configs:

| Feel | damping | stiffness | When |
|------|---------|-----------|------|
| **Snappy** | 20 | 300 | Toggle, tab indicator, small UI |
| **Gentle** | 18 | 180 | Sheet snap, modal present, drawer |
| **Soft** | 25 | 100 | Hero reveals, page-level transitions |
| **Overshoot** | 12 | 250 | Celebratory moments (success, unlock) |

Tune by feel on a real device, not by reading numbers. The same config feels different on a 60Hz Android and a 120Hz ProMotion iPhone.

## 120Hz ProMotion

On iPhone Pro, iPad Pro, and high-refresh Android (most Pixels, recent Samsungs), the display can render up to 120fps. Reanimated worklets run on the UI thread and *will* hit 120fps automatically when the device supports it.

What you control is whether your motion feels alive at that rate. Two things matter:

- **Spring physics scales naturally to 120Hz.** Lower damping ratios (0.7–0.8 of "critically damped" — practically, damping 15–18 on stiffness 200) read as alive on ProMotion without overshooting.
- **Don't cap with artificial frame budgets.** Code like `setTimeout(..., 16)` (assuming 60fps) breaks 120Hz timing. If you need precise timing, use Reanimated's worklet primitives — they're frame-rate-aware.

`withTiming` runs at the device's native rate by default; you don't need to do anything special to opt into 120Hz.

## Premium Motion Materials

`transform` and `opacity` are reliable defaults, not the whole palette. Premium interfaces use:

- **Reanimated `useAnimatedStyle`** — transform / opacity / colors / borderRadius on the UI thread. Default reach.
- **Reanimated layout animations** (`Layout`, `FadeIn`, `FadeOut`, `SlideInRight`, etc.) — for list reorders, mount/unmount transitions, and "this view just moved" feedback. Composable and declarative.
- **`expo-blur` / `@react-native-community/blur`** — native blur (UIVisualEffectView on iOS, RenderEffect on Android API 31+). Use for focus pulls, sheet backdrops, glass overlays. Animate the `intensity` prop directly with a shared value when supported.
- **`@shopify/react-native-skia`** — paths, shaders, image filters, gradients, particle systems, mask reveals. Required for anything that wants to feel beyond stock RN.
- **`MaskedView` (`@react-native-masked-view/masked-view`)** — wipe reveals, gradient masks, image-cropped reveals, the "text-clipped-to-image" effect.
- **`expo-linear-gradient`** — animated gradient position via Reanimated. Used surgically (the gradient-button absolute ban still applies).
- **`expo-haptics`** — haptic feedback paired with motion peaks. A `light` impact on a sheet-dismiss start, a `success` notification at the end of an unlock animation. Haptics are a real design tool RN can use that the web can't.

The hard rule is not "transform and opacity only." The hard rules are:

- Don't animate **layout-driving properties** casually (`width`, `height`, `padding`, `margin`, `flex`). Animate `transform` (translate, scale, rotate) and `opacity` first. Use Reanimated layout animations when you genuinely need the layout to reflow.
- Keep expensive effects (Skia shaders, blur, particle systems) bounded to small or isolated areas. A full-screen Skia surface that re-renders every frame will tank perceived performance even when individual frames are technically fast.
- Verify in-simulator on both iOS and Android. Android's animation rendering is more variable; what feels smooth on iOS Simulator can stutter on a real Android device.

## Staggered Animations

Stagger creates the "this came together intentionally" feel — list items entering 50ms apart, cards in a grid revealing in waves. In Reanimated, stagger via `withDelay`:

```tsx
import { withDelay, withTiming, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

function ListItem({ index, item }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);

  useEffect(() => {
    opacity.value = withDelay(index * 50, withTiming(1, { duration: 300 }));
    translateY.value = withDelay(index * 50, withTiming(0, { duration: 300 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[styles.row, animatedStyle]}>{/* ... */}</Animated.View>;
}
```

For mount-on-render lists, prefer Reanimated's declarative layout animations:

```tsx
import Animated, { FadeInDown } from 'react-native-reanimated';

<Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
  {/* ... */}
</Animated.View>
```

**Cap total stagger time**: 10 items at 50ms = 500ms total. For long lists, reduce per-item delay (e.g. 30ms) or cap the staggered count to the first 8 visible items; everything below the fold can enter without stagger.

## Reduced Motion

This is not optional. Vestibular disorders affect ~35% of adults over 40, and iOS/Android both expose the user's preference.

Use `useReducedMotion` from `react-native-reanimated`:

```tsx
import { useReducedMotion, withTiming, withSpring } from 'react-native-reanimated';

const reduceMotion = useReducedMotion();

// Substitute a fade for a spatial slide
translateY.value = reduceMotion
  ? 0  // skip the slide entirely
  : withSpring(0, { damping: 18, stiffness: 200 });

opacity.value = withTiming(1, { duration: reduceMotion ? 150 : 400 });
```

The two patterns:

- **Substitute a crossfade for a slide.** A modal that slides up becomes a modal that fades in.
- **Shorten or skip non-essential motion.** Decorative entrance animations collapse to instant. Functional motion (loading spinners, progress bars, focus indicators) stays — slowed if needed, but never disabled.

Reanimated layout animations respect `useReducedMotion` automatically when you wire it correctly:

```tsx
import { ReduceMotion, FadeIn } from 'react-native-reanimated';

<Animated.View entering={FadeIn.reduceMotion(ReduceMotion.System)}>
  {/* ... */}
</Animated.View>
```

`ReduceMotion.System` reads the user's setting; `ReduceMotion.Always` forces reduced motion; `ReduceMotion.Never` ignores the setting (only for cases where motion is the content itself, like a tutorial demonstrating a gesture).

## Perceived Performance

**Nobody notices how fast your app is, only how fast it feels.** Perception is design.

**The 80ms threshold**: brains buffer sensory input for ~80ms. Anything under 80ms feels instant. This is your target for micro-interactions — press feedback, toggle flips, tab switches.

**Active vs passive time**: passive waiting (staring at a spinner) feels longer than active engagement. On mobile, where users are often one-handed and interrupted, this matters more than on web. Strategies:

- **Preemptive start.** Begin the transition immediately while data loads. iOS app launch zooms before the app is ready; you can do the same — fade in skeleton content while the real data arrives.
- **Skeleton screens, not spinners.** A spinner shows you're working; a skeleton shows what's coming. The skeleton is structured information; the spinner is dead time.
- **Optimistic UI.** Update the interface immediately, sync later. Instagram likes work offline. Use for low-stakes actions (likes, follows, list reorder). Avoid for payments, deletions, or anything destructive — there, the brief delay signals "real work is happening."
- **Haptic pairing.** A `light` impact at the exact frame a transition starts makes the transition feel like a response, not a wait. Pair haptics with motion peaks, not motion ends.

**Easing affects perceived duration.** Ease-out (decelerating) feels satisfying for entrances. Ease-in (accelerating toward completion) makes a task feel shorter because the peak-end effect weights final moments heavily — useful for the moment just before a screen transitions away.

**Caution**: too-fast can feel cheap. Users may distrust instant results for complex operations (AI generation, search, calculation). A 400ms minimum, with motion that signals "thinking," sometimes outperforms an instant result.

## Performance

Mobile animation cost is different from web. Two practical rules:

- **Animate on the UI thread.** Reanimated 3 worklets run on the native UI thread; standard React state changes do not. If you find yourself driving an animation with `useState` + `setInterval`, you're animating on the JS thread, the cheapest device will drop frames, and you've already lost. Always reach for `useSharedValue` + `useAnimatedStyle`.
- **Beware re-rendering parents during animation.** If a parent component re-renders while a child animation is running, the child re-mounts and the animation restarts. Memoize animated subtrees (`React.memo`) when they're inside frequently-rerendering parents.

For scroll-driven animations (parallax headers, sticky transforms, scroll-into-view reveals), use `useAnimatedScrollHandler` from Reanimated, not `onScroll` with state updates:

```tsx
import { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

const scrollY = useSharedValue(0);
const scrollHandler = useAnimatedScrollHandler({
  onScroll: (e) => { scrollY.value = e.contentOffset.y; },
});

<Animated.ScrollView onScroll={scrollHandler} scrollEventThrottle={16}>
  {/* ... */}
</Animated.ScrollView>
```

`scrollEventThrottle={16}` is right for 60Hz; on 120Hz devices Reanimated drives the handler at native rate regardless.

Define motion tokens for consistency:

```ts
motion: {
  duration: { fast: 150, normal: 300, slow: 500 },
  // Easing values live in code (Easing.out(Easing.quart)) — tokens carry intent, not the function reference
}
```

---

**Avoid**:
- Animating everything (animation fatigue is real).
- `setTimeout` or `setInterval` to drive animations — use Reanimated worklets.
- Animating layout-driving properties (`width`, `height`, `padding`, `margin`) casually.
- Bounce / elastic easing as a decorative default.
- Decorative motion that ignores `useReducedMotion`.
- JS-thread animations (`useState` + setInterval) — they drop frames on cheap Android devices.
- `setNativeProps` on transforms — use shared values.
- Capping animation timing with hardcoded 16ms / 60Hz assumptions on devices that support 120Hz.
