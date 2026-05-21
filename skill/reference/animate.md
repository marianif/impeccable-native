> **Additional context needed**: target devices and platform fidelity stance.

Add motion that conveys state, gives feedback, and clarifies hierarchy on the device. Cut motion that exists only for decoration. On a phone, animation fatigue compounds faster than on the web — the screen is closer to the face, the surface is smaller, and the user is usually one-handed and interrupted. Spend the motion budget on the moments that need it.

`animate` is the command; [motion-design.md](motion-design.md) is the domain reference. When invoked, **read motion-design.md alongside this file** — durations, spring presets, the 120Hz notes, and the `useReducedMotion()` patterns live there and should not be duplicated. This file routes the work; motion-design.md is the lookup.

---

## Register

Brand: orchestrated screen entrances, staggered list reveals, scroll-driven parallax headers, expressive Skia or shared-element transitions. Motion is part of the voice. One well-rehearsed entrance per screen beats scattered micro-interactions everywhere.

Product: 150–300 ms on most transitions, spring physics on anything that responds to a gesture. Motion conveys state — feedback, reveal, loading, transitions between views. No page-load choreography; users are in a task and won't wait for it. On Android specifically, the motion budget is tighter — render variance is higher and the back-gesture interrupts more often.

---

## Preflight

Before you animate anything, confirm the project's motion vocabulary exists. Otherwise you're guessing at numbers and Reanimated will happily run any garbage you give it.

1. **Run the flavor detector** (`node {{scripts_path}}/detect-rn-flavor.mjs`). You need to know:
   - **New arch vs old arch** — Reanimated 3 requires the new arch for some layout animations; on old arch, fall back to entering/exiting transitions on `Animated.View`.
   - **Expo vs bare** — `expo-haptics`, `expo-blur`, `expo-image` ship out of the box on Expo; bare RN may need each installed and linked.
   - **Router** — `expo-router` has experimental shared-element / view-transitions hooks; `react-navigation` has its own transition specs. The transition shape changes accordingly.
2. **Load context** (`load-context.mjs`). PRODUCT.md tells you the register and platform fidelity stance; DESIGN.md tells you whether `tokens.motion.*` exists. If it doesn't, **stop and add it before animating** — magic numbers in `useAnimatedStyle` calls are how a codebase loses its rhythm.
3. **Verify the dependencies** are at compatible versions: `react-native-reanimated` 3.x, `react-native-gesture-handler` 2.x. Reanimated 2 lacks layout animations, shared element APIs, and the `useReducedMotion()` hook this command depends on.

If any of these are unclear from the codebase, {{ask_instruction}}

**CRITICAL — Constitution Principle IV**: every motion change ships on iOS **and** Android. Animations that "feel great on the sim I'm using" are the most common silent regression in RN. The `cupertino-android-pragmatic` stance does not mean Android motion is allowed to feel worse; it means iOS gets the full taptic vocabulary and Android gets equivalent (sometimes simpler) motion that still feels native. Verify each pass on both before moving on.

---

## Assess Animation Opportunities

Walk the surface with a thumb on a real device (or both simulators side by side) and look for:

1. **Missing feedback** — `Pressable`s, `TouchableOpacity`s, switches, and segmented controls that change state with no acknowledgment. On a 200 ms scale, the absence of pressed feedback reads as broken.
2. **Jarring transitions** — instant mount/unmount on modals, sheets, list inserts, screen pushes. Hard cuts on mobile feel like a crash, not a transition.
3. **Unclear spatial relationships** — where did the new screen come from? Where did the row that was just there go? Shared-element transitions, slide directions, and layout animations exist precisely to answer this on a small screen.
4. **Gesture-bound state without spring** — a sheet that snaps to its rest position with `withTiming` instead of `withSpring` feels mechanical. Anything the user touched and let go of should settle with physics.
5. **Inert hero moments** — a screen-defining headline, a primary CTA, an empty-state illustration that does nothing on mount. One hero entrance per screen is rarely wrong; on brand surfaces it's often expected.

For each opportunity, ask **why this needs motion**. If the answer is "the screen feels static," that's design fatigue, not a brief — go look at the IA before reaching for `withSpring`. Real motion answers a real question: where did this come from, what's happening now, what's coming next.

---

## Plan Motion Strategy

Before writing code, pick the moments. One well-orchestrated set of decisions beats animating everything.

- **Hero moment** — the ONE signature animation per screen. A staggered list entrance, a Skia-driven mark on the empty state, a shared-element transition into a detail view, a parallax header. Pick one; let it own the screen.
- **Feedback layer** — every `Pressable` gets a pressed style (color swap or `withSpring(0.96)` scale). Toggles get a 150 ms color/position interpolation. Selections get a `Haptics.selectionAsync()` pairing.
- **Transition layer** — modals slide+fade, sheets spring, list rows enter via Reanimated layout animations, screen pushes use the router's native transition. Standardize the shape across the app — a bottom sheet here shouldn't become a full-screen modal three screens away.
- **Delight layer** — small, occasional, restrained. A success haptic at the moment of a confirmed action; a single-shot Lottie or Skia flourish at first-time completion; a subtle floating motion on an empty-state illustration. Delight is rare on purpose.

