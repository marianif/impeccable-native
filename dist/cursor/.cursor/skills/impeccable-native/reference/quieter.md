Quiet design is harder than bold design. Subtlety needs precision. Reduce visual noise in React Native screens that are overstimulating — too many accents, heavy shadows, shouting type, decorative motion — without losing personality or turning the app into stock Material 3.

---

## Register

Brand: "quieter" means more restrained palette, more whitespace, more typographic air, fewer hero moments per screen. Drama is reduced, not eliminated; the POV stays intact.

Product: "quieter" means reducing chrome and ceremony. Fewer surface elevations, lighter borders, less color, less motion, fewer haptic pings. The tool should disappear more completely into the task.

---

## Assess Current State

Analyze what makes the screen feel too intense. On mobile, the viewport is small and the user is one-handed and often interrupted — noise costs more here than on desktop.

1. **Identify intensity sources**:
   - **Color saturation**: Accent tokens used too often, or tuned too vibrant (especially on dark surfaces where saturated colors vibrate).
   - **Surface noise**: Cards everywhere, drop shadows on every row, gradients on buttons, glassy `expo-blur` panels stacked on top of busy backgrounds.
   - **Typographic shouting**: Display tokens used inside content, multiple weights per screen, all-caps tracking on small labels, headlines wrapping to three lines.
   - **Motion excess**: Spring overshoot on chrome, parallax on every scroll, layout animations on every list mount, decorative Skia loops.
   - **Pattern overload**: FAB plus bottom tabs plus header CTA plus floating banner — three primary actions on one screen.
   - **Haptic spam**: Haptic on every press, every tab switch, every toggle. Mobile users feel this in their hand; cumulative noise is real.
   - **Chrome creep**: Hamburger overlapping bottom tabs, persistent search bars, sticky banners eating the safe area.

2. **Understand the context**:
   - What's the platform-fidelity stance in `PRODUCT.md`? `cupertino-everywhere` and `material-everywhere` quiet differently.
   - What's the screen's job? A reading view, a task list, and a celebratory unlock screen tolerate different noise floors.
   - What's working? Don't strip the personality with the chrome.

If the brief or context is unclear from the codebase, ask the user directly to clarify what you cannot infer.

**CRITICAL**: "Quieter" doesn't mean stock-iOS or stock-Material. It means refined and easier on the eyes while the brand still survives. Think Things 3, not Apple Reminders.

## Plan Refinement

Create a strategy to reduce intensity while maintaining impact:

- **Color approach**: Desaturate, or use the same accent less often? (Often the second is enough.)
- **Hierarchy approach**: Which one element per screen stays bold; which recede to `tokens.color.textSecondary` and `tokens.border.subtle`?
- **Chrome approach**: What can be deleted entirely — the FAB, the gradient header, the second tab indicator, the duplicate confirmation toast?
- **Motion approach**: Which animations are functional (orientation, state continuity) and which are decoration (entrance flourishes, stagger on every list)?
- **Platform approach**: Quiet the Android ripple intensity, drop iOS shadow alpha, respect OLED true-black only where it's intentional.

**IMPORTANT**: Subtlety requires precision. Quiet without intent collapses to generic. Every cut should have a stated reason.

## Refine the Design

Systematically reduce intensity across these dimensions. Edits land in `tokens.ts` first, then in component styles — never in scattered inline overrides.

### Color Refinement

- **Reduce accent frequency before reducing saturation.** The 60-30-10 rule (color-and-contrast.md) is most often violated on the 10. One accent appearance per screen — primary CTA, active tab indicator, or focus state, not all three.
- **Cool the accent in `tokens.color.light` and `tokens.color.dark` together.** Drop chroma 20–30% in OKLCH source, re-emit hex, recheck WCAG AA against both themes. Saturated brand colors on dark surfaces vibrate; quiet the dark-mode variant more aggressively than the light one.
- **Tinted neutrals stay tinted, but flatter.** Reduce the chroma step between `background` and `surface` so the elevation reads as one surface, not a stack of layers. On dark mode this often means collapsing a 3-step surface scale to 2.
- **Never gray on color.** If body text sits on a colored card, use a darker tone of that card's hue or an alpha-on-neutral overlay (see `scrimPress` pattern). Gray-on-color reads as washed out and lazy.
- **OLED warning.** `#000000` backgrounds are genuinely quiet *only* when nothing on top of them glows. A saturated accent on true black looks louder, not quieter, because of OLED's per-pixel contrast. If you go OLED-black for quietness, also drop accent saturation in the dark token set.
- **Status bar and Android nav bar match the screen's background**, not the accent. Match-and-disappear, don't tint-to-brand.

