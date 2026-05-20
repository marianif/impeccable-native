# Craft Flow

Build a React Native / Expo feature with impeccable UX and UI quality: shape the design, land the visual direction, build real production code, inspect on iOS Simulator and Android Emulator until it meets a high-end studio bar — on both platforms.

Before writing code, you need: PRODUCT.md loaded, register identified and the matching reference loaded, the flavor detector run for this session, and a confirmed design direction for this task (either from `shape` or supplied by the user). PRODUCT.md is project context, not a task-specific brief.

Treat any approved visual direction (generated mock or stated reference) as a concrete contract for composition, hierarchy, density, atmosphere, signature motifs, and distinctive visual moves. Mocks don't replace structure, copy, accessibility, or state design — but if the running app on simulator lacks the approved direction's major ingredients, the implementation is wrong.

### Gates: do not compress

Craft has **multiple user gates**, not one. When the harness has native image generation (Codex via `image_gen`), the gate sequence before code is:

1. **Shape brief confirmed** (Step 1)
2. **Direction questions answered** (codex.md Step A)
3. **Palette confirmed** (codex.md Step B)
4. **One mock direction approved or delegated** (codex.md Step D)

Stop at every gate. **Shape confirmation alone is not a green light to start coding.** It is the green light to begin codex.md Step A. Compressing gates 2 through 4 because the shape brief felt complete is the dominant failure mode of this flow.

When the harness lacks native image generation, gates 2–4 collapse into the brief itself, and shape confirmation does advance straight to code.

## Step 0: Project Foundation

Before shape, before code: confirm what kind of mobile project you're working in. Run the flavor detector:

```bash
node {{scripts_path}}/detect-rn-flavor.mjs
```

The output tells you what to use:

- **`flavor`** — `expo` means use Expo SDK packages (`expo-image`, `expo-haptics`, `expo-font`, `expo-blur`, `expo-linear-gradient`). `bare` means use community equivalents (`react-native-fast-image`, `react-native-haptic-feedback`, etc.).
- **`router`** — `expo-router` means file-based routes under `app/`; create new screens as files. `react-navigation` means imperative navigation via stack/tab navigators; add screens to the existing navigator definitions.
- **`styling`** — `stylesheet` (default) means emit `StyleSheet.create` + `tokens.ts` imports. `nativewind` means the project consumes Tailwind class names; mirror tokens through `tailwind.config.ts` and emit class strings, but the `tokens.ts` module stays the source of truth.
- **`newArch`** — `true` means Fabric and TurboModules are on; use the modern interop pattern for any native code or third-party library.
- **`sdkVersion` / `rnVersion`** — gate APIs that depend on a minimum (e.g. `gap` in flexbox lands at RN 0.71, file-based routes at Expo SDK 50, New Architecture default at RN 0.76).

Then read the project surface:

- **Existing screens and components**: scan the routes / screens directory and `components/` (or `src/components/`). Read 3–5 representative files end to end to learn the conventions — how styles compose, how navigation parameters flow, how theming is consumed.
- **Existing token system**: `tokens.ts`, `theme.ts`, or whatever `load-context.mjs` surfaced. If absent, nudge `{{command_prefix}}impeccable-native document` once and proceed with sensible defaults.
- **Existing icon set**: most RN projects use one of `@expo/vector-icons` (Ionicons / Material / Feather…), `lucide-react-native`, `@tabler/icons-react-native`, or hand-rolled SVGs via `react-native-svg`. Use what's already there.
- **Existing animation primitive**: Reanimated 3 (`useSharedValue` / `useAnimatedStyle`), Moti, or the bare `Animated` API. Match the project's choice rather than introducing a second one.
- **Safe-area handling**: confirm `react-native-safe-area-context` is installed and that a `SafeAreaProvider` wraps the app. New screens read `useSafeAreaInsets()` rather than hardcoding device insets.

If the directory is empty (greenfield), confirm the foundation via the AskUserQuestion tool, with sensible defaults framed by PRODUCT.md:

```text
What should this be built on?
  - Expo + Expo Router (recommended default for new mobile apps — managed workflow, file-based routes, OTA updates)
  - Expo + React Navigation (when the team prefers imperative navigation or has existing patterns)
  - Bare React Native (when the project needs native modules Expo doesn't ship, or matches an existing native codebase)
```

Ask once; don't re-ask mid-task.

## Step 1: Shape the Design

Run `{{command_prefix}}impeccable-native shape`, passing along whatever feature description the user provided. Shape is **required** for craft; it is what produces a confirmed design brief specific to this task.

Present the shape output and stop. Wait for the user to confirm, override, or course-correct before writing code.

If the user already supplied a confirmed brief or ran shape separately, use it and skip this step.

