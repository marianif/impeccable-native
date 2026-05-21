> **Additional context needed**: what's appropriate for the domain (playful vs professional vs quirky vs elegant) and the platform-fidelity stance from PRODUCT.md.

Find the moments where personality and unexpected polish would turn a functional interface into one users remember and tell other people about. Add only where the moment earns it; delight everywhere reads as noise.

On mobile, delight has a dimension web never had: the device responds physically. Haptics, micro-animations tied to gesture physics, and (where appropriate) sound make the phone feel alive. Use that. Don't squander it on decorative flutter.

---

## Register

Brand: delight can be distributed across copy voice, screen transitions, discovery rewards, seasonal touches, and personality across the whole surface.

Product: delight at specific moments, not screens. Completion, first-time actions, error recovery, milestone crossings. Reliability and consistency carry the rest of the experience; delight pushed everywhere reads as noise.

---

## Assess Delight Opportunities

Identify where delight would enhance — not distract from — the experience:

1. **Find natural delight moments**:
   - **Success states**: Completed actions (send, save, publish, purchase)
   - **Empty states**: First-time experiences, onboarding completion
   - **Loading states**: Waiting periods that can signal progress with personality
   - **Achievements**: Milestones, streaks, first-time gestures
   - **Gesture confirmations**: Swipe-to-complete, pull-to-refresh, long-press commit
   - **Errors**: Softening frustrating moments with empathy
   - **Easter eggs**: Hidden discoveries that reward curiosity

2. **Understand the context**:
   - What is the brand personality? (Playful? Professional? Quirky? Elegant?)
   - Who is the audience? (Tech-savvy? Creative? Corporate?)
   - What is the emotional context? (Accomplishment? Exploration? Frustration?)
   - What is appropriate? (A payments app and a creativity app are not the same)
   - What is the platform-fidelity stance? Cupertino-native, material-everywhere, or custom cross-platform all have different delight registers.

3. **Define delight strategy**:
   - **Subtle sophistication**: Refined spring physics, precise haptic pairing (luxury and productivity tools)
   - **Playful personality**: Expressive Moti animations, character in copy (consumer and social apps)
   - **Helpful surprises**: Anticipating needs, optimistic UI that removes doubt (tools and workflows)
   - **Sensory richness**: Haptics + animation + sound at key moments (creative and game-adjacent apps)

If any of these are unclear from the codebase, ask before implementing. Delight miscalibrated to brand registers as try-hard.

**CRITICAL**: Delight should enhance usability, never obscure it. If users notice the delight more than accomplishing their goal, you have gone too far.

---

## Delight Principles

### Delight Amplifies, Never Blocks

- Delight moments are quick: under 600ms for micro-interactions, under 1200ms for celebration sequences.
- Never gate core functionality behind a delight animation. The action completes; the delight accompanies it.
- Respect `useReducedMotion()` from `react-native-reanimated`. When the user has reduced motion enabled, collapse slides and scale animations to instant or crossfade. Haptics are governed by the system Haptics setting, not `useReducedMotion` — the OS handles that, but consider an in-app haptics toggle for high-frequency feedback apps.

### Peak-Not-Filler

Haptics and key animations fire at the moment of commitment or completion, not throughout a sequence. A checkmark that animates for 800ms gets its haptic at frame 1 — when the user committed — not at frame 48 when the draw completes. Confirmation is not decoration.

This is the single rule that separates considered delight from noisy delight.

### Surprise and Discovery

- Surface delightful details without announcing them. Reward exploration.
- Do not show the same animation for every repeated action. Vary the response on milestones (first, tenth, fiftieth).
- Hidden easter eggs are valid. Long-press on a logo, a shake gesture, a secret count — but always provide a visible path to the same action.

### Appropriate to Context

- Match the emotional register: celebrate success, empathize with errors, stay quiet during critical flows.
- Do not be playful during high-stakes moments (payment confirmation, data deletion, error recovery under time pressure).
- Cultural sensitivity applies; consult PRODUCT.md for audience notes.

### Compound Over Time

- First-time actions deserve more delight than the hundredth. Track this in local state or the user's profile.
- Vary responses so repeated use doesn't breed familiarity-blindness.
- Reveal deeper personality with continued use (progressive disclosure of easter eggs, evolving streak milestones).

---

## Haptics: The Mobile-Only Design Tool

`expo-haptics` gives you access to the device's Taptic Engine (iOS) and vibration motor (Android). This is a capability the web does not have. Use it with intent.

```tsx
import * as Haptics from 'expo-haptics';
```

