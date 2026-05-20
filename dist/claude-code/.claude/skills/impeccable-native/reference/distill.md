Strip a React Native surface to its essence. Remove anything that doesn't earn its place: redundant `View` wrappers, repeated screens, decorative cards, token sprawl, modals that should have been inline.

This is the cut pass. Before reaching for `polish`, make sure there's nothing left to take away.

Before scanning: confirm the flavor detector has run (`node .claude/skills/impeccable-native/scripts/detect-rn-flavor.mjs`) and that `load-context.mjs` has surfaced PRODUCT.md + DESIGN.md. Distill against the project's actual register, `Platform Fidelity`, and `Primary Devices` — what's essential on a phone-only consumer app is not what's essential on a phone-tablet productivity tool.

---

## Assess Current State

Analyze what makes the surface feel complex, cluttered, or padded:

1. **Identify complexity sources**:
   - **Too many elements**: competing CTAs in a header, two `Pressable`s where one would do, decorative icons that don't carry meaning, "hero metrics" cards (3 big numbers) without earned data.
   - **Excessive variation**: 14 grays in `tokens.color`, three near-identical `Card` variants, four button sizes when two cover 90% of cases, two type ramps in flight at once.
   - **Information overload**: every preference visible on the main settings screen, every filter exposed at once, every metric shown before the user has scrolled.
   - **Visual noise**: borders on cards that are already separated by spacing, shadows on every surface, gradient backgrounds behind already-tinted surfaces, divider lines between rows that are already separated by `gap`.
   - **Confusing hierarchy**: three things competing for primary action, four type roles when three would carry the same meaning.
   - **Container creep**: nested `View` wrappers where a single one with the right style would suffice, `<View><View><Text /></View></View>` triple-wraps, cards inside cards inside cards.
   - **Screen creep**: a stack route for what should be a bottom sheet, a modal for what should be an inline expand, six bottom tabs when four would do.

2. **Find the essence**:
   - What's the primary user goal on this screen? (There should be ONE.)
   - What's actually necessary vs nice-to-have on a phone in a thumb in motion?
   - What can be removed, hidden behind a sheet, or merged into a sibling?
   - What's the 20% that delivers 80% of value?

If any of these are unclear from the codebase or PRODUCT.md, STOP and call the AskUserQuestion tool to clarify.

**CRITICAL**: Simplicity is not about removing features. It's about removing obstacles between users and their goals on a small screen. Every `View`, every screen, every token should justify its existence.

## Plan Simplification

Create a ruthless editing strategy:

- **Core purpose**: what's the ONE thing this screen should accomplish?
- **Essential elements**: what's truly necessary to achieve that purpose on a phone?
- **Progressive disclosure**: what can move into a bottom sheet, a context menu, a long-press action, or a secondary screen?
- **Consolidation opportunities**: which components, screens, or tokens can collapse into one?

**IMPORTANT**: Simplification is hard. It requires saying no to good ideas to make room for great execution. Be ruthless. The hardest cuts are usually the right ones.

## Simplify the Design

Systematically remove complexity across these dimensions.

### Information Architecture

- **Reduce scope**: remove secondary actions, optional fields, redundant rows. If a setting is touched by 2% of users, it belongs deeper.
- **Progressive disclosure**: hide complexity behind clear entry points — a bottom sheet (`@gorhom/bottom-sheet`), a context menu (long-press / `expo-context-menu`), an inline accordion, or a sub-screen pushed onto the stack only when the user opts in.
- **Combine related actions**: merge "Edit" + "Delete" + "Share" into a single context menu on long-press. Merge multi-step forms into a single sheet with smart defaults.
- **Clear hierarchy**: ONE primary action per screen, few secondary actions, everything else tertiary or hidden behind disclosure.
- **Remove redundancy**: if the header says it, the section title shouldn't repeat it. If the empty-state illustration shows it, the empty-state body shouldn't describe it.

### Navigation Simplification

- **Collapse screens into sheets where the interaction is transient**: picking a value, confirming an action, editing a single field, applying a filter — all of these are bottom sheets, not pushed screens. A pushed screen earns its slot when the user enters a new context (a detail view, a settings sub-area, a multi-step flow).
- **Merge near-identical screens behind a param**: `EditProfile` and `EditPaymentMethod` rendering the same form shell with different fields should be one parameterized screen, not two routes.
- **Cap bottom tabs at 5**: six tabs cramp labels and lose touch-target spacing. If you have six, one of them is probably a sub-destination of another.
- **Don't ship a hamburger when bottom tabs would fit**: if you have 3–5 primary destinations, tabs win on every metric.
- **Remove "loading" intermediate screens**: a spinner-only screen between A and B is almost always avoidable with optimistic UI or a skeleton on the destination.
- **One nav pattern at a time**: don't mix drawer + tabs + stack + modal carousel on the same flow. Pick the simplest composition that covers the destinations.

