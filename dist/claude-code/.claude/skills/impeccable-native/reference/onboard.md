> **Additional context needed**: the "aha moment" you want users to reach, their experience level, and whether the app requires an account to deliver value.

Get users to first value as fast as possible. Onboarding's job is not to teach the product. Its job is to get people to the moment that proves the product is worth their time.

On mobile this is harder and the stakes are higher: the uninstall is one swipe away, the system permission prompt is a binary cliff, and the splash-to-content handoff is the first impression that has no second chance.

## Assess Onboarding Needs

Understand what users need to experience and why:

1. **Identify the challenge**:
   - What are users trying to accomplish?
   - What's confusing or unclear about the current first-run experience?
   - Where do users get stuck or drop off? (Check analytics: install → first session → second session)
   - What's the "aha moment" — the one action or reveal that proves the product is worth keeping?

2. **Understand the users**:
   - What's their experience level? (Beginners, power users, mixed?)
   - What's their motivation? (Excited and exploring? Required by work?)
   - What's their time commitment? (A 90-second micro-task? A 10-minute setup?)

3. **Define success**:
   - What's the minimum users need to experience to be successful — not learn, experience?
   - What's the key action? (First item created? First connection made? First insight seen?)
   - How do we know onboarding worked? (D1 retention rate, time-to-first-value, permission grant rate)

4. **Inventory mobile-specific gates**:
   - Does the core value require a permission? (Camera, location, notifications)
   - Does it require an account?
   - Is there a meaningful guest/offline experience?
   - What happens if the user force-quits mid-onboarding and returns?

**CRITICAL**: Onboarding should get users to value as quickly as possible, not teach everything possible.

## Onboarding Principles

### Show, Don't Tell

- Demonstrate with working examples in the real app, not a tutorial overlay
- Use progressive disclosure: teach one thing at a time, at the moment it's needed
- Partial-reveal affordances (a row peeking to hint at swipe actions) teach more than text

### Make It Optional (When Possible)

- Let experienced users skip. Every onboarding screen needs a visible "Skip" or "Not now"
- Don't gate the product behind setup. Defer friction as long as possible
- Track skip — high skip rate means the screen is losing value, not that users are power users

### Time to Value

- Get users to the aha moment first. Everything else is setup
- Front-load the most compelling value prop: screen 1 of onboarding is the ad, not the instructions
- Keep multi-step onboarding to 3 screens maximum — 3 is a principle, not a guideline

### Context Over Ceremony

- Teach features when users encounter them, not upfront
- Empty states are onboarding opportunities, not afterthoughts
- Coach marks fire on the first meaningful interaction, not on cold launch

### Respect User Intelligence

- Don't patronize or over-explain standard mobile patterns
- Be concise. Users read labels, not paragraphs
- Assume users can figure out navigation; explain the non-obvious

## Splash Screen → Content Handoff

The splash screen is not a loading screen you ship to fill time. It's the first frame of the app — and the transition out of it is the first animation the user sees.

### Setup

```tsx
import * as SplashScreen from "expo-splash-screen";

// In app entry point, before any render
SplashScreen.preventAutoHideAsync();
```

Hide only after **all three** are done: fonts loaded, auth state resolved, initial data fetched (or timed out with a graceful fallback). Hiding early causes a flash of unstyled or skeleton content. Hiding too late makes users think the app froze.

```tsx
// In your root layout
const [fontsLoaded] = useFonts({ ... });
const { authResolved } = useAuth();

useEffect(() => {
  if (fontsLoaded && authResolved) {
    SplashScreen.hideAsync();
  }
}, [fontsLoaded, authResolved]);
```

### Animated Transition Out

An abrupt cut from the splash PNG to the app content is jarring. The correct pattern: the app content fades or scales in as the splash exits.

```tsx
// Reanimated fade-in on the root content container
const opacity = useSharedValue(0);

useEffect(() => {
  if (ready) {
    SplashScreen.hideAsync();
    opacity.value = withTiming(1, { duration: 300 });
  }
}, [ready]);

const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
```