| Haptic | When to fire |
|--------|-------------|
| `ImpactFeedbackStyle.Light` | Primary button tap, chip select, toggle flip |
| `ImpactFeedbackStyle.Medium` | Bottom sheet present, modal dismiss, important state change |
| `ImpactFeedbackStyle.Heavy` | Large layout shift, splash-to-content handoff |
| `selectionAsync()` | Picker scroll, swipe-through items, long-press threshold reached |
| `notificationAsync('success')` | Completed action, sent message, finished upload, milestone crossed |
| `notificationAsync('warning')` | Validation warning, "are you sure" gate |
| `notificationAsync('error')` | Failed action, payment declined, invalid input committed |

Three rules from interaction-design.md that apply here equally:

- **Fire at the visual peak, not the visual end.** The haptic confirms the user's intent, not the system's completion.
- **Do not haptic every row in a list.** A 20-row list with `Light` impact on every tap is exhausting. Reserve haptics for actions that carry weight: primary actions, destructive confirmations, milestone completions.
- **Platform parity is non-negotiable (Constitution Principle IV).** iOS has a full Taptic Engine vocabulary. Android maps most `expo-haptics` types to a single vibration intensity. If the fidelity gap matters to the product, use `react-native-haptic-feedback` for finer Android control. Never ship iOS-only haptics and leave Android silent — silence on confirm reads as broken.

---

## Micro-Animations on Success

Success states are the highest-return delight investment. The task is done; the user is receptive; the emotional valence is positive. Use it.

### Checkmark draw

```tsx
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

function SuccessCheck() {
  const progress = useSharedValue(0);

  useEffect(() => {
    // Fire haptic at the start of the draw — peak-not-end
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    progress.value = withTiming(1, {
      duration: 400,
      easing: Easing.out(Easing.quart),
    });
  }, []);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: (1 - progress.value) * 56,
  }));

  return (
    <Svg width={40} height={40} viewBox="0 0 40 40">
      <AnimatedPath
        d="M8 20 L17 29 L32 12"
        stroke={tokens.color.success}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={56}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}
```

### Scale-pulse confirmation

```tsx
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withSpring,
} from 'react-native-reanimated';

function ConfirmPulse({ children }: { children: React.ReactNode }) {
  const scale = useSharedValue(1);

  const trigger = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    scale.value = withSequence(
      withSpring(1.12, { damping: 12, stiffness: 300 }),
      withSpring(1, { damping: 18, stiffness: 200 }),
    );
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      {children}
    </Animated.View>
  );
}
```

The overshoot spring (`damping: 12`) is acceptable here precisely because the overshoot is the point. This is a celebratory moment — constrained amplitude, short duration. Do not use bouncy springs as a decorative default.

### Reduced motion fallback

```tsx
const reduceMotion = useReducedMotion();

useEffect(() => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  if (!reduceMotion) {
    scale.value = withSequence(
      withSpring(1.12, { damping: 12, stiffness: 300 }),
      withSpring(1, { damping: 18, stiffness: 200 }),
    );
  }
  // No else needed: haptic alone is sufficient feedback when motion is off.
}, []);
```

Haptics persist when motion is reduced. The haptic is the confirmation signal; the animation is the amplification.

---

## List Animation: Layout Animations

When items enter or leave a list, use Reanimated's declarative layout animations. These are the "low-cost, high-signal" delight investment on mobile.

```tsx
import Animated, { FadeInDown, FadeOut, Layout } from 'react-native-reanimated';

function DelightfulRow({ item, index }: { item: Item; index: number }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40).duration(280).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(180).reduceMotion(ReduceMotion.System)}
      layout={Layout.springify().damping(18).stiffness(200)}
    >
      <Row item={item} />
    </Animated.View>
  );
}
```

Rules for list animations:
- Cap total stagger time: 8 items at 40ms = 320ms. For longer lists, cap the staggered range to the first 8 visible rows; everything below the fold enters without stagger.
- `exiting` is ~75% of `entering` duration. The user has moved on; linger reads as latency.
- `layout` animation handles reflow when sibling items shift — removes the "jump cut" when a row is deleted.
- Always pass `reduceMotion(ReduceMotion.System)` to respect the user's setting.

---

## Moti: Higher-Level Animation

For components that benefit from declarative animation without writing shared values, `moti` is the right level of abstraction.

```tsx
import { MotiView } from 'moti';

// Fade-in with spring on mount
<MotiView
  from={{ opacity: 0, translateY: 8 }}
  animate={{ opacity: 1, translateY: 0 }}
  transition={{ type: 'spring', damping: 18, stiffness: 200 }}
>
  <SuccessBanner />
</MotiView>
```

Moti compiles to Reanimated under the hood; the `useReducedMotion` bridge works correctly. Use Moti when the animation is declarative and state-driven. Use raw Reanimated when the animation is gesture-driven or needs worklet-level control.

