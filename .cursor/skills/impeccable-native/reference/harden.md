Designs that only work on a fast device with perfect data and no interruptions aren't production-ready. Harden the interface against the device conditions, lifecycle events, network states, and content edge cases that real users encounter every day on mobile.

## Assess Hardening Needs

Before hardening, survey the surface for known mobile failure vectors:

1. **Device & layout edge cases**:
   - Small screens (iPhone SE 3rd gen, 375×667 pt logical resolution)
   - Notch / Dynamic Island on iPhone 14 Pro and later
   - Home indicator clearance at the bottom
   - One-handed reachability: is any primary action above the top 40% of the screen?
   - Phone ↔ tablet re-layout (if `Primary Devices` in PRODUCT.md includes tablet)

2. **Keyboard edge cases**:
   - Forms on short screens (iPhone SE with 4+ inputs)
   - `KeyboardAvoidingView` missing or using the wrong `behavior` for each platform
   - Input focus chain: does "Next" on the keyboard move correctly to the next field?
   - `keyboardType`, `autoComplete`, `textContentType` mismatch with the data expected

3. **Network & offline edge cases**:
   - No connectivity while the screen loads
   - Slow connection (3G-equivalent, 150–400 kbps)
   - Request timeout with no retry path
   - In-flight mutation when connection drops mid-send

4. **App lifecycle edge cases** (web has none of these):
   - Screen data is stale after backgrounding for 10+ minutes
   - Session expired in the background; user re-foregrounds
   - App killed and restored via Expo Router / React Navigation state persistence
   - Push notification tap while app is backgrounded
   - System permission revoked in Settings while the app is open

5. **Navigation & deep link edge cases**:
   - Deep link to a screen that requires auth
   - Deep link to a deleted or expired resource
   - Android hardware/gesture back from every screen in the stack
   - Bottom sheet or modal swipe-down, back-gesture, and tap-outside dismiss

6. **Content edge cases**:
   - Empty state (zero items, no results, no notifications)
   - Single item
   - Very long strings: names > 60 chars, emails, URLs, descriptions > 500 chars
   - Emoji, CJK characters, RTL text (Arabic, Hebrew) in all text inputs and rendered cells
   - Large numbers (millions, elapsed durations, long price strings)
   - Many items (500+ list rows)

**CRITICAL**: iOS-only testing is itself a hardening failure. Every check below covers both platforms. If only one platform was inspected, that is a P0 finding per Constitution Principle IV.

---

## Hardening Dimensions

### Device & Layout

**Safe area clearance**:

```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ✅ Correct: insets at runtime, respects all notch shapes
const insets = useSafeAreaInsets();
<View style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>

// ❌ Wrong: hardcoded value breaks on notch-less iPads and future devices
<View style={{ paddingTop: 44, paddingBottom: 34 }}>
```

Every screen, tab bar, sticky header, modal sheet, FAB, and bottom CTA must clear the home indicator and notch. `useSafeAreaInsets()` is the primitive. Hardcoded `paddingTop: 44` / `paddingBottom: 34` is a finding.

**Status bar style per screen**:

```tsx
import { StatusBar } from 'expo-status-bar';

// In each screen component:
<StatusBar style="light" />  // or "dark", "auto"
```

A modal over a light surface that inherits the host screen's `light` status bar style will show white text on white — invisible. Set `StatusBar` explicitly on every distinct screen type.

**Dynamic Island clearance** (iPhone 14 Pro / 15 Pro and newer): `useSafeAreaInsets().top` already returns the correct clearance including the Dynamic Island on devices that have it. No special-casing needed if you're using `useSafeAreaInsets()`. The failure mode is when `paddingTop` is set inline or via a hardcoded constant that predates the Dynamic Island.

**One-handed reachability**: Primary actions (the most-tapped call-to-action on a screen) must land in the bottom 60% of the screen height. Use `useWindowDimensions()` to verify position ratios. A "Submit" button that lives above the fold on an SE-sized screen while a keyboard is open is unreachable.

**Small screen regression** (iPhone SE, 375×667 pt):

```tsx
const { height } = useWindowDimensions();
// Height is 667pt on SE3 vs 852pt on iPhone 15 Pro
// Test: can all 4+ inputs + submit button be reached on the SE?
```

**Phone ↔ tablet** (when in scope per PRODUCT.md `Primary Devices`): use `useWindowDimensions()` to branch layout at a stable breakpoint (typically 768pt width). Never detect by device OS or model — detect by available space.

---

### Keyboard Avoidance

The single most commonly broken hardening dimension on both platforms.