### Visual Simplification

- **Reduce color palette**: 1 accent + neutrals + semantic (success / warning / error) is enough for most apps. Prune `tokens.color` to ~3 surfaces, ~3 text roles, ~1–2 accents, ~3 semantic. If you have 14 grays, you have 5 grays and 9 mistakes — collapse to a step scale that matches `tokens.space` (`gray-1` through `gray-5`).
- **Limit typography**: 1 font family, 5 size roles maximum (`display`, `title`, `body`, `label`, `caption`), 2–3 weights. If `tokens.type` has 9 roles, find the duplicates that differ by 1 pt or one weight and merge them.
- **Remove decorations**: borders, shadows, and backgrounds that don't serve hierarchy or function. If a card is already separated from its siblings by `gap`, it doesn't need a border. If a `FlatList` row is already separated by a divider, it doesn't also need a `marginBottom` plus a card background.
- **Flatten the view tree**: collapse redundant `View` wrappers — prefer style on the parent over a wrapping `View`, use `React.Fragment` (`<>...</>`) where a parent isn't needed for layout. A `<View><View><Text /></View></View>` where the middle `View` carries only `flex: 1` should be one `View`.
- **Remove unnecessary cards**: cards aren't needed for basic layout — spacing and alignment carry hierarchy. Never nest a card inside a card. A "card grid" of identical cards is almost always a `FlatList` of rows with a divider.
- **Consistent spacing**: consume only `tokens.space` steps. Inline `padding: 13` or `marginTop: 7` is a finding — there's a token nearby that does the job.
- **Platform-split shadow tokens, not shadow stacking**: one shadow per elevated surface, consumed via `Platform.select` against `tokens.shadow.<role>`. Stacking shadows or duplicating elevation with both `shadowColor` and a border is noise.

### Layout Simplification

- **Linear flow over grids**: Yoga defaults to column for a reason — most mobile screens are vertical lists with the occasional row. Reach for `FlatList` / `SectionList` before reaching for a 2D grid.
- **Single canonical scroller**: never nest a `ScrollView` inside a `ScrollView` (same axis) — it breaks scroll handoff and is almost always a sign you should have used `FlatList` with `ListHeaderComponent` / `ListFooterComponent`.
- **Use the safe areas generously, then stop**: insets clear the home indicator and notch — they don't define content padding. One `useSafeAreaInsets()` read per screen, then `tokens.space` carries the rest.
- **Consistent alignment**: pick `flex-start` or `center` and stick with it. Mixed alignments per row read as visual stutter.
- **Generous vertical rhythm**: let content breathe. A phone screen with everything packed to fit reads as worse than one that scrolls a single tap more.

### Interaction Simplification

- **Reduce choices on screen**: fewer buttons, fewer toggles, clearer path forward. Paradox of choice is worse on mobile — less screen, less attention.
- **Smart defaults**: make common choices automatic, only ask when necessary. A radio of 4 options with one obvious default should ship with the default applied silently.
- **Inline actions over modals**: replace a "rename" modal with an inline-editable `TextInput`. Replace a "select category" full-screen route with an inline `Picker` or a bottom sheet.
- **Undo over confirm**: a destructive action with an undo toast (5–7 seconds) beats a confirm modal on every metric — fewer taps, no flow break, recoverable.
- **Remove steps**: can sign-up be one screen instead of three? Can checkout collapse from 4 steps to 2? Multi-step is a tax — only charge it when the steps protect against real errors.
- **Clear CTAs**: ONE obvious next step in the bottom CTA slot, not five competing actions. If the screen has two equally-weighted primary buttons, one of them isn't primary.

### Content Simplification

- **Shorter copy**: cut every sentence in half, then do it again. On mobile, a 4-line paragraph reads as a wall.
- **Active voice**: "Save changes" not "Changes will be saved." "Delete account" not "Account deletion will be performed."
- **Remove jargon**: plain language always wins; mobile readers skim more aggressively than web.
- **Scannable structure**: short paragraphs, single-line list rows where possible, clear headings.
- **Essential information only**: no marketing fluff in product surfaces, no legalese outside of legal screens, no hedging.
- **Remove redundant copy**: no headers restating the screen title, no empty-state body restating the illustration, no helper text restating the field label.