Pair with `Haptics.impactAsync(ImpactFeedbackStyle.Heavy)` at the moment content enters — this is the haptic that marks "the app is ready."

## Permissions Priming

Never trigger a system permission prompt cold. Always show a custom "explain why" screen or sheet first. Users who understand the value grant permission; users who don't should have a graceful fallback path — not a broken feature.

### The Priming Pattern

```
1. Custom screen: illustrate what the permission enables + the specific benefit
2. Primary CTA: "Enable [Camera / Location / Notifications]"
3. On tap → request system prompt
4. If granted: proceed to feature
5. If denied: show contextual fallback (below)
```

The priming screen is not a formality. It is the only chance to set the user's frame before the binary system prompt. One sentence of honest value ("We need your location to show restaurants near you") converts better than a paragraph of feature description.

### Sequence Matters

Ask permissions at the moment of first use, not upfront:

- **Camera** → when user first taps the camera button
- **Photo library** → when user first tries to attach a photo
- **Microphone** → when user first tries to record
- **Location** → when user first triggers a location-dependent feature (not on launch)
- **Contacts** → when user first tries to invite someone
- **Notifications** → after the first win (see below)

Front-loading all permissions on launch destroys grant rates. Users with no context tap "Don't Allow" reflexively.

### Denied Permission Recovery

If the system prompt is denied, the feature is broken until the user goes to Settings. Don't let that moment be a dead end:

```tsx
import { Linking } from "react-native";

// Show a contextual inline prompt, not a blocking alert
// Message: "[Feature] needs camera access. Enable it in Settings."
// CTA: "Open Settings"

<Pressable
  onPress={() => Linking.openSettings()}
  accessibilityRole="button"
  accessibilityLabel="Open Settings to enable camera access"
>
  <Text>Open Settings</Text>
</Pressable>;
```

Use `Linking.openSettings()` — deep-links to the app's Settings page on both iOS and Android.

Check permission status on every feature entry, not just once at install. Users can revoke permissions at any time.

### Permissions Reference

| Permission             | Library                                                       | When to Ask                            |
| ---------------------- | ------------------------------------------------------------- | -------------------------------------- |
| Camera                 | `expo-camera` → `Camera.requestCameraPermissionsAsync()`      | First camera tap                       |
| Photo library          | `expo-image-picker` → `requestMediaLibraryPermissionsAsync()` | First photo attach                     |
| Microphone             | `expo-av` → `Audio.requestPermissionsAsync()`                 | First record tap                       |
| Location (when-in-use) | `expo-location` → `requestForegroundPermissionsAsync()`       | First location feature                 |
| Location (always)      | `expo-location` → `requestBackgroundPermissionsAsync()`       | After when-in-use granted + second ask |
| Notifications          | `expo-notifications` → `requestPermissionsAsync()`            | After first win                        |
| Contacts               | `expo-contacts` → `requestPermissionsAsync()`                 | First invite flow                      |

**Always/when-in-use distinction**: never ask for background location in the first permission ask. Get foreground permission first, use the feature, prove value — then prompt for always-on as a second ask with specific justification ("Enable background location to track your run even when the app is closed").

### Notifications Opt-In: High-Stakes

Notification permission is the highest-stakes ask in onboarding. Once denied it's permanently off until the user navigates Settings manually.

Rules:

- Never ask on cold launch. The user has not seen the product's value yet.
- Ask after the first win — the moment they've completed their first meaningful action.
- Prime first: show a custom screen explaining exactly what notifications they'd receive and why they're useful. Be specific ("We'll notify you when your order ships, and nothing else").
- If denied: honor it gracefully. Don't show a repeated in-app prompt. Show the Settings deep-link path only if the user explicitly tries to enable a notification-dependent feature later.

```tsx
import * as Notifications from "expo-notifications";

async function requestNotificationPermission() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  if (existing === "denied") return false; // already decided; don't re-ask

  // Show priming screen first, then:
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}
```

### iOS: App Tracking Transparency (ATT)

If the app uses analytics or ads: ATT must be primed before the system prompt. The ATT system prompt has the lowest grant rate of any iOS permission — a custom priming screen with honest copy makes a measurable difference.