**Platform-correct `behavior`**:

```tsx
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={{ flex: 1 }}
>
  <ScrollView keyboardShouldPersistTaps="handled">
    {/* inputs */}
  </ScrollView>
</KeyboardAvoidingView>
```

`behavior="padding"` on iOS adds padding below the scroll content, pushing it up. `behavior="height"` on Android shrinks the container height. Using the wrong one for the wrong platform produces inputs that slide under the keyboard and are unreachable.

`keyboardShouldPersistTaps="handled"` on `ScrollView` prevents the scroll from swallowing taps-to-buttons while the keyboard is open — the "I try to tap Submit but the keyboard just dismisses" failure.

**Input focus chain**:

```tsx
const emailRef = useRef<TextInput>(null);
const passwordRef = useRef<TextInput>(null);

<TextInput
  ref={emailRef}
  returnKeyType="next"
  onSubmitEditing={() => passwordRef.current?.focus()}
  keyboardType="email-address"
  autoComplete="email"
  textContentType="emailAddress"
/>
<TextInput
  ref={passwordRef}
  returnKeyType="done"
  onSubmitEditing={handleSubmit}
  secureTextEntry
  autoComplete="current-password"
  textContentType="password"
/>
```

Every form must be completable without dismissing the keyboard manually. "Next" moves forward; the last field fires the submit action. Missing `onSubmitEditing` chains are a finding.

**`keyboardType` / `autoComplete` / `textContentType` correctness**:

| Input type | `keyboardType` | `autoComplete` | `textContentType` |
|---|---|---|---|
| Email | `"email-address"` | `"email"` | `"emailAddress"` |
| Current password | `"default"` | `"current-password"` | `"password"` |
| New password | `"default"` | `"new-password"` | `"newPassword"` |
| Phone | `"phone-pad"` | `"tel"` | `"telephoneNumber"` |
| Postal code | `"numbers-and-punctuation"` | `"postal-code"` | `"postalCode"` |
| SMS OTP | `"number-pad"` | `"one-time-code"` | `"oneTimeCode"` |

The OTP one is especially high-value: `textContentType="oneTimeCode"` on iOS surfaces the SMS code as a QuickType banner — the user never has to leave the app. Missing it is a real UX cost.

**Short-screen overflow** (iPhone SE with 4+ inputs): open the sim at 375×667, focus the third input, and verify the active input stays visible above the keyboard. If any input is hidden, restructure the form into sections or use a `ScrollView` with `keyboardShouldPersistTaps="handled"`.

---

### Network & Offline

**Connectivity detection**:

```tsx
import NetInfo from '@react-native-community/netinfo';

useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    setIsOffline(!state.isConnected);
  });
  return unsubscribe;
}, []);
```

When offline:
- Surface an **inline banner** (not a full-screen error) if the screen has cached content to show. "You're offline — showing saved data" is more useful than a blank error screen.
- Surface a **full-screen empty state** only if the screen has no cacheable content and cannot function at all without network.
- Never crash or throw an unhandled promise rejection on connectivity loss.

**Slow connection (3G-equivalent)**:
- Use **skeleton screens** for layouts with known shapes (lists, profile cards, feed rows). A skeleton with a shimmer animation (Reanimated-driven `LinearGradient` sweep at 1500–2000ms per pass) primes layout muscle memory while loading.
- Use a **spinner** only when the layout shape is unknown, the wait is genuinely indeterminate (< 1s expected), or it's a background sync indicator.
- Use `expo-image` with a `blurhash` placeholder for hero images so the layout stabilizes immediately:

```tsx
import { Image } from 'expo-image';

<Image
  source={{ uri: imageUrl }}
  placeholder={{ blurhash: item.blurhash }}
  contentFit="cover"
  style={styles.hero}
/>
```

**Request timeout and retry**:

```tsx
// Show error with retry CTA — never just a spinner that hangs indefinitely
{isError && (
  <ErrorBanner
    message="Couldn't load your orders."
    onRetry={refetch}
  />
)}
```

Every async operation has three states designed: loading, error with retry, and success (or empty). A loading spinner with no error path is a finding.

**Optimistic UI + rollback**:

```tsx
// Mutation fires; UI updates immediately
onMutate: async (newData) => {
  await queryClient.cancelQueries({ queryKey });
  const previous = queryClient.getQueryData(queryKey);
  queryClient.setQueryData(queryKey, optimisticUpdate(newData));
  return { previous };
},
onError: (err, newData, context) => {
  queryClient.setQueryData(queryKey, context.previous);
  showUndoToast('Action failed — reverted.', null); // no undo needed; already rolled back
},
```

