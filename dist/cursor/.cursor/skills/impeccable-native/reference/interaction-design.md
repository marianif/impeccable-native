# Interaction Design

## The Mobile Interactive States

Every touchable needs these states designed. The web's eight-state matrix doesn't transfer cleanly — touch surfaces don't have hover or keyboard-focus-as-primary-modality. The mobile set is:

| State | When | Visual + Haptic Treatment |
|-------|------|---------------------------|
| **Default** | At rest | Base styling from tokens |
| **Pressed** | Finger down on element | Opacity 0.6–0.8, or scale 0.97 spring, or `pressedColor` swap |
| **Long-pressed** | Finger held 500ms+ | Stronger visual + `Haptics.selectionAsync()` on threshold |
| **Disabled** | Not interactive | Opacity 0.4, no haptics, `accessibilityState={{ disabled: true }}` |
| **Loading** | Async work in flight | Inline spinner, skeleton row, or content-shimmer; preserve the layout |
| **Error** | Invalid input or failed action | Border or accent shift to `error`, inline message below, optional `Haptics.notificationAsync('error')` |
| **Success** | Completed | Brief check + accent flash, `Haptics.notificationAsync('success')` |
| **Focused** | TV / Apple Pencil / external keyboard | Visible 2pt ring in `accent` color, 2pt offset |

A few notes on the deltas from web:

- **There is no hover.** The web "hover" intent (preview, signal interactivity) collapses into either the default state (interactivity is signaled by token-correct affordance — color, weight, position) or the pressed state (the user committed to the touch).
- **Focused is a corner case, not a default.** Most phone users don't connect external keyboards. But: tvOS, iPad with Magic Keyboard, accessibility users who navigate with a switch device, and the iPad cursor all expect a focus state. If the screen will ship to iPad or tvOS, design it. If phone-only, skip — but don't *disable* the default platform focus indicator if RN provides one.
- **Pressed is non-optional.** Without it, the screen feels broken. A Pressable with no `pressed` style is the mobile equivalent of an unstyled link.

### Implementing pressed cleanly

```tsx
import { Pressable, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

<Pressable
  onPress={() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAction();
  }}
  style={({ pressed }) => [
    styles.button,
    { backgroundColor: pressed ? colors.accentStrong : colors.accent },
  ]}
  accessibilityRole="button"
  accessibilityLabel="Save changes"
>
  <Text style={[styles.label, { color: colors.textInverse }]}>Save</Text>
</Pressable>
```

Two patterns are equally valid for the pressed visual:

- **Color swap** (above) — works for solid buttons, list rows, chips. Reads as material response.
- **Scale spring** — works for icon buttons, tiles, cards. Use Reanimated `withSpring` on a shared value, target `0.96`–`0.98`; release on `onPressOut`. Reads as physical response.

Choose one per component family and commit. Mixing within the same surface reads as inconsistent.

## Haptics: Pair With Visual Peaks, Not Visual Ends

`expo-haptics` (or `react-native-haptic-feedback` on bare) gives you OS-native haptic feedback. The mobile-only design tool the web doesn't have.

| Haptic | When |
|--------|------|
| `ImpactFeedbackStyle.Light` | Primary button press, tap-to-confirm, toggle flip |
| `ImpactFeedbackStyle.Medium` | Sheet present, modal dismiss, important state change |
| `ImpactFeedbackStyle.Heavy` | Large layout shift, splash-to-content handoff |
| `selectionAsync()` | Swipe through items, picker rotation, long-press threshold crossed |
| `notificationAsync('success')` | Completed action, sent message, finished upload |
| `notificationAsync('warning')` | Validation warning, "are you sure" without blocking |
| `notificationAsync('error')` | Failed action, invalid input, payment declined |

Three rules:

- **Fire at the visual peak, not the visual end.** A sheet that animates open for 400ms gets its haptic at frame 1, when the user committed; not at frame 24, when it's done. The haptic confirms the response, not the completion.
- **Don't haptic everything.** A list of 20 rows with light haptics on every press is exhausting. Reserve haptics for actions that matter — primary actions, state-changing toggles, gestures that need confirmation.
- **Respect `useReducedMotion()` is for motion only.** Haptics have their own iOS Settings opt-out (Sounds & Haptics → System Haptics) which the OS handles for you — but consider exposing an in-app haptics toggle for accessibility, especially for apps with frequent feedback.