```tsx
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";
// Prime → then:
const { status } = await requestTrackingPermissionsAsync();
```

## Account Creation and Auth Gates

### Defer Auth as Long as Possible

Users who experience value before being asked to create an account convert at a higher rate. The ask feels earned.

- "Continue as guest" or "Try it first" is almost always the right default unless the product is inherently account-required (banking, healthcare, sync-dependent features)
- Even account-required apps can show a sample state, a preview, or a capabilities demo before the auth wall

### Auth Patterns

**Social sign-in:**

- **Sign in with Apple is required on iOS** if any other social login is offered (App Store Review Guideline 4.8). Implement with `expo-auth-session` or the native SDK.
- Google Sign-In is common on Android and well-trusted; optional on iOS.
- Social login is the correct default for consumer apps. Custom email/password is secondary.

```tsx
import * as AppleAuthentication from "expo-apple-authentication";
// Conditionally render on iOS only:
{
  Platform.OS === "ios" && (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={tokens.radius.md}
      style={{ width: "100%", height: 48 }}
      onPress={handleAppleSignIn}
    />
  );
}
```

**Biometric auth for returning users:**
`expo-local-authentication` for Face ID / Touch ID / fingerprint. Offer this on first post-login, not forced. The offer screen needs: illustration, explanation of what biometrics unlocks (faster access, no password re-entry), and a clear "Not now" path.

```tsx
import * as LocalAuthentication from "expo-local-authentication";

const hasHardware = await LocalAuthentication.hasHardwareAsync();
const isEnrolled = await LocalAuthentication.isEnrolledAsync();
// Only offer if both true
```

**Minimal required information**: collect only what's needed to unlock value. Name and email. Defer address, phone, preferences to profile completion — post-aha-moment, not pre.

## First-Run Experience Patterns

### Onboarding Carousel (When Required)

If a carousel is appropriate: max 3 screens, most compelling value prop on screen 1, skip always visible.

```tsx
<FlatList
  ref={flatListRef}
  data={ONBOARDING_SCREENS}
  renderItem={renderOnboardingScreen}
  horizontal
  pagingEnabled
  showsHorizontalScrollIndicator={false}
  keyExtractor={(item) => item.id}
/>
```

Page indicator: dots with `Animated.Value` (or Reanimated `useSharedValue`) driving width/opacity — not a text counter. The active dot is wider than inactive.

Progress bar for multi-step setup (not carousel): `Reanimated` driving a `View` width from `0` to `100%`. Not a step number (`2 of 5`). Progress bars communicate momentum; step numbers communicate obligation.

```tsx
const progressWidth = useSharedValue(0);
progressWidth.value = withTiming((currentStep / totalSteps) * TRACK_WIDTH, {
  duration: 300,
  easing: Easing.out(Easing.cubic),
});
const progressStyle = useAnimatedStyle(() => ({ width: progressWidth.value }));
```

### Coach Marks

For gesture-driven or hidden features: use `react-native-spotlight-tour` or a custom `Modal`-based overlay. Rules:

- Fire on the first meaningful interaction, not on cold launch
- Maximum one coach mark per session entry
- Track shown state in `AsyncStorage` — never show twice
- The overlay must be dismissable with a tap anywhere, not only on a "Got it" button
- Every coach mark must be navigable via VoiceOver / TalkBack (the overlay `Modal` with `accessible={true}` and focus trapped inside)

### Partial Reveal Affordance

For swipe-to-reveal-actions on list rows: show a sliver (8–16pt) of the action peeking from the trail edge on the first row, first session. This is more effective than any coach mark for discoverable swipe gestures.

### Android Back During Onboarding

On Android, the back button on the first onboarding screen must not exit the app. Use `BackHandler`:

```tsx
import { BackHandler } from "react-native";

useEffect(() => {
  const handler = BackHandler.addEventListener("hardwareBackPress", () => {
    if (isFirstOnboardingScreen) {
      // Optionally show "Exit?" alert, or silently do nothing
      return true; // consume the event
    }
    return false; // let navigation handle it
  });
  return () => handler.remove();
}, [isFirstOnboardingScreen]);
```

