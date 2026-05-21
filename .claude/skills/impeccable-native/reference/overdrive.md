Start your response with:

```
──────────── ⚡ OVERDRIVE ─────────────
》》》 Entering overdrive mode...
```

Push a React Native interface past what stock RN can express. This isn't decoration — it's using Skia canvases, UI-thread worklets, composed gesture chains, native blur, shared element transitions, and haptic choreography to make a moment in an app feel extraordinary. A Skia particle burst on a creative portfolio is impressive. The same particle burst on a settings screen is embarrassing. A settings screen with a physics-spring sheet that snaps with a tactile impact and a BlurView backdrop that deepens as the sheet rises? That's extraordinary. Understand the project, its register, and its users before choosing a technique.

**EXTRA IMPORTANT FOR THIS COMMAND**: The boundary between `animate` and `overdrive` is load-bearing. If `useAnimatedStyle` over `transform` / `opacity` / `color` / `borderRadius` on a regular `Animated.View` covers what you need, **stop and use `animate`**. Overdrive starts the moment `@shopify/react-native-skia`'s `Canvas`, `Path`, `Shader`, or `useClockValue` enter the picture, or when effects require gesture composition (pan + pinch + rotation in the same recognizer chain) together with Skia, or when shared-element transitions, native blur orchestration, or haptic choreography are the point of the effect.

---

## Propose Before Building

This command has the highest potential to misfire. A technically ambitious effect that lands in the wrong register wastes hours and has to be thrown away. You **must**:

1. **Think through 2–3 radically different directions.** Each direction should represent a different aesthetic bet, ambition level, and technique set. For each, describe what it looks and feels like to a user holding a phone, not what APIs it uses.
2. **STOP and call the AskUserQuestion tool to clarify.** to present these directions and get explicit user approval before writing any code. For each direction, name the trade-offs: performance cost on mid-tier Android, dependency weight, fallback quality when reduced motion is on, and which register it fits.
3. **Only proceed with the direction the user confirms.** No partial starts. No "I'll just sketch the Skia layer while waiting."

Skipping this step is how you build something technically correct and experientially wrong. The proposal gate is the command's identity — it cannot be compressed.

---

## Preflight

Run these before any implementation:

1. **Flavor detector**: `node .claude/skills/impeccable-native/scripts/detect-rn-flavor.mjs`. You need:
   - **New arch vs old arch** — Skia and Reanimated 3 worklets both require new arch for the full feature set. On old arch, some Skia `useClockValue` / `useComputedValue` APIs may behave differently; verify before relying on them.
   - **Expo vs bare** — `expo-haptics`, `expo-blur`, `expo-image` ship out of the box on Expo; bare RN requires install + link. Confirm before reaching for them.
   - **Router** — `expo-router` (v3+) has experimental shared-element support; `react-navigation` uses `react-native-shared-element`. The implementation shape diverges completely.
2. **Load context** (`load-context.mjs`). PRODUCT.md tells you the register. DESIGN.md tells you whether `tokens.motion.*` exists. Overdrive effects that don't consume the project's motion tokens introduce timing drift — stop and add the tokens first.
3. **Verify dependencies** are compatible: `@shopify/react-native-skia` 1.x, `react-native-reanimated` 3.x, `react-native-gesture-handler` 2.x, `expo-haptics` (if Expo), `expo-blur` or `@react-native-community/blur` (platform), `@react-native-masked-view/masked-view` if MaskedView is planned.
4. **Constitution Principle IV**: every overdrive effect ships on iOS **and** Android. Skia is cross-platform; Reanimated worklets run on Android's UI thread. BlurView has platform differences. Haptics map differently on Android. None of these are reasons to skip Android — they're implementation details to solve. An overdrive effect that only works on iOS is a bug.

If anything is unclear from the codebase, STOP and call the AskUserQuestion tool to clarify.

---

## Assess What "Extraordinary" Means Here