## Touch Targets

44×44pt minimum (iOS HIG) / 48×48dp (Android). Non-negotiable. See [spatial-design.md](spatial-design.md) for the `hitSlop` vs padding patterns.

Beyond size: **spacing between targets matters too.** Two adjacent 44pt buttons with 4pt gap between them read as one wide target and produce mis-taps. Minimum 8pt gap between distinct touchables; 16pt+ when they have different actions (e.g. "Delete" next to "Cancel").

## Gestures

RN's stock `Pressable` covers tap and long-press. Anything more — swipe, pan, pinch, rotation, fling — needs `react-native-gesture-handler` (or its Reanimated-integrated successors).

### Discoverability is the gesture problem

Swipe-to-delete, pull-to-refresh, swipe-to-reveal-actions are invisible. The hard rule: **never make a gesture the only path to an action.** If a swipe deletes, there's also a long-press menu or a visible delete button. Three discovery patterns:

- **Partial reveal** — show the secondary action peeking from the edge (the iOS Mail row showing a sliver of "Archive" at trail edge on first row). The peek is the affordance.
- **Coach marks on first run** — a one-time overlay demonstrating the gesture. Track that it's been shown; never show twice.
- **Visible fallback** — every gesture-only action also lives in a long-press context menu, a row action button, or the screen's overflow menu.

### Common gesture patterns

- **Swipe row actions** — use `react-native-gesture-handler`'s `Swipeable`. Right-swipe leading actions (typically constructive: archive, mark read), left-swipe trailing actions (typically destructive: delete). Reveal at 25–40% drag; commit at 75% with haptic. Don't auto-commit on partial swipe.
- **Pull to refresh** — `RefreshControl` on `ScrollView`/`FlatList`. Match the spinner tint to the brand accent. Don't pull-to-refresh on screens that aren't a freshness-relevant list (no PTR on Settings, no PTR on a static About page).
- **Pinch to zoom** — `PinchGestureHandler`. Confine to surfaces that benefit (photo viewer, map). Animate scale on the UI thread via Reanimated worklets, never via state.
- **Pan to dismiss sheet** — pair with `withSpring` snap-back and a velocity threshold to commit dismissal. Without velocity-awareness, slow pans feel locked.
- **System back gesture (Android)** — handle via `BackHandler` + navigation library. iOS swipe-from-leading-edge back is automatic on `native-stack` navigators; opt out only when there's a destructive interrupt (unsaved form).

## Form Design

### Labels Are Not Placeholders

`placeholder` text disappears the moment the user types. It's not a label.

**Always render a visible label above (or floating to) the input.** Three viable patterns:

- **Static label above** — simplest, never moves. Default for most forms.
- **Floating label** — label starts inside the input, animates above on focus. Looks polished, requires Reanimated; risk: the animation has to land perfectly or it reads as buggy.
- **Inline label + helper text** — label outside, helper below. Right for forms where the helper itself is load-bearing (password requirements, format examples).

The placeholder, when used, is for *examples or format* (`"jane@example.com"`, `"+1 (555) 123-4567"`) — not the label.

### Validate at the Right Moment

- **On blur** — default. Validate when the user leaves the field. No-noise during typing.
- **On submit** — for forms where mid-field validation isn't possible (server-side uniqueness check on email).
- **On every keystroke** — only for password strength meter or character-count limits. Anywhere else, it's distracting.

Inline the error below the field, in `tokens.color.error`, with the inline help icon when relevant. Pair with `accessibilityLiveRegion="polite"` (Android) and the accessibility announce API on iOS so screen readers catch the validation event.

### Keyboard Behavior