## Empty State Design

Every empty state is a screen. It must have all four:

### 1. Illustration or Icon

Vector via `react-native-svg`, not a raster PNG. Match the illustration style to the product register — product-register apps get geometric/UI-adjacent illustration; brand-register apps can be warmer. Decorative: `accessibilityElementsHidden={true}` + `importantForAccessibility="no-hide-descendants"`.

### 2. Headline

What will live here once it's populated. One line. Not "Nothing here yet" — something specific: "Your saved items will appear here."

### 3. Body Explanation

Why this space matters. One to two sentences. Not a feature description — a benefit statement.

### 4. Primary CTA

One button. Taps to the action that populates this space. If there's a template option, make it secondary, not co-equal.

```tsx
// Correct: ListEmptyComponent on FlatList — never a conditional render outside the list
<FlatList
  data={items}
  renderItem={renderItem}
  ListEmptyComponent={<EmptyState {...emptyStateProps} />}
  keyExtractor={(item) => item.id}
/>
```

**Empty state types**:

- **First use** — user has never created anything here. Emphasize value, offer a template or example
- **User cleared** — intentionally deleted everything. Light touch, easy to recreate, no guilt
- **No results** — search or filter returned nothing. Suggest a different query, offer to clear filters
- **No permissions** — can't access the feature. Explain why, `Linking.openSettings()` CTA
- **Error state** — failed to load. Explain what happened, retry CTA, don't show a spinner that never resolves

### Skeleton Screens

For async content loads: skeleton screens over spinners. Match the skeleton to the real content's layout shape.

Build skeletons from `tokens.color.surfaceSubtle` with a shimmer animation — a Reanimated-driven gradient sweeping across the placeholder shapes:

```tsx
const shimmerPosition = useSharedValue(-1);

useEffect(() => {
  shimmerPosition.value = withRepeat(
    withTiming(1, { duration: 1600, easing: Easing.linear }),
    -1,
    false,
  );
}, []);

const shimmerStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: shimmerPosition.value * SKELETON_WIDTH }],
}));
```

1500–2000ms per shimmer pass. Faster reads as anxious.

Spinners are correct when: the action is short (<1s expected), the layout to come is unknown, or the wait is genuinely indeterminate.

## Social Proof and Trust Signals

Place trust signals at the moment of friction — just before the ask, not upfront:

- Ratings/reviews: directly above the "Create account" CTA, not on the welcome screen
- "Join 500k+ people who..." copy: at the auth gate, not the splash
- Security/privacy reassurance ("We never sell your data") at the notification opt-in screen, not in the app description
- Logos of notable users or press: below the first-run value prop, before "Get Started"

Placing trust signals too early wastes them. Place them at the exact moment users have a reason to doubt.

## Personalization That Changes the Experience

Personalization inputs during onboarding are only worth collecting if they materially change what the user sees. If the answers don't change the first screen, don't ask the questions.

Patterns that earn their place:

- **Goal selection** that determines the default content feed or task type shown
- **Experience level** that changes the UI density or feature exposure
- **Use case** (personal / team / enterprise) that changes the default navigation structure

Patterns that don't earn their place:

- Demographic collection "to improve the experience" that doesn't change anything
- Preference questions answered before the user has seen what they're choosing between

## Implementation

### Tracking First-Run State

```tsx
import AsyncStorage from "@react-native-async-storage/async-storage";

// Check + set on first launch
const hasOnboarded = await AsyncStorage.getItem("onboarding-v2-complete");
if (!hasOnboarded) {
  // show onboarding
  await AsyncStorage.setItem("onboarding-v2-complete", "true");
}

// Track dismissed states per feature
await AsyncStorage.setItem("coach-mark-swipe-actions-seen", "true");
```

Version the key (`onboarding-v2-complete`) so a significant product update can re-trigger a targeted re-onboarding without losing the old state.

**IMPORTANT**: Don't show the same onboarding twice. Track completion, track dismissals, and honor both.

### Deep-Link Re-Entry