### Surface & Chrome Reduction

- **Cards-as-default is noise.** A list of cards on a mobile screen is usually a list with dividers and breathing room. Replace each `View` with `shadow` + `borderRadius` + `backgroundColor: surface` with a flat row separated by `borderBottomColor: tokens.color.border.subtle, borderBottomWidth: StyleSheet.hairlineWidth`.
- **Quiet the shadow token, don't kill it.** In `tokens.shadow`, lower iOS `shadowOpacity` to 0.04–0.06, `shadowRadius` to 6–8, and Android `elevation` to 1–2. Keep the platform split (`Platform.select`) so neither platform inherits the other's noise model.
- **Delete the FAB unless the action is the screen's job.** FAB-as-default is the most common RN noise pattern. If the primary action is reachable from a header button, a row swipe, or a bottom-tab destination, the FAB is decoration.
- **Hamburger over bottom tabs is double chrome.** Pick one navigation surface. If bottom tabs exist, the drawer is usually a noise duplicate of settings + profile + about.
- **Bottom-sheet-for-everything is loud.** Sheets cost a backdrop scrim, a grabber, a snap animation, and a dismissal gesture — all noise. For 1–3 simple actions, prefer an inline Pressable or an iOS-style context menu (`@react-native-menu/menu`). Reserve `@gorhom/bottom-sheet` for content that genuinely needs filtered focus.
- **Modal-first is loud.** A full-screen modal stack for a 4-field form is theatrical. Inline the form into the host screen unless modality is the point (auth, payment, irreversible action).
- **Tab bar restraint.** Icons-only or labels-only, not both with bold color on the active state. The active tint is the accent; everything else is `tokens.color.textTertiary` on `tokens.color.surface`.

### Typographic Quieting

- **Demote the display role.** A 36+ display token on a tool screen is shouting. Step one role down — headline (24) for screen titles, title (18) for sections. Reserve display for splash, onboarding, and genuine hero moments.
- **Tighten `lineHeight` only where text is short.** Chrome labels (`label`, `caption`) at `lineHeight: fontSize * 1.2` read tighter and less performative. Body and long-form keep their generous `lineHeight` — quiet doesn't mean cramped.
- **Drop a weight.** Replace `'800'` headlines with `'600'`, `'700'` titles with `'500'`. Pair one weight contrast per screen, not three.
- **Avoid all-caps tracking** on labels unless it's a deliberate brand signature. All-caps + `letterSpacing: 1.5` on tabs and section headers is the loudest typographic move you can make.
- **Truncate, don't wrap, in chrome.** Tab labels, list row titles, and header titles get `numberOfLines={1}` and `ellipsizeMode="tail"`. Wrapping chrome creates uneven row heights that read as noise.
- **`maxFontSizeMultiplier` is for chrome, not body.** Cap Dynamic Type scaling on tab labels and badges (`maxFontSizeMultiplier={1.3}`) so the layout doesn't deform. Body text scales freely — that's accessibility, not noise.

### Motion Quieting

- **Replace springs with timing on chrome.** A tab indicator that springs (overshoot, oscillation) is loud. Use `withTiming(target, { duration: 200, easing: Easing.out(Easing.quart) })` for chrome state changes. Reserve `withSpring` for gesture-driven motion (sheet snap, pan-to-dismiss) where physics is the point.
- **Lower spring damping ratio toward critical.** Where springs stay, bump damping (e.g. `damping: 22, stiffness: 220`) so overshoot disappears. The "Soft" preset from motion-design.md is the quiet ceiling.
- **Shorten the motion tokens, don't delete them.** `tokens.motion.duration.normal` from `300` → `220`; `slow` from `500` → `350`. Faster *is* quieter — long animations draw more attention.
- **Strip decorative entrance choreography.** `FadeInDown.delay(index * 50)` on every list mount is a tic. Reanimated layout animations earn their place for genuine layout change (insertion, reorder), not for first paint.
- **Respect `useReducedMotion()` aggressively.** When reducing for quietness, the reduce-motion branch is your design north star — if the screen still works without the motion, the motion was decoration.
- **Scroll-driven effects: at most one per screen.** Parallax header *or* sticky-shrink title *or* fade-on-scroll — never all three.