- **`keyboardType`** — match the input: `"email-address"`, `"phone-pad"`, `"numeric"`, `"decimal-pad"`, `"url"`. The biggest free win in form design.
- **`autoComplete` + `textContentType`** — `"username"`, `"password"`, `"email"`, `"oneTimeCode"`. iOS's password autofill and Android's SmartLock both need these set. The OTP one in particular: a `textContentType="oneTimeCode"` on iOS makes the SMS code appear as a QuickType suggestion.
- **`returnKeyType="next"`** + `onSubmitEditing` chain — focus the next field on return. Last field gets `returnKeyType="done"` or `"go"`.
- **`KeyboardAvoidingView`** — wrap forms with `behavior="padding"` on iOS, `behavior="height"` on Android. Without it, the keyboard covers the field.
- **`secureTextEntry`** + a visibility toggle — every password field needs the eye icon to reveal. Without it, users mistype and rage-quit.

## Loading & Async States

### Optimistic UI

Update the interface immediately, sync the server in the background, roll back on failure. The mobile context — flaky networks, one-handed attention — makes optimistic UI a craft signal, not an optimization.

Use for low-stakes actions: likes, follows, list reorder, marking-as-read, draft autosave. **Don't use for** payments, deletions, irreversible actions, or anything where rollback would leak transient state to the user.

The rollback UX matters: if the server rejects, the visual revert needs a quiet inline error (toast, snackbar) — never a blocking dialog. The user already moved on; surface the failure without yanking attention.

### Skeleton Screens > Spinners

A spinner shows "we're working." A skeleton shows "this is the shape of what's coming." The skeleton is structured information that primes layout muscle memory; the spinner is dead time.

Build skeletons from the same `tokens.color.surfaceSubtle` tone as your loaded content, with a shimmer animation (a Reanimated-driven gradient sweeping across the placeholder shapes). Don't animate too fast — `1500–2000ms` per shimmer pass is right. Faster reads as anxious.

**When spinners are correct:** the action is short (<1s expected), the layout to come is unknown (full-screen content fetch), or the wait is genuinely indeterminate (background sync icon in nav bar).

## Sheets, Modals, and Overlays

### The Order to Reach For

1. **Inline expansion** — accordion, collapsible row, inline form. Cheapest disruption.
2. **Contextual menu** — long-press menu, overflow menu, swipe-actions. Stays on screen.
3. **Bottom sheet** — for actions that need more space than a menu but shouldn't take the whole screen. The mobile-correct middle ground.
4. **Modal stack screen** — full-screen overlay via `native-stack` modal presentation. For multi-step flows (creating an item, completing a checkout).
5. **Alert / dialog** — `Alert.alert()` from RN core, for truly system-level confirmations.

Reaching for Modal first is an SKILL.md absolute ban. Reaching for `Alert.alert()` for everything is the iOS-flavored version of the same mistake.

### Bottom Sheets

Use `@gorhom/bottom-sheet` (the de-facto library) or React Native's built-in `BottomSheetModalProvider` patterns. Two rules:

- **Snap points are design decisions.** A sheet that snaps at 30% / 60% / 100% gives the user agency. A sheet stuck at one height feels like a modal in disguise.
- **The grabber matters.** That 4pt-tall, 36pt-wide pill at the top of the sheet is the affordance. Without it, the pan-to-dismiss is invisible.

Backdrop dim is `tokens.color.scrimSheet` (rgba black at ~0.4 alpha). Tappable to dismiss. Pan-down to dismiss with velocity awareness.

### Alerts (the real "are you sure")

`Alert.alert()` is native, accessible, and platform-correct. Use it for:

- Destructive confirmations on items without an undo path
- Permission re-prompts
- Errors where the user can't continue without acknowledging

**Don't use it for**: validation errors (inline), success notifications (toast), informational messages (sheet or inline banner). The native alert is the heaviest interruption you can make — reserve it.

## Destructive Actions: Undo > Confirm

Users tap through confirmations mindlessly. **Remove from UI immediately, show an undo toast, actually delete after the toast expires** (5–10s window). Pair the delete with a `notificationAsync('warning')` haptic.

The undo toast is a small bottom-of-screen banner (above the home indicator) with the message ("Message deleted") and an "Undo" button. Tap-to-undo brings the row back with a `FadeIn` Reanimated entrance.