Cross-reference [motion-design.md](motion-design.md) → "Duration: the 100/300/500 Rule" and "Springs: the RN-Native Motion Primitive" for the actual numbers. Don't invent durations or spring configs in this command — consume the tokens.

**IMPORTANT**: brand surfaces tolerate more motion; product surfaces stay quiet. A finance dashboard with parallax headers and confetti on transfer is broken, not delighted.

---

## Implement Animations

Work top-down: hero → transitions → feedback → delight. Each tier sets the timing rhythm for the next.

### Reanimated 3 Fundamentals

Every animation in this skill runs through Reanimated 3 on the UI thread. The pattern:

```tsx
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { tokens } from '@/design/tokens';

function PressScale({ children, onPress }) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPressIn={() => {
          scale.value = reduceMotion ? 1 : withSpring(0.96, tokens.motion.spring.snappy);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, tokens.motion.spring.snappy);
        }}
        onPress={onPress}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
```

Three non-negotiables visible above:

- **Shared values + `useAnimatedStyle`**, never `useState` + `setInterval`. The latter animates on the JS thread and drops frames on cheap Android.
- **Durations and spring configs come from `tokens.motion`**. Inline literals are a finding, not a default.
- **`useReducedMotion()` is the floor**, not an afterthought. Branch the spatial motion (scale, translate, rotate) to a no-op or instant value; keep functional motion (loading, progress).

### Layout Animations

For mount, unmount, and reflow — list inserts, accordion expand, conditional content — Reanimated's declarative layout animations are usually right:

```tsx
import Animated, { FadeInDown, FadeOut, Layout, ReduceMotion } from 'react-native-reanimated';

<Animated.View
  entering={FadeInDown.duration(tokens.motion.duration.normal).reduceMotion(ReduceMotion.System)}
  exiting={FadeOut.duration(tokens.motion.duration.fast).reduceMotion(ReduceMotion.System)}
  layout={Layout.springify().damping(18).stiffness(200)}
>
  {/* ... */}
</Animated.View>
```

- `FadeIn` / `FadeInDown` / `SlideInRight` for mount. Pick the direction that matches where the content came from semantically.
- `FadeOut` / `SlideOutLeft` for unmount. Exits run at ~75% of entrance duration (see motion-design.md).
- `Layout.springify()` for "this view just moved" feedback when neighboring siblings reflow.
- `.reduceMotion(ReduceMotion.System)` on every entrance/exit. Layout animations honor system reduce-motion automatically when wired correctly; without this they don't.

### Gesture-Driven Motion

Anything the user touches and releases should settle with `withSpring`. Compose Reanimated with `react-native-gesture-handler`:

```tsx
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';

function SwipeToDismiss({ onDismiss, children }) {
  const translateX = useSharedValue(0);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > 100) {
        translateX.value = withSpring(e.translationX > 0 ? 400 : -400, tokens.motion.spring.gentle);
        runOnJS(onDismiss)();
      } else {
        translateX.value = withSpring(0, tokens.motion.spring.snappy);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </GestureDetector>
  );
}
```

The handlers run on the UI thread as worklets. `runOnJS` bridges back to the JS world for side effects (navigation, state updates, network) — keep that bridge thin or it becomes the bottleneck.

### Derived Motion

`useDerivedValue` is how you compose: one shared value drives many animated styles, scroll position drives a parallax header, gesture distance drives opacity and scale together.

```tsx
import { useAnimatedScrollHandler, useSharedValue, useDerivedValue, interpolate } from 'react-native-reanimated';

const scrollY = useSharedValue(0);
const headerOpacity = useDerivedValue(() => interpolate(scrollY.value, [0, 80], [0, 1], 'clamp'));
const heroScale = useDerivedValue(() => interpolate(scrollY.value, [-100, 0], [1.2, 1], 'clamp'));

const scrollHandler = useAnimatedScrollHandler({
  onScroll: (e) => {
    scrollY.value = e.contentOffset.y;
  },
});
```

Use `useAnimatedScrollHandler`, never `onScroll` with `setState`. The state path puts every scroll frame on the JS thread.

### Higher-Level: Moti

For routine fade/slide/scale entrances where you don't need full Reanimated control, **Moti** is the right tool:

```tsx
import { MotiView } from 'moti';

<MotiView
  from={{ opacity: 0, translateY: 12 }}
  animate={{ opacity: 1, translateY: 0 }}
  transition={{ type: 'timing', duration: tokens.motion.duration.normal }}
>
  {/* ... */}
</MotiView>
```

Moti sits on top of Reanimated, so the worklet / UI-thread guarantees still apply. Reach for it when the verbosity of `useSharedValue` + `useAnimatedStyle` for a simple fade is the only friction. For gesture-bound or scroll-bound motion, drop to Reanimated directly.

### Canvas-Grade Motion