### Code Simplification

- **Remove unused code**: dead `StyleSheet.create` blocks, unused components, orphaned screens still mounted in the navigator, dead `Platform.select` branches.
- **Flatten component trees**: reduce nesting depth — the squint test applies to the JSX tree, not just the rendered output. A function component returning 8 levels of `<View>` for a single row is a code smell.
- **Consolidate `StyleSheet.create` blocks**: merge similar styles within a file, lift truly shared styles into a shared module, dedupe literals into `tokens.ts`. Run `node .claude/skills/impeccable-native/scripts/extract-tokens.mjs --dry-run` to surface duplicate literals across files; promote the ones that appear 3+ times.
- **Drop inline one-off styles**: `style={{ marginTop: 8, color: '#222' }}` inline in a component is two findings — a literal that should be a token, and a one-off style that should be in `StyleSheet.create` (or omitted, if the parent's `gap` already handles it).
- **Reduce component variants**: does `Button` need 12 variations, or can 3 cover 90% of cases? Consolidate two near-identical `Card`s into one with a `variant` prop. Prune `IconButton`, `RoundIconButton`, and `CircleIconButton` to one component with a `shape` prop.
- **Memoization where it earns its slot**: `useMemo` and `useCallback` are not free — they cost a render to compute. Inside a `FlatList renderItem` they earn it; on a top-level screen with no list, they often don't.

### Anti-patterns to flag for distill

- Nested `ScrollView`s (almost always a `FlatList` with header/footer).
- A pushed stack screen where a bottom sheet would do (transient picks, single-field edits, confirms).
- Every secondary action behind a modal (exhaust inline, swipe, sheet, then modal).
- "Hero metrics" cards without earned data — three big numbers in a row, none of them the user's number.
- Identical card grids (3 or 4 cards, same size, same shape) doing the work that a `FlatList` of rows would do better.
- 6+ bottom tabs.
- Token sprawl: more than ~3 surfaces, ~3 accent colors, ~5 type roles, more than 9 grays, more than 6 radii.
- A header with both a back button and a close button (one of them is wrong).
- A `Pressable` wrapped in a `TouchableOpacity` wrapped in a `View` with `onTouchEnd` — three handlers for one tap.
- `accessibilityRole="button"` on a decorative `View`. Decorative elements should be hidden, not announced.

**NEVER**:

- Remove necessary functionality (simplicity ≠ feature-less).
- Sacrifice accessibility for simplicity (`accessibilityRole` + `accessibilityLabel` + `accessibilityState` are not noise; they're required).
- Make things so simple they're unclear (mystery ≠ minimalism — a gesture without an affordance fails on first use).
- Remove information users need to make decisions.
- Eliminate hierarchy completely (some things should stand out — distill sharpens hierarchy, it doesn't flatten it).
- Oversimplify complex domains (match complexity to actual task complexity — a stock-trading app is not a meditation timer).
- Cut a platform-correct primitive in the name of "simplification" (don't remove an Android ripple to match iOS; honor `Platform Fidelity`).

## Verify Simplification

Ensure the cuts improve the surface. Verify on both platforms — Constitution Principle IV applies here too.

- **Faster task completion**: can users accomplish the primary goal in fewer taps? Time-to-primary-action shortened?
- **Reduced cognitive load**: is it easier to understand what to do on first look? Does the squint test resolve to one focal point?
- **Still complete**: are all necessary features still accessible (just possibly via disclosure)? Run through the critical paths in PRODUCT.md.
- **Clearer hierarchy**: is the primary action obvious without reading?
- **Better performance**: fewer `View` wrappers and fewer inline styles should manifest as cleaner re-renders. Run the surface through a `FlatList` scroll — does it stay on the UI thread?
- **Tokens compact**: re-run `node .claude/skills/impeccable-native/scripts/extract-tokens.mjs --dry-run` after the pass — duplicate literals should have dropped.
- **Both platforms still hold**: iOS Simulator + Android Emulator both verified. A simplification that breaks Android ripples or removes a platform-correct shadow is not a simplification.

## Document Removed Complexity

If you removed features, screens, or options:

- Document why they were removed (decision log, PR description, or a `// distill:` note in `tokens.ts` for token cuts).
- Consider if they need alternative access points (a long-press menu, a settings sub-screen, a "more" action).
- Note any user feedback to monitor after the cut ships.

When the cuts feel right, hand off to `/impeccable-native polish` for the final pass. As Antoine de Saint-Exupéry put it: "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away."