Use confirmation only for:

- Truly irreversible actions (account deletion, payment confirmation, "delete forever")
- High-cost actions (sending money, publishing to followers)
- Batch operations where partial undo isn't possible

## Accessibility

### Roles, Labels, States

Every touchable gets at minimum `accessibilityRole` and `accessibilityLabel`:

```tsx
<Pressable
  onPress={onSave}
  accessibilityRole="button"
  accessibilityLabel="Save changes"
  accessibilityHint="Saves the form and returns to the previous screen"
  accessibilityState={{ disabled: isSubmitting }}
>
```

- **`accessibilityRole`** — `button`, `link`, `header`, `image`, `imagebutton`, `switch`, `checkbox`, `radio`, `tab`, `tablist`, `none`. Sets the announced type ("Save, button").
- **`accessibilityLabel`** — what VoiceOver/TalkBack reads. Required if the visual is icon-only or abbreviated.
- **`accessibilityHint`** — *what happens after the action.* Use sparingly; only when the action isn't obvious from the label.
- **`accessibilityState`** — `{ disabled, selected, checked, busy, expanded }`. Sets the state announcement ("Save, button, dimmed").

### Decorative vs Functional

`accessibilityElementsHidden` (iOS) / `importantForAccessibility="no-hide-descendants"` (Android) on decorative imagery, ornament, background gradients. Without this, screen readers waste time announcing "image, image, image" between the actual content.

### Focus Order

Default: top-to-bottom, leading-to-trailing. When the visual order diverges from the logical order (a row with a leading icon, title middle, trailing chevron — but the title is what should be announced first), wrap in a single Pressable with one combined `accessibilityLabel`, not three nested accessible elements.

For multi-element rows where each piece is its own touchable, set explicit focus order with `accessible` and `accessibilityElementsHidden` to control what VoiceOver visits.

### VoiceOver and TalkBack are different

- VoiceOver announces in source order; respects `accessibilityRole` consistently; supports `accessibilityActions` for custom gestures (used for swipe actions, two-finger flicks).
- TalkBack announces with platform-specific phrasing ("double-tap to activate" rather than VoiceOver's "tap"); historically less consistent on custom controls; relies on `accessibilityLiveRegion` for dynamic content updates.

Test both. The screen that narrates clean on VoiceOver can be a mess on TalkBack.

## Keyboard, Pencil, Switch, Voice Control

External input methods are the focus-state and tab-order story on mobile:

- **External keyboards** (iPad with Magic Keyboard, Bluetooth) — RN respects Tab order for focusable elements when `focusable={true}`. Pressables are focusable by default; custom views need the prop.
- **Apple Pencil** with hover (iPad Pro M2+) — exposed as `onHoverIn`/`onHoverOut` on Pressable. Treat like a focus-preview state; subtle accent shift, no full activation.
- **Switch Control** (iOS) and **Switch Access** (Android) — for users with motor impairments who navigate via single-button input. They rely on focus order and well-labeled accessibility. There's nothing to add beyond getting roles, labels, and focus order right.
- **Voice Control** (iOS Voice Control / Android Voice Access) — users say "tap Save" to activate a button. Works automatically if `accessibilityLabel` matches the visible label. If the label is "Save Changes" but `accessibilityLabel` is "Save Form Data", voice control will fail. Keep them aligned.

---

**Avoid**:
- A Pressable with no `pressed` style.
- Haptics on every interaction (fatigue).
- Haptics at the *end* of an animation rather than at the *start*.
- Placeholder as label.
- Validation on every keystroke (except passwords).
- Modal as first thought — exhaust inline / sheet / context menu first.
- `Alert.alert()` for non-blocking messages.
- Confirmation dialogs where undo would work.
- Gestures as the only path to an action.
- Touch targets under 44pt / 48dp.
- Two adjacent targets with under 8pt gap.
- Decorative imagery without `accessibilityElementsHidden`.
- `accessibilityLabel` that doesn't match the visible label (breaks Voice Control).
- Spinners where a skeleton would teach the layout.