Users who leave mid-onboarding and return via a deep link must not be dumped back at screen 1. Check onboarding state on deep-link entry:

```tsx
// In your deep-link handler:
const onboardingState = await getOnboardingState(); // step reached + permissions granted
if (!onboardingState.complete) {
  router.replace("/onboarding", { step: onboardingState.lastStep });
}
```

Test this explicitly — cold launch, partial state, deep link re-entry are three different code paths.

## Platform-Specific First-Run

### iOS

- Sign in with Apple is required if any other social login is offered (App Store Guideline 4.8)
- ATT prompt must be primed before triggering if analytics/ads are in use
- `expo-splash-screen` `hideAsync()` after fonts + auth + data — first frame must not flash

### Android

- `BackHandler` on the first onboarding screen — don't let back exit the app
- Notification permission is grantable at runtime from Android 13+; below Android 13, it's auto-granted — gate the `requestPermissionsAsync()` call on the SDK version check `expo-notifications` handles internally
- Material ripple (`android_ripple`) on onboarding CTAs when `Platform Fidelity` is `material-everywhere` or `cupertino-android-pragmatic`

### Both

- Test VoiceOver (iOS) and TalkBack (Android) end-to-end through the full onboarding flow. Screen readers must be able to complete every step independently
- Every onboarding screen needs `accessibilityRole` on all interactive elements, logical focus order, and no coach-mark overlay that traps focus without a dismiss mechanism

## Verify Onboarding Quality (Constitution Principle IV)

Test on **both platforms**. iOS-only onboarding verification is a Principle IV gate failure.

**Flow integrity**:

- [ ] Full onboarding flow on iOS Simulator (iPhone 15 or current) — cold launch, no cached state
- [ ] Full onboarding flow on Android Emulator — cold launch, no cached state
- [ ] Partial onboarding → force quit → relaunch → lands on correct step
- [ ] Deep-link re-entry after partial onboarding → correct resume state
- [ ] Returning user who already completed onboarding → sees no onboarding screens

**Permissions**:

- [ ] Permission grant path: priming screen → system prompt → granted → feature unlocks
- [ ] Permission deny path: priming screen → system prompt → denied → graceful fallback with `Linking.openSettings()` CTA
- [ ] Permission revoked externally (via iOS/Android Settings mid-session) → app handles gracefully on next feature entry
- [ ] Notification opt-in fires after first win, not on cold launch

**Accessibility**:

- [ ] VoiceOver: full onboarding flow navigable and completable
- [ ] TalkBack: full onboarding flow navigable and completable
- [ ] Dynamic Type at 2× — every onboarding screen, no clipped headlines, no truncated CTAs
- [ ] `useReducedMotion()` respected — onboarding animations substitute a simple fade when true

**Display + layout**:

- [ ] Dynamic Island (iPhone 14/15 Pro) — splash transition does not overlap island
- [ ] Small screen (iPhone SE or compact Android) — content doesn't scroll behind CTAs
- [ ] Landscape orientation (if supported) — onboarding layouts hold

**State**:

- [ ] `AsyncStorage` onboarding flag written on completion — not on first screen entry
- [ ] Coach marks track their shown state — never shown twice
- [ ] Skip path stores the same completion flag as the full path

**Metrics to check post-launch**:

- D1 retention rate (did onboarding get users to a reason to return?)
- Permission grant rates by type
- Time-to-first-value (measured action, not screen completion)
- Skip rate per onboarding screen (high skip = screen not earning its place)
- Drop-off screen (where users stop — the aha moment is downstream of here)

When users hit the aha moment fast and don't drop off, hand off to `/impeccable-native polish` for the final pass.

**NEVER**:

- Show the system permission prompt cold (no priming screen)
- Ask for all permissions on launch
- Hide the splash before fonts + auth are resolved
- Force users through 4+ onboarding screens before the product
- Re-show onboarding to users who already completed it
- Ask personalization questions that don't change the product
- Use a confirmation dialog where "Not now" would work
- Let Android back exit the app on the first onboarding screen
- Treat iOS-only testing as platform parity
- Show the same coach mark more than once