Optimistic UI is appropriate for: likes, follows, list reorder, mark-as-read, draft autosave. Not for: payments, deletions without undo, irreversible actions. Rollback must surface a quiet inline toast — never a blocking dialog the user already scrolled past.

---

### App Lifecycle

These edge cases don't exist on the web. Every one of them must be tested.

**Background-to-foreground data refresh**:

```tsx
import { AppState, AppStateStatus } from 'react-native';

useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      // Re-check session validity
      if (isSessionExpired()) redirectToLogin();
      // Refresh stale data (e.g. if backgrounded > 5 min)
      if (dataIsStale()) refetch();
    }
  });
  return () => subscription.remove();
}, []);
```

A screen that was backgrounded for 10 minutes and comes back showing stale prices, read-count badges, or "logged in" state when the session expired is a hardening failure. `AppState` is the hook.

**App killed and restored** (navigation state persistence):

Expo Router persists navigation state by default when `EXPO_PUBLIC_USE_METRO_WORKSPACE` is active in development. In production, verify that:
- Navigating to a screen, killing the app, and reopening restores the user to that screen (not always the root).
- If restoring to a screen requires auth and the session expired, the restoration redirects to login and then returns to the original destination after auth.
- No screen crashes on cold-start re-entry because it assumed `route.params` would be populated (always guard params).

**Push notification tap**:

When the app is backgrounded and the user taps a push notification, the app must navigate to the relevant content — not the home tab. This requires a notification listener registered at the root:

```tsx
import * as Notifications from 'expo-notifications';

// In App root:
useEffect(() => {
  const sub = Notifications.addNotificationResponseReceivedListener(response => {
    const { screen, params } = response.notification.request.content.data;
    router.push({ pathname: screen, params });
  });
  return () => sub.remove();
}, []);
```

If the notification tap lands on the home tab every time, the deep navigation is not wired. That's a hardening failure.

**Permission revoked mid-session**:

```tsx
AppState.addEventListener('change', async (nextState) => {
  if (nextState === 'active') {
    const { status } = await Camera.getCameraPermissionsAsync();
    if (status !== 'granted' && wasPreviouslyGranted) {
      // Don't crash. Show a graceful inline prompt.
      setShowPermissionPrompt(true);
    }
  }
});
```

Camera, location, and notification permissions can be revoked in iOS Settings while the app is backgrounded. On re-foreground: re-check, surface a graceful in-app prompt or banner explaining the impact. Never crash. Never silently fail with a blank camera view.

**Memory warning (iOS)**:

```tsx
useEffect(() => {
  const sub = AppState.addEventListener('memoryWarning', () => {
    // Clear large in-memory caches
    clearImageCache();
    clearPaginatedDataBeyondPage(2);
  });
  return () => sub.remove();
}, []);
```

`expo-image` manages its own disk and memory cache. If you're maintaining custom caches (paginated data, decoded blobs), register a `memoryWarning` listener and trim them. iOS will kill the app if memory pressure is ignored.

---

### Navigation & Deep Links

**Auth-gated deep links**:

The canonical pattern: attempt to navigate to the deep-linked screen → detect that auth is required → redirect to login → after successful auth, navigate to the originally intended destination. Use a `pendingDeepLink` store (Zustand, context, or a ref) to preserve the destination across the auth flow.

```tsx
// On deep link received:
if (!isAuthenticated) {
  setPendingRoute(incomingRoute);
  router.replace('/login');
}

// After successful login:
const pending = consumePendingRoute();
if (pending) router.replace(pending);
else router.replace('/(tabs)');
```

**Deep link to deleted/expired resource**:

```tsx
// In the screen component:
if (isError && error.status === 404) {
  return (
    <EmptyState
      title="This content is no longer available"
      description="It may have been removed or the link has expired."
      action={{ label: 'Go home', onPress: () => router.replace('/(tabs)') }}
    />
  );
}
```

A blank screen or an unhandled crash on a 404 deep link is a hardening failure. Every resource-fetching screen must handle deletion/expiry gracefully.

**Android hardware/gesture back**:

Every screen must handle Android back correctly. The defaults from `react-navigation` / Expo Router cover most cases, but custom `BackHandler` is required when:
- A bottom sheet is open (pressing back should close the sheet, not pop the screen)
- An in-progress form has unsaved data (pressing back should prompt or auto-save)
- The app would navigate out entirely (pressing back on the root tab should minimize, not crash)