Before choosing a technique, ask: **what would make a user of THIS specific interface say "that's unlike any other app I've used"?**

### For brand / marketing surfaces
Hero sections, onboarding, portfolio screens, empty states, achievement moments: the "wow" is sensory. A Skia path that traces the brand mark on first launch. A particle system that disperses when a streak is earned. A runtime shader that breathes as the user scrolls. Generative Skia art that responds to a pan gesture. The ambition is visible.

### For functional product UI
Tables, forms, modals, navigation: the "wow" is in how it settles. A modal that morphs from its trigger via a shared element transition. A pinch-to-expand gesture on a card that feels like fluid physics. A bottom sheet with a native BlurView backdrop that deepens in real time as it rises. A MaskedView reveal that wipes content into frame as a gesture completes. The ambition is felt, not seen.

### For performance-critical UI
The "wow" is invisible but physical. A search surface that processes 50k items without touching the JS thread. A canvas-rendered list that renders row-level animations at 120fps. The interface never hesitates; it never drops a frame. The achievement is that the effect exists at all at this scale.

### For haptic choreography
RN can do something the web fundamentally cannot: deliver precise physical feedback at sub-frame timing. A confirmation that fires a `Success` notification haptic at the exact frame a checkmark animates in. A gesture that fires `Medium` impact at the moment of threshold snap. Haptics are the soundtrack to the visual — choreograph them, don't sprinkle them.

**The common thread**: the effect does something the user did not believe an app could do. The technique serves the experience. Technical ambition that makes the interface harder to use is a failure, not a flex.

---

## The Toolkit

Organized by what you're trying to achieve, not by API name.

### Skia canvas: draw beyond RN's component model

`@shopify/react-native-skia` gives you a GPU-accelerated `Canvas` component that renders Skia paths, paints, shaders, and image filters natively. It runs on the UI thread via Reanimated integration.

**Paths and procedural drawing**: generate brand marks, loaders, progress rings, or generative art that stock `View` cannot express.

```tsx
import { Canvas, Path, Skia, useClockValue, useComputedValue } from '@shopify/react-native-skia';

function PulseRing({ size }: { size: number }) {
  const clock = useClockValue();
  const radius = useComputedValue(() => {
    return 40 + Math.sin(clock.current / 400) * 10;
  }, [clock]);

  const path = useComputedValue(() => {
    const p = Skia.Path.Make();
    p.addCircle(size / 2, size / 2, radius.current);
    return p;
  }, [radius]);

  return (
    <Canvas style={{ width: size, height: size }}>
      <Path path={path} color="rgba(99, 102, 241, 0.6)" style="stroke" strokeWidth={2} />
    </Canvas>
  );
}
```

**Image filters**: blur, color matrices, displacement maps. For effects that CSS `filter` approximated poorly and WebGL was overkill for.

**Runtime shaders**: SKSL (Skia Shading Language) programs that execute per-pixel on the GPU. For gradient meshes, noise textures, distortion fields, and animated material effects.

```tsx
import { Canvas, Shader, Skia, Fill, useClockValue, useComputedValue } from '@shopify/react-native-skia';

const shaderSource = Skia.RuntimeEffect.Make(`
  uniform float time;
  uniform vec2 resolution;

  half4 main(vec2 fragCoord) {
    vec2 uv = fragCoord / resolution;
    float noise = sin(uv.x * 6.0 + time) * sin(uv.y * 6.0 + time * 0.7);
    return mix(half4(0.38, 0.4, 0.95, 1.0), half4(0.12, 0.14, 0.6, 1.0), noise * 0.5 + 0.5);
  }
`)!;

function AnimatedShaderBackground({ width, height }: { width: number; height: number }) {
  const clock = useClockValue();
  const uniforms = useComputedValue(() => ({
    time: clock.current / 1000,
    resolution: [width, height],
  }), [clock]);

  return (
    <Canvas style={{ width, height }}>
      <Fill>
        <Shader source={shaderSource} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
}
```