When the original prompt + PRODUCT.md already answer scope, content, and visual direction with no real ambiguity, the shape output can be **compact** (3–5 bullets stating what you're building, the visual lane, target screens/devices, and platform fidelity stance, ending with one or two specific questions or "confirm or override"). The full structured brief is reserved for genuinely ambiguous, multi-screen, or stakeholder-heavy tasks. Don't pad a clear brief to look thorough; equally, don't skip the pause to look efficient.

If the harness has native image generation, a compact shape's "confirm or override" advances to **Step 3 and the codex.md flow**, not to Step 4. Phrase the closing line accordingly: *"Confirm or override; once we lock direction, I'll run a couple of palette and reference questions before generating any mocks."* This stops the model from reading shape confirmation as code-green.

## Step 2: Load References

Based on the design brief's "Recommended References" section, consult the relevant impeccable-native reference files. At minimum, always consult:

- [spatial-design.md](spatial-design.md) for screen composition, safe areas, touch-target spacing
- [typography.md](typography.md) for type hierarchy and Dynamic Type behavior

Then add references based on the brief's needs:

- Gestures, transitions, or springs? Consult [motion-design.md](motion-design.md) and [animate.md](animate.md)
- Lists, scrolling, or large data sets? Consult [layout.md](layout.md) (FlatList / SectionList / FlashList patterns)
- Forms or multi-step flows? Consult [interaction-design.md](interaction-design.md)
- Color-heavy or themed surfaces? Consult [color-and-contrast.md](color-and-contrast.md)
- Tablet, foldable, or Dynamic Type support? Consult [adapt.md](adapt.md) and [responsive-design.md](responsive-design.md)
- Copy, labels, errors, accessibility announcements? Consult [ux-writing.md](ux-writing.md)
- Skia, complex effects, or 60-fps-critical surfaces? Consult [overdrive.md](overdrive.md)

## Step 3: Visual Direction & Assets (Harness-Gated)

If the harness has **native image generation** (currently Codex via `image_gen`), this step is mandatory. **Stop and load [codex.md](codex.md).** It covers palette generation, mock exploration, the approval loop, mock-fidelity inventory, and asset slicing via the `impeccable_asset_producer` subagent. Follow Steps A–F in that file, then return here for Step 4.

If the harness lacks native image generation, state in one line that the visual-direction-by-generation step is being skipped because the harness lacks native image generation, then proceed. The one-line announcement is required; it forces a conscious decision instead of letting the step quietly evaporate. The brief is the visual reference. Implement directly from it, treating any named anchor references (apps, products, brand moments) and the brief's "Design Direction" as the contract.

Mock or no mock: image-led briefs (food, travel, fashion, hospitality, photography, editorial, social) need real or sourced imagery in the build. Use `expo-image` (or `react-native-fast-image` on bare RN) with proper `contentFit` / `resizeMode`, low-resolution placeholders or blurhash, and explicit `width`/`height` so layout doesn't shift on load.

## Step 4: Build to Production Quality

**Precondition.** If Step 3 routed you to codex.md (native image generation available), Steps A through D in that file must be complete before any code: questions answered, palette confirmed, mocks generated, one direction approved or delegated. **Don't mention implementation, file paths, or patch plans until that's done.** The model that compressed those gates is the model that already failed this flow.

Implement the feature following the design brief. Build in passes so structure, token consumption, screen states, motion, gestures, platform parity, and accessibility each get deliberate attention. The list below is the definition of done.

### Production bar

- **Real content.** No placeholder copy, dummy images, dead navigation routes, fake controls, or unused scaffold at presentation time.
- **Preserve the approved mock's major ingredients.** Missing hero objects, imagery, screen structure, tab/nav treatment, or distinctive motifs are blocking defects unless the user accepted the change.
- **Token-bound styling.** Colors, type, spacing, radius, shadow, motion all read from `tokens.ts` via `useTheme()`. New one-off values get added to `tokens.ts` first, then consumed.
- **Light and dark both work.** Flip the simulator to dark mode and re-inspect every screen. Contrast holds, accents stay legible, no hardcoded near-white surfaces glow on OLED.
- **Safe areas observed.** Every screen reads `useSafeAreaInsets()` (or wraps in `SafeAreaView` with `edges` set). Tab bars, sticky headers, modal sheets, FABs respect the home indicator and notch.
- **Touch targets ≥ 44pt iOS / 48dp Android.** Pressables, icon buttons, tab items, list-row affordances meet the minimum. If two targets are visually small, ensure enough hit-slop and spacing that thumbs don't mis-tap.
- **Accessible by default.** `accessibilityRole`, `accessibilityLabel`, `accessibilityHint` (when behavior isn't obvious), `accessibilityState` for toggles/tabs. Test with VoiceOver on iOS and TalkBack on Android — the screen should narrate as a coherent flow.
- **Dynamic Type tolerant.** Run the screen at 2× font scale (iOS Settings → Accessibility → Display & Text Size → Larger Text; Android Settings → Display → Font size). Layout reflows, hierarchy holds, nothing clips.
- **Deliberate spacing and rhythm.** Spacing comes from `tokens.space`. Default flex gaps and arbitrary literals are tells; consistent vertical rhythm is a signature.
- **Intentional typography.** Custom fonts loaded via `expo-font` before the splash clears. Clear hierarchy from `tokens.type`. Lines wrap where they should; no clipped descenders at large Dynamic Type.
- **Realistic state coverage.** Default, pressed, focused, disabled, loading (skeleton or shimmer), error, success, empty, long content, first-run. List screens cover empty, populated, paginating, refreshing, end-reached.
- **List performance.** FlatList / SectionList / FlashList with stable `keyExtractor`, `getItemLayout` when row height is known, `removeClippedSubviews` on long lists, memoized `renderItem`. Styles for rows live in `StyleSheet.create`, not inline.
- **Finished interaction quality.** Press feedback timed (Pressable's `pressed` state plus optional spring), gesture conflicts resolved (use `react-native-gesture-handler` for anything beyond a Pressable), scroll-into-view on focus, keyboard avoidance via `KeyboardAvoidingView` with the correct `behavior` per platform.
- **Premium motion.** Reanimated 3 worklets for shared values, springs for natural deceleration, Skia for ambitious effects when the brief asks. Animate `transform` and `opacity`. Respect `useReducedMotion()` — substitute a snap or fade when it returns `true`.
- **Platform parity.** Inspect on both iOS Simulator and Android Emulator before declaring complete. Shadows use the `.ios` + `.android` split. Haptics use `expo-haptics` (or `react-native-haptic-feedback` on bare) with platform-appropriate types. Ripple appears on Android Pressables when the platform fidelity stance asks for it.
- **Coherent icon set.** Use the project's established set; otherwise pick one library and stay in it.
- **Imagery handled correctly.** `expo-image` or FastImage, explicit dimensions, `contentFit`, blurhash or low-res placeholder for hero images, lazy load for off-screen rows, MP4/HLS through `expo-av` or `react-native-video` for motion.
- **Respect the build pipeline.** Edit source files. For Expo, the app runs through `expo start` and hot-reloads. For bare RN, `npx react-native run-ios` / `run-android`. Don't hand-edit native build artifacts; if a native change is needed, run `expo prebuild` and document the eject.
- **Technically clean.** Metro bundles without warnings, no red-screen errors, no needless dependencies, no unused state or props, no orphaned navigation routes.
- **Ask when uncertain.** If a discovery materially changes the brief or approved direction, stop and ask.

## Step 5: Iterate on Simulator and Emulator

Look at what you built like a designer would. Your eyes are whatever the harness gives you: iOS Simulator, Android Emulator, a physical device via Expo Go or a dev build, `node {{scripts_path}}/screenshot.mjs`, Maestro, Detox, or asking the user.

**Constitution Principle IV — Platform parity is a hard gate.** Inspect on iOS Simulator and Android Emulator before declaring the work complete. iOS-only verification is a failure mode, not an MVP.

If your screenshot tool returns a file path, read the PNG back into the conversation. A screenshot you didn't read doesn't count.

Inspect across a representative device matrix:

- **iOS:** iPhone SE (small, no notch), iPhone 15 (modern Dynamic Island), iPhone 15 Pro Max (large, ProMotion at 120 Hz). If tablet is in scope per PRODUCT.md Primary Devices, add iPad.
- **Android:** Pixel 7 (modern, ~6"), a small device (Pixel 4a or smaller), and one larger / foldable if Primary Devices includes it.
- **Themes:** light and dark.
- **Text scale:** default and 2×.

For long scrolling screens or onboarding flows, inspect each section individually. Thumbnails hide clipping, mis-rounded shadows, and platform divergence.

After the first pass, write an honest critique against the brief, the approved mock's major ingredients (hero silhouette, motifs, imagery, nav/CTA, density), platform parity, and accessibility. Patch material defects and re-inspect. Don't invent defects to demonstrate iteration. A confident "first pass clean, shipping" beats a fabricated fix.

Actively check: platform parity (iOS vs Android visual deltas, shadow rendering, font fallbacks), every state (empty / error / loading / pagination / refresh / edge), craft details (spacing, alignment, hierarchy, contrast, motion timing, focus rings on TVs/keyboards if in scope), gesture and scroll smoothness on a real device when available, accessibility narration via VoiceOver and TalkBack, Dynamic Type at 2×. The exit bar: defensible in a high-end studio review, on both platforms.

Audit-tool output (`platform-parity.mjs`, `a11y-audit.mjs`) is defect evidence only; never proof the work is finished.

## Step 6: Present

Present the result to the user:

- Show the feature in its primary state on at least one iOS and one Android device.
- Summarize the device matrix checked (iOS devices, Android devices, light/dark, Dynamic Type 2×) and the most important fixes made after inspection.
- Walk through the key states (empty, loading, error, refresh, success).
- Explain design decisions that connect back to the design brief and, when used, the chosen north-star mock. Include any accepted deviations from the mock; do not hide unimplemented ingredients.
- Note any platform-specific compromises honestly (e.g. "Android shadow uses elevation 6 to match the iOS `shadowRadius: 8`; rendering differs slightly but the hierarchy reads the same on both").
- Note any remaining limitations or follow-up risks honestly.
- Ask: *"What's working? What isn't?"*