```tsx
import { BackHandler } from 'react-native';

useEffect(() => {
  const sub = BackHandler.addEventListener('hardwareBackPress', () => {
    if (sheetIsOpen) {
      closeSheet();
      return true; // consumed
    }
    return false; // let the navigator handle it
  });
  return () => sub.remove();
}, [sheetIsOpen]);
```

**Sheet / modal dismiss — all three paths must close**:

| Path | Mechanism |
|---|---|
| Swipe down | `@gorhom/bottom-sheet` pan gesture with velocity threshold |
| Android back | `BackHandler` returning `true` and calling `dismiss()` |
| Tap outside | `Backdrop` with `onPress={dismiss}` |

A sheet that only closes via the swipe but not via Android back is a P0 finding on Android.

---

### Content Edge Cases

**Text overflow & truncation**:

```tsx
// Single-line truncation with ellipsis
<Text numberOfLines={1} ellipsizeMode="tail" style={styles.title}>
  {longTitle}
</Text>

// Multi-line clamp
<Text numberOfLines={3} ellipsizeMode="tail" style={styles.body}>
  {longDescription}
</Text>
```

RN has no CSS `text-overflow: ellipsis`. `numberOfLines` + `ellipsizeMode` is the primitive. Every list row title, notification label, and card description that can receive user-generated or server-provided text must have a `numberOfLines` guard.

**i18n and RTL**:

RN has built-in RTL support via `I18nManager.isRTL`. When RTL is active:
- `StyleSheet` values for `marginLeft`/`marginRight`, `paddingLeft`/`paddingRight`, and `borderLeftWidth`/`borderRightWidth` do **not** automatically flip — you must use `marginStart`/`marginEnd` (logical properties) or handle them via `I18nManager.isRTL` conditionals.
- Chevron icons (→) must mirror. Use a `scaleX: -1` transform when RTL.
- Test with Arabic or Hebrew device locale to catch layout breaks.

**Translation length budget**: German is typically 30–40% longer than English. Fixed-width buttons and constrained containers break. Buttons must use `paddingHorizontal` (not a fixed width) so they expand to fit.

**Date/time and number formatting**:

```tsx
// ✅ Use Intl — available on Hermes
new Intl.DateTimeFormat('de-DE').format(date);
new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

// ✅ Pluralization via i18n library
t('items', { count }); // handles complex plural rules across locales

// ❌ Never
`${count} item${count !== 1 ? 's' : ''}` // English-only pluralization
```

**Empty, single, and large list states**: every `FlatList` / `SectionList` must declare a `ListEmptyComponent`. A blank white screen where the list should be is not an empty state. For large lists (500+ items), verify `getItemLayout` is set (when row height is fixed) and `windowSize` is tuned — otherwise the first scroll is janky.

---

### Accessibility Hardening

**Every interactive element carries role + label**:

```tsx
<Pressable
  accessibilityRole="button"
  accessibilityLabel="Delete message"
  accessibilityHint="Removes the message and cannot be undone"
  accessibilityState={{ disabled: isDeleting, busy: isDeleting }}
  onPress={handleDelete}
/>
```

- `accessibilityRole` — required on every `Pressable`, `TouchableOpacity`, and custom interactive view.
- `accessibilityLabel` — required for icon-only controls and any control whose visible text is ambiguous.
- `accessibilityState` — required on toggles (`checked`), tabs (`selected`), disabled controls (`disabled`), and loading controls (`busy`).

**Focus trap in sheets and modals**: when a bottom sheet or modal opens, VoiceOver focus must move into it and be confined until dismissal. When dismissed, focus must return to the trigger element. The user must not be able to swipe-focus behind a modal backdrop.

**VoiceOver ↔ TalkBack parity**: test the same critical flows on both. The screen that reads clean on VoiceOver can be a mess on TalkBack. Specific divergences to check:
- TalkBack phrasing: "double-tap to activate" vs VoiceOver's "tap"
- `accessibilityLiveRegion` (Android) fires where needed for dynamic content changes
- Custom swipe actions declared via `accessibilityActions` work on both platforms

**`useReducedMotion()` respected**:

```tsx
import { useReducedMotion } from 'react-native-reanimated';

const reducedMotion = useReducedMotion();

// Substitute a snap or instant fade when true
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: reducedMotion ? 1 : withSpring(scale.value) }],
  opacity: reducedMotion ? (isVisible ? 1 : 0) : withTiming(opacity.value),
}));
```

**Dynamic Type 2×**: set system font scale to 2× (iOS: Settings → Accessibility → Display & Text Size → Larger Text; Android: Settings → Accessibility → Font Size). Verify: no clipped text, no overlapping rows, no cut-off button labels, containers expand. If `allowFontScaling={false}` is used on any label or button, there must be a documented reason (a logo wordmark, a fixed-width numeric counter) — not a convenience shortcut.