**Particle systems**: arrays of Skia paths or circles driven by `useClockValue` + physics math. For celebration moments, empty-state delight, generative backgrounds. Keep particle count bounded — benchmark on a mid-tier Android (Pixel 5a, not Pixel 9 Pro).

**Boundary**: Skia is for what RN's component model cannot do. Don't reach for `Canvas` to do a fade or a scale; `animate.md` covers that. Reach for it when the visual effect is fundamentally a drawing problem, not a layout problem.

### Reanimated worklets on the UI thread

Overdrive-grade effects require every computation to stay off the JS thread. All shared values, derived values, and gesture handlers must run as UI-thread worklets. The pattern from `animate.md` still applies — `useSharedValue` + `useAnimatedStyle` — but here the chains are deeper and the values are more compositional.

**`useDerivedValue` chains**: compose one gesture's output into a Skia uniform, a blur intensity, and a haptic threshold simultaneously.

```tsx
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';

const dragY = useSharedValue(0);

// All derived on the UI thread — no JS bridge crossings during gesture
const blurIntensity = useDerivedValue(() =>
  interpolate(dragY.value, [0, 300], [0, 20], 'clamp')
);
const cardScale = useDerivedValue(() =>
  interpolate(dragY.value, [0, 300], [1, 0.92], 'clamp')
);
const hapticThresholdCrossed = useDerivedValue(() =>
  dragY.value > 150
);
```

**`useClockValue` + Skia**: the clock drives shader uniforms and path computations entirely on the UI thread. No `useEffect` + `setInterval`, no `requestAnimationFrame` bridges.

**`runOnJS` is the narrow bridge**: call it only for side effects (navigation, state commits, network actions) and only when the gesture resolves — not on every frame.

### Gesture Handler composition

`react-native-gesture-handler` v2's composable gesture API lets you chain pan, pinch, and rotation recognizers in a single `GestureDetector`, sharing output values to drive a single animated effect.

```tsx
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

function PinchableCard({ onDismiss, children }) {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedRotation = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 0.5) {
        scale.value = withSpring(0, {}, () => runOnJS(onDismiss)());
      } else {
        scale.value = withSpring(1, { damping: 18, stiffness: 200 });
        savedScale.value = 1;
      }
    });

  const rotate = Gesture.Rotation()
    .onUpdate((e) => {
      rotation.value = savedRotation.value + e.rotation;
    })
    .onEnd(() => {
      savedRotation.value = rotation.value;
      rotation.value = withSpring(0, { damping: 14, stiffness: 120 });
      savedRotation.value = 0;
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd(() => {
      translateX.value = withSpring(0, { damping: 18, stiffness: 200 });
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
    });

  const composed = Gesture.Simultaneous(pinch, rotate, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotateZ: `${rotation.value}rad` },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </GestureDetector>
  );
}
```

Use `Gesture.Simultaneous()` for effects that should activate together (pinch + rotate on an image). Use `Gesture.Exclusive()` when only one recognizer should win per gesture (pan vs swipe-to-dismiss). Use `Gesture.Race()` when the first gesture to pass its threshold takes over.

### MaskedView

`@react-native-masked-view/masked-view` clips any React Native view tree to the shape defined by a mask element. Use for gradient-edge list fades, wipe reveals driven by a gesture shared value, text clipped to an image background, and animated content reveals.

```tsx
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

// Gradient mask that fades list edges — no JS, no Skia required
function FadedScrollEdges({ children }) {
  return (
    <MaskedView
      style={{ flex: 1 }}
      maskElement={
        <LinearGradient
          colors={['transparent', 'black', 'black', 'transparent']}
          locations={[0, 0.08, 0.92, 1]}
          style={{ flex: 1 }}
        />
      }
    >
      {children}
    </MaskedView>
  );
}
```