If the brief calls for shaders, mask reveals, particle systems, or generative marks — **defer to [overdrive.md](overdrive.md)**. `animate` covers the production motion vocabulary (springs, timings, layout animations, gestures, scroll). Skia paths, image filters, runtime shaders, and physics-driven particle systems are overdrive's territory. Mention briefly here, build there.

The boundary: if you can express the motion as a transform / opacity / color / borderRadius animation on a regular `Animated.View`, it lives in `animate`. If it needs `@shopify/react-native-skia`'s `Canvas`, `Path`, `Shader`, or `useClockValue`, it lives in `overdrive`.

### Haptics: Motion's Audio Track

`expo-haptics` is a real design tool on RN. Pair haptics with motion peaks (the moment a sheet starts dismissing, the moment a confirm lands), not with motion ends or every tap:

```tsx
import * as Haptics from 'expo-haptics';

// On primary CTA confirm
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// On selection (picker, segmented control)
Haptics.selectionAsync();

// On gesture peak (sheet snap, swipe commit)
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
```

Android maps most types to a single intensity; iOS gets the full taptic vocabulary. Never iOS-only haptics — silence on Android confirm reads as broken (Constitution Principle IV).

---

## Verify Quality

After each implementation pass, walk the surface on **both** iOS Simulator and Android Emulator. Capture before/after via `node {{scripts_path}}/screenshot.mjs` when changes are visual. Recording is better than screenshots for motion — use the simulator screen recording.

- [ ] Every animation reads durations from `tokens.motion.duration.*` and springs from `tokens.motion.spring.*`. No magic `300`s, no inline `damping: 8` (see motion-design.md "Springs").
- [ ] Every animated component reads `useReducedMotion()` from `react-native-reanimated` and substitutes a snap, crossfade, or skip for spatial motion. Layout animations carry `.reduceMotion(ReduceMotion.System)`.
- [ ] Animations run on the UI thread. No `setState` + `setInterval`, no `setTimeout(..., 16)`, no `onScroll` driving state.
- [ ] Gesture-bound motion uses `withSpring`, not `withTiming`. Anything the user touched and let go of settles with physics.
- [ ] Layout-driving properties (`width`, `height`, `padding`, `margin`, `flex`) are not casually animated. `transform` + `opacity` first; Reanimated layout animations when reflow is genuinely needed.
- [ ] Exit animations run at ~75% of entrance duration. No symmetric in/out timing.
- [ ] No `Easing.bounce`, no `Easing.elastic`, no spring with `damping: 8`. The exception is celebratory micro-moments (success unlock) where the overshoot is the point — and even then the amplitude is small.
- [ ] Hero moment present and singular per screen. Two competing display entrances means neither wins.
- [ ] 120Hz devices hit 120fps. Worklets do this automatically; verify on a ProMotion iPhone or high-refresh Android if available. No hardcoded `scrollEventThrottle={16}` blocking it.
- [ ] Haptics paired with motion peaks (start of dismiss, confirm landing) — not motion ends, not every tap. iOS taptic + Android equivalent both wired.
- [ ] iOS Simulator AND Android Emulator both verified. Android render variance is real; what feels smooth on iOS can stutter on a real Pixel.
- [ ] VoiceOver + TalkBack pass: motion doesn't interfere with screen-reader focus order; entering/exiting animations don't trap focus.
- [ ] Reduce Motion on (iOS Settings → Accessibility → Motion → Reduce Motion; Android Settings → Accessibility → Remove Animations): the surface remains usable, hero motion collapses to instant or crossfade, functional motion stays.

**NEVER**:
- Animate on the JS thread. `setState` + `setInterval` is the canonical anti-pattern; the cheapest device drops frames and you've already lost.
- Animate layout properties (`width`, `height`, `padding`, `margin`, `flex`, `top`, `left`) casually. Use `transform` and `opacity`; reach for Reanimated layout animations when reflow is genuinely required.
- Ship motion verified only on iOS Simulator. Constitution Principle IV — both platforms or it isn't done.
- Use `Easing.bounce` or `Easing.elastic` as a decorative default. Real objects decelerate; they don't overshoot. Overshoot draws attention to the animation, not the content.
- Ignore `useReducedMotion()` on spatial / hero / decorative motion. Vestibular accessibility is the floor; treating it as a polish-pass concern is how you ship motion-sick UIs.
- Hardcode `scrollEventThrottle={16}` or `setTimeout(..., 16)` — these assume 60Hz and break 120Hz timing on ProMotion / high-refresh Android.
- Stack haptics. One haptic per primary moment. Multiple haptics on a single tap is a defect.
- Animate every Pressable on the screen. A confident screen has a few intentional motion moments and a lot of restraint.
- Roll your own spring physics. `withSpring` exists; use it. Hand-tuned cubic-bezier overshoots are the web habit RN doesn't need.
- Reach for Skia to do a fade. If `useAnimatedStyle` over `opacity` covers it, that's the right tool. Skia is for what stock RN can't do — defer to overdrive.md.

---

When the motion clarifies state, settles with physics, respects reduced-motion, and feels equally at home on iPhone and Pixel, hand off to `{{command_prefix}}impeccable-native polish` for the final pass.