---

## Sound Feedback

`expo-av` provides sound playback on both platforms. Sound is a third delight channel after animation and haptics — lower priority, higher brand signal.

Pattern:
```tsx
import { Audio } from 'expo-av';

async function playSend() {
  const { sound } = await Audio.Sound.createAsync(
    require('../assets/sounds/send.mp3')
  );
  await sound.playAsync();
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
  });
}
```

Rules:
- Respect system silent mode. `Audio.setAudioModeAsync({ playsInSilentModeIOS: false })` lets the OS mute it when appropriate. Default to off; only use `true` for content (music, video), not UI feedback.
- Provide an explicit in-app sound toggle. Keep the preference in user settings, not a one-time modal.
- Volume should be quiet — these are cues, not alarms. Test at 30% device volume.
- Do not play on every interaction. Sound reserved for milestone moments (first send, streak completion, achievement unlock) has impact. Sound on every button press creates fatigue in under two minutes.
- Sound is the most platform-divergent delight signal. Android audio latency is higher; on low-end devices, a UI sound can arrive perceptibly after the visual. Test on real Android hardware, not just Expo Go on your iPhone.

Sound is not a required deliverable for most delight passes. Add it only when PRODUCT.md supports it and the moment genuinely earns it.

---

## Personality in Copy

Copy is the delight channel that costs nothing at render time.

**Completion messages** — write to what the product actually does:
```
// Bad (AI slop, instantly recognizable):
"You're all set! Let's go!"
"Woohoo! You did it!"

// Good (specific to product context):
"Sent to Marcus and 3 others."
"Your draft is saved. We'll be here when you're ready."
"Done. Sarah will be notified."
```

**Empathetic error messages**:
```
// Bad:
"Error 500. Please try again."

// Good:
"Couldn't reach the server. Check your connection and try again."
"That email is already in use. Forgot your password?"
```

**Encouraging empty states**:
```
// Bad (generic):
"No items yet."

// Good (specific action + personality):
"Your queue is empty. Pull in your first task to get started."
```

Match copy personality to brand. Banks can be warm without being wacky. Do not impose personality that the brand does not own.

---

## Celebration Moments

For milestones, streaks, and major completions, a brief particle burst or confetti effect signals that this moment is different.

- Use Reanimated worklets for particle systems, or `@shopify/react-native-skia` for canvas-grade effects in a bounded region.
- Keep celebrations short: 800–1200ms total. The user wants to continue; don't hold them hostage to a sequence.
- Pair with `notificationAsync('success')` haptic at the moment the celebration starts.
- Vary the celebration on repeat milestones. The tenth streak is not the same as the first. Reaching 100 is not the same as reaching 10.
- Respect `useReducedMotion()`. The haptic alone is a meaningful celebration for users who have motion disabled.

---

## Delight Audit Checklist

Before shipping a delight pass, verify:

- [ ] Haptics fire at the visual peak, not the visual end
- [ ] Android receives haptic parity (not silence where iOS taps)
- [ ] `useReducedMotion()` collapses spatial animations to fades or instant transitions
- [ ] Haptics still fire when reduced motion is on (governed by OS Haptics setting, not `useReducedMotion`)
- [ ] Delight moments are <600ms for micro-interactions; <1200ms for celebration sequences
- [ ] No delight blocks or delays core functionality
- [ ] Copy is specific to the product — no generic AI-filler celebration strings
- [ ] List layout animations use `reduceMotion(ReduceMotion.System)` on entering/exiting
- [ ] Spring configs for celebrations use constrained overshoot (`damping: 12`), not decorative bounce everywhere
- [ ] Sound playback respects silent mode and volume is quiet
- [ ] Celebrations are bounded (no full-screen Skia surfaces over scrolling content)
- [ ] First-time experiences are treated differently than repeat actions (tracked in state)
- [ ] Delight matches the emotional moment — no playful feedback during high-stakes flows

---

**Avoid**:
- Haptics on every list row press (fatigue).
- Haptics at the end of an animation rather than at the start.
- Bounce / elastic spring as a decorative default (save overshoot for earned celebration moments).
- Sound that ignores silent mode.
- Generic loading messages ("Herding pixels", "Teaching robots to dance") — AI slop, write product-specific copy.
- Decorative animation that ignores `useReducedMotion()`.
- Delight that delays or gates core functionality.
- Celebrating every action equally — when everything is special, nothing is.
- iOS-only haptics with Android silence.
- Full-screen Skia or blur surfaces over scrolling content (frame drops).

When delight moments feel earned and the surface feels alive, hand off to `{{command_prefix}}impeccable-native polish` for the final pass.