**Platform parity (Constitution Principle IV)**: every accessibility harden pass covers iOS **and** Android. iOS-only a11y testing is a P0 finding. Android haptics must be wired (not iOS-only `expo-haptics` calls). Platform-split shadow tokens (`Platform.OS === 'ios' ? token.ios : token.android`) must be verified on both.

---

## Verify Hardening

Run through each of these manually. No automated test replaces on-device verification.

**Device & layout**:
- [ ] Open the screen on iPhone SE 3rd gen (375×667 pt) — no overflow, no unreachable CTAs
- [ ] Open on a notch/Dynamic Island device — status bar and header clear the notch
- [ ] Open on iPad (if in scope) — layout adapts, no stretched single-column content
- [ ] Rotate to landscape (if in scope) — layout holds, no clipped controls

**Keyboard**:
- [ ] Focus the first input, tab through all inputs to submit using only the keyboard — no manual taps needed
- [ ] Open the screen on iPhone SE with the keyboard raised — every input visible above the keyboard
- [ ] Tap a button while keyboard is open — button responds, keyboard does not consume the tap
- [ ] Verify `keyboardType`, `autoComplete`, `textContentType` on every input field

**Network & offline**:
- [ ] Enable airplane mode while on the screen — inline banner, no crash, cached data visible if any
- [ ] Throttle to 3G (Proxyman, iOS Network Link Conditioner, or Android Developer Options) — skeletons appear, images show blurhash, no blank white flash
- [ ] Kill the network mid-mutation — rollback fires, toast shown, no silent data loss
- [ ] Re-enable network — screen recovers without requiring a full app restart

**App lifecycle**:
- [ ] Background the app for 10+ minutes, re-foreground — data refreshed or stale banner shown, session re-checked
- [ ] Kill the app from the app switcher, reopen — navigation state restored to the last screen
- [ ] Tap a push notification while app is backgrounded — lands on the relevant screen, not the home tab
- [ ] Revoke camera/location permission in Settings while the app is open, re-foreground — graceful prompt, no crash

**Navigation & deep links**:
- [ ] Open a deep link while unauthenticated — redirected to login, then to the original destination after auth
- [ ] Open a deep link to a deleted resource — graceful "no longer available" empty state, not a crash
- [ ] Android: press hardware back from every screen in the test flow — correct behavior, no leaking out of the app
- [ ] Android: press hardware back while a bottom sheet is open — sheet closes, screen stays
- [ ] Swipe-down on a bottom sheet — closes; tap outside the sheet — closes

**Content edge cases**:
- [ ] Paste a 200-character name into every text field and list row — truncation fires, no overflow
- [ ] Enter Arabic or Hebrew text — layout mirrors correctly, no RTL visual breaks
- [ ] Empty every list — `ListEmptyComponent` renders, not a blank screen
- [ ] Navigate to 1000+ item list — no initial jank, scrolling is smooth

**Accessibility**:
- [ ] VoiceOver (iOS): navigate every interactive element — roles announced, labels read, states correct, no stuck focus
- [ ] TalkBack (Android): same flow — parity with VoiceOver, `accessibilityLiveRegion` fires for dynamic changes
- [ ] Dynamic Type 2×: every screen — no clipped text, no overlapping rows, containers expand
- [ ] Reduced Motion on: every animation substitutes a snap or fade

When edge cases are covered, hand off to `/impeccable-native polish` for the final pass.

<codex>
HARDENING PRIORITIES BY FAILURE FREQUENCY

1. KeyboardAvoidingView behavior wrong for platform — most common RN form bug
2. Hardcoded safe area insets — breaks on notch / Dynamic Island devices
3. No offline / error state — async without all three states (loading / error / empty)
4. AppState not wired — stale data on foreground, session silently expired
5. Android back not handled — sheet stays open, or app leaks out entirely
6. iOS-only a11y testing — TalkBack divergence is invisible until tested
7. Deep link to 404 crashes — resource-level error states missing

NEVER:
- Assume the happy path is the only path
- Hardcode paddingTop: 44 or paddingBottom: 34
- Ship a form without testing KeyboardAvoidingView on both platforms
- Leave any async operation with only a loading state (error and empty required)
- Test accessibility on VoiceOver only — TalkBack parity is a Constitution Principle IV requirement
- Use AppState without cleaning up the subscription in useEffect return
- Ignore the iPhone SE — 375pt is still a real device in production traffic
</codex>