For gesture-driven wipe reveals, drive a mask `View`'s `width` or `height` via a Reanimated shared value — the mask clips the content as the gesture progresses.

### Native BlurView

`expo-blur` (Expo) or `@react-native-community/blur` (bare) renders a native `UIVisualEffectView` blur on iOS and a `RenderEffect` blur on Android API 31+. This is a real material — not a fake CSS `backdrop-filter`.

```tsx
import { BlurView } from 'expo-blur';

// Sheet backdrop that deepens as the sheet rises
function SheetBackdrop({ progress }: { progress: Animated.SharedValue<number> }) {
  // intensity must be driven as a prop, not useAnimatedStyle — BlurView takes intensity as a number prop
  // Use a state bridge only when animation is complete; for real-time blur, use @react-native-community/blur with Animated.View wrapper
  return (
    <BlurView
      intensity={40}
      tint="dark"
      style={StyleSheet.absoluteFill}
    />
  );
}
```

For real-time animated blur intensity, `@react-native-community/blur` wraps as an `Animated.createAnimatedComponent`. Animate `blurRadius` via a shared value bridge. Keep blur regions bounded — a full-screen `BlurView` over a scrolling `FlatList` is a frame-rate trap on most Android devices.

On Android < API 31: `BlurView` falls back to a semi-transparent overlay or a pre-blurred image. Always provide a graceful fallback.

### Shared element transitions

Shared element transitions animate a specific visual element (an image, a card, a title) from its position and size in one screen to its position and size in another. The result feels like the user is drilling into the thing they tapped, not navigating to a new location.

**With expo-router (v3+ experimental)**:

```tsx
// In the list item — tag the element with a shared transition tag
import { useLocalSearchParams } from 'expo-router';

// List screen
<Animated.Image
  source={{ uri: item.image }}
  sharedTransitionTag={`photo-${item.id}`}
  style={styles.thumbnail}
/>

// Detail screen
<Animated.Image
  source={{ uri: item.image }}
  sharedTransitionTag={`photo-${item.id}`}
  style={styles.hero}
/>
```

**With react-native-shared-element (react-navigation)**:

```tsx
import { SharedElement } from 'react-native-shared-element';
import { createSharedElementStackNavigator } from 'react-navigation-shared-element';

// List screen
<SharedElement id={`photo.${item.id}`}>
  <Image source={{ uri: item.image }} style={styles.thumbnail} />
</SharedElement>

// Detail screen
<SharedElement id={`photo.${item.id}`}>
  <Image source={{ uri: item.image }} style={styles.hero} />
</SharedElement>
```

Apply shared element transitions to elements with clear spatial identity: hero images, card faces, list avatars, title text. Do not apply to backgrounds, decorative shapes, or elements whose size and position are not clearly different between screens — the transition will look like a glitch, not a morph.

### Haptics as choreography

expo-haptics is a real design tool that the web cannot access. At overdrive level, haptics are not confirmations tacked onto buttons — they are timed events choreographed with visual animation peaks.

```tsx
import * as Haptics from 'expo-haptics';

// Fired at the exact frame a gesture crosses a threshold (in runOnJS, called from worklet)
function onThresholdCross() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

// Fired at the peak of a success reveal animation (not at animation end)
function onSuccessAnimationPeak() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

// Selection haptics on a custom picker/carousel that snaps between items
function onItemSnap() {
  Haptics.selectionAsync();
}
```