### Interaction Quieting

- **Android ripple intensity.** If `platform-fidelity` is `cupertino-everywhere`, replace `android_ripple` on Pressable with an opacity-only press state to match iOS feel. If `cupertino-android-pragmatic`, keep the ripple but tune `android_ripple={{ color: tokens.color.scrimPress, borderless: false }}` to a subtle scrim, not the brand accent.
- **Press feedback is one channel, not three.** Color swap *or* scale spring *or* haptic — pick one per interaction tier. Tertiary actions get color swap only; primary actions can earn the haptic.
- **Haptics: keep the peaks, drop the filler.** Remove `Haptics.selectionAsync()` on every tab switch and scroll snap. Keep `Haptics.notificationAsync('success')` on completion, `'light'` impact on consequential confirmations. Haptics paired with motion peaks (not motion ends) read as response; haptics on every press read as noise the user can feel in their thumb.
- **Skeletons over spinners; nothing over skeletons when load is sub-200ms.** A skeleton on a 120ms fetch flashes and feels noisier than no skeleton at all.

### Composition Refinement

- **Reduce scale jumps in chrome.** Big difference between display and body is fine; *between* tab label, badge, and chip should be ~2pt, not 6pt.
- **Even the spacing.** Replace ad-hoc `marginTop: 13, marginBottom: 22` with `tokens.space` steps. Most quietness lives in spacing consistency, not in spacing volume.
- **Align to the safe area, not on top of it.** Headers and bottom bars compose `useSafeAreaInsets()` with `tokens.space`, not magic numbers. Chrome that overlaps the dynamic island or home indicator reads as broken first, loud second.

**NEVER**:
- Strip the accent token entirely (quiet ≠ grayscale; the POV dies).
- Collapse all type to one size/weight (hierarchy still carries the screen).
- Disable all motion (functional motion — loading state, focus, orientation — stays).
- Remove platform-split shadows entirely (a totally flat Android app reads as a wireframe; keep `elevation: 1`).
- Apply the same quietness recipe to brand and product registers — a landing onboarding flow and a settings screen tolerate different noise floors.
- Shrink touch targets to reduce visual weight — minimum stays `44pt` (iOS) / `48dp` (Android). Use padding-not-pixels to quiet a button.
- Sacrifice WCAG AA contrast for "softer" surfaces. Recheck both themes against emitted hex after every color cut.

## Verify Quality

Open the screen on both **iOS Simulator and Android Emulator** (Constitution Principle IV — quietness that only renders on the platform you happen to be running is incomplete). Test in light, dark, and OLED-black where applicable. Toggle Dynamic Type to 2× and Reduce Motion in both simulators.

Check:

- **Still functional**: Primary action discoverable within 1 second of screen load? Tap targets still ≥44pt?
- **Still distinctive**: With brand colors and tokens hidden, is the screen recognizable as *this* app, or could it be any RN starter?
- **Better reading**: Long-form content easier to track? Hierarchy doing the work that color and weight used to?
- **Restrained, not absent**: One accent appearance per screen carries the brand? Headlines still pull the eye?
- **Quiet on both platforms**: iOS shadow + Android elevation tuned independently. Ripple feel matches the `platform-fidelity` stance.
- **Reduce-motion is the design floor**: With Reduce Motion on, the screen still tells its story without the decorative motion you removed.

If a Skia or `expo-blur` effect survived the cut, justify it — bounded area, one per screen, paired with a clear purpose (focus pull, depth signal). Open effects that re-render every frame on a full-screen Skia surface get re-evaluated; perceived quietness collapses when the GPU works that hard.

When the result feels right, hand off to `/impeccable polish` for the final pass.