Timing rules:
- Fire at the **moment of consequence** — when the gesture commits, when the confirm lands visually, when the animation peaks. Not at the start of a tap; not at the end of an animation fade-out.
- One haptic per primary moment. Two haptics in 200ms read as a hardware defect.
- Android gets all haptics; if finer Android control is needed, use `react-native-haptic-feedback`. Never silently omit Android haptics — absence on confirm reads as a failure state.
- Haptics pair with `useReducedMotion`: when motion is reduced, haptics can stay (they're non-vestibular) unless the user has explicitly disabled system haptics.

### 120Hz ProMotion and high-refresh Android

On iPhone Pro / iPad Pro and most recent Android flagships, the display renders at up to 120Hz. Reanimated worklets hit 120fps automatically — you do not opt in, you opt out by making bad choices.

What breaks 120Hz:
- **`setTimeout(..., 16)`** — assumes 60fps; breaks frame timing at 120Hz. Use Reanimated worklet primitives.
- **JS-thread state driving animations** — `useState` + `setInterval` animations cap at JS thread throughput (~60fps on a good day). Every animation in overdrive runs on the UI thread.
- **`scrollEventThrottle={16}`** — caps scroll handler at 60fps. Use `useAnimatedScrollHandler` which runs at native rate.
- **Skia clock-driven animations** — `useClockValue` runs at native screen rate automatically on both platforms.

What to verify: on a ProMotion device (or the iOS Simulator with ProMotion enabled in settings), spring animations should feel distinctly more alive — not faster, but more continuous. If they feel identical to 60Hz, the animation is on the JS thread.

---

## Implement with Discipline

### Progressive enhancement is non-negotiable

Every overdrive effect must degrade gracefully. The screen without the effect must still work.

```tsx
// Platform-branch blur: native on API 31+, semi-transparent on older Android
const isBlurSupported = Platform.OS === 'ios' || (Platform.OS === 'android' && Platform.Version >= 31);

// Skia availability: check before rendering Canvas
import { Skia } from '@shopify/react-native-skia';
const skiaAvailable = !!Skia;
```

For shared element transitions: wrap them in a try-boundary and test on both platforms in isolation. Expo Router's shared element API is experimental — have a fallback navigation behavior.

### Performance rules

- 60fps minimum. 120fps where ProMotion / high-refresh Android is available. Never drop below 60.
- All gesture handlers and derived values run on the UI thread. `runOnJS` is for side effects only — never per-frame.
- Skia canvases with shader or particle work: benchmark on mid-tier Android (Pixel 5a or equivalent). What's smooth on a ProMotion Mac Catalyst test is irrelevant. The canvas is bounded to the region that needs it — no full-screen shader backgrounds on low-RAM devices.
- BlurView bounded to a defined region. Never apply to a parent that clips a scrolling list.
- Shared element transitions: verify that the element's layout is stable before the transition fires. Race conditions between navigation and layout measurement are the most common failure mode.
- Particle systems: cap particle count dynamically. Detect frame budget at startup and reduce complexity if render time per frame exceeds budget. A particle system that degrades to 30fps on a Pixel 5 is not an overdrive enhancement — it's a bug.

### `useReducedMotion()` is the floor, even here

Overdrive must have a fallback path. "Reduced motion" does not mean "no visual difference" — it means no vestibular-triggering motion. Shader effects, blur, and haptics can stay; spatial translation, rotation, and scale must substitute.

```tsx
import { useReducedMotion } from 'react-native-reanimated';

function OverdriveReveal({ children }) {
  const reduceMotion = useReducedMotion();

  // Full path: Skia mask wipe driven by a gesture
  // Reduced path: instant fade-in, no spatial movement
  if (reduceMotion) {
    return (
      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 200 }}>
        {children}
      </MotiView>
    );
  }

  return <SkiaMaskReveal>{children}</SkiaMaskReveal>;
}
```

Every Skia clock animation, every gesture-driven spatial effect, every particle system: branch on `useReducedMotion()`. The crossfade path is not a punishment — it should be beautiful in its own right.

### Polish is the margin between cool and extraordinary

The difference is in the last 20% of refinement:
- The spring config on a pinch release that feels like letting go of a real object, not releasing a digital one
- The timing offset between the haptic fire and the visual peak — if the haptic is 30ms late, the effect feels disconnected
- The Skia path that traces at a speed that matches the rhythm of the screen's other motion tokens
- The BlurView that opens at the exact frame the sheet starts rising, not 100ms after

Don't ship the first version that technically works. Ship the version that makes someone pick up their phone to show a colleague.

---

## Verify the Result

After each pass, verify on **both** iOS Simulator and Android Emulator. For gesture effects, test on a real device — simulators lie about gesture velocity and frame timing. Capture screenshots and screen recordings via `node .claude/skills/impeccable-native/scripts/screenshot.mjs`.

- [ ] Proposal gate completed — user approved a specific direction before any code was written
- [ ] Effect runs entirely on the UI thread. No `useState` + `setInterval` driving animation. No `runOnJS` called per frame.
- [ ] 60fps confirmed on mid-tier Android (emulate Pixel 5a equivalent). `120fps on ProMotion device or simulator with ProMotion enabled.
- [ ] `useReducedMotion()` branch present. Fallback is a crossfade or instant reveal — not an empty `if` that renders nothing.
- [ ] Haptics fire at motion peaks, not at tap starts or animation ends. One haptic per primary moment. Android haptics wired (not iOS-only).
- [ ] Skia canvas bounded to its region. No full-screen canvas with uncapped particle or shader complexity.
- [ ] BlurView bounded. Not applied as a parent wrapping a scrolling list. Fallback exists for Android < API 31.
- [ ] Shared element transition verified on both platforms. Fallback behavior defined for expo-router experimental API.
- [ ] Gesture composition: each recognizer resolves correctly. `Simultaneous` / `Exclusive` / `Race` chosen deliberately.
- [ ] `runOnJS` used only for side effects. Bridge crossing is never on the hot path.
- [ ] Effect degrades gracefully when dependency unavailable (Skia not available, BlurView unsupported).
- [ ] Core content is accessible without the effect. Progressive enhancement, not progressive replacement.
- [ ] VoiceOver + TalkBack pass: overdrive effects do not trap focus or interfere with screen-reader traversal.
- [ ] Constitution Principle IV: both platforms verified. Android is not a second-class citizen.

**Five tests that matter**:
- **The wow test**: show it to someone who hasn't seen it. Do they pick up the phone?
- **The removal test**: turn off the effect. Does the experience feel meaningfully diminished, or does nobody notice? If nobody notices, reconsider.
- **The device test**: run it on a mid-tier Android on the emulator. Still smooth?
- **The reduced-motion test**: enable Reduce Motion (iOS) / Remove Animations (Android). Still beautiful?
- **The context test**: does this effect belong in THIS app, with THIS brand, for THIS user? A technically flawless effect in the wrong register is still wrong.

**NEVER**:
- Skip the proposal gate. Building before the direction is confirmed is how hours vanish on the wrong direction.
- Ignore `useReducedMotion()`. Vestibular disorders are real; this is an accessibility requirement, not a detail.
- Ship effects that drop below 60fps on mid-tier Android. An effect that jitters is worse than no effect.
- Use Skia, BlurView, or particle systems without bounding their region. Full-screen GPU effects over scrolling content are frame-rate traps.
- Add iOS-only haptics. Android silence on confirmation reads as broken.
- Layer multiple competing overdrive moments. Focus creates impact; excess creates noise. One extraordinary moment per screen.
- Use technical ambition to mask weak design fundamentals. An extraordinary Skia effect on a screen with broken spacing is embarrassing. Fix the fundamentals with other commands first.
- Ship shared element transitions as the only transition path without a fallback. The API is experimental; test what happens when it fails.
- Reach for overdrive when `animate.md` covers it. A spring scale on a `Pressable` is not overdrive. A pinch-composed gesture with a Skia displacement map and a choreographed haptic sequence is.

---

"Technically extraordinary" on mobile is not about using the most advanced API. It is about making a moment feel like the device was built specifically for it.
