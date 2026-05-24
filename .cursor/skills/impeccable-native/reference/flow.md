# Flow

`flow` designs the **experience of moving through an app** — not just the navigation graph. A flow is a journey: a sequence (sometimes of one) of screens with a felt arc. Pacing, friction, decision points, reassurance, momentum. The artifact is a blueprint of what the user *feels* and *decides* at each step, ending in a technical scaffold a developer or `/craft` can build against. No diagrams, no maps — prose and stubs.

Two modes, verb-led:

- `flow create <brief>` — design a journey from scratch (no existing screens required). User describes the journey ("checkout for a B2B marketplace", "first-run for a meditation app"); flow proposes the screens, their order, and the experience behind each one.
- `flow rethink <name>` — scan the current app, locate the named journey (onboarding, checkout, settings discovery, etc.), critique its UX as a journey, and propose a reshaped version.

If invoked with no argument, ask which mode and what journey.

Use it when the user wants to **shape or reshape a journey**, not when they want to redesign one screen's visuals (`rethink`), build one screen end-to-end (`craft`), or get a read-only map of the whole app (the scan now serves `rethink` mode's discovery step only).

The unit of work is the **journey**, which may span many screens or just one if framed as a journey ("the settings screen as a journey of discovery and control"). Overlap with `rethink` is intentional and resolved by axis: flow owns navigation + journey + pacing; rethink owns visual/design-system rework.

## Mode: `flow create`

The user gives a brief. There is no existing app to scan — or the app exists but this journey is new to it. Skip reconnaissance. Go straight to shaping.

### Step 1: Interrogate the brief

A one-line brief is not enough to design a journey. Before proposing any screens, ask the user — in a single batched round of questions, not one at a time — for:

1. **Who is on this journey.** A persona sketch in one sentence. Their state of mind, what they just did, what they want next.
2. **The emotional shape.** Where does the journey start (anxious, curious, frustrated, neutral) and where should it end (confident, relieved, oriented, delighted)? The arc is the design.
3. **The decision the user is making.** Every journey resolves a decision, even small ones. Name it.
4. **Constraints.** Auth required? Payment involved? Platform-specific affordances (Apple Pay, biometric, deep links)? Any screens that must exist for legal/business reasons?
5. **The success exit.** What screen or moment marks the journey complete? What happens next?

If the user can answer all five in their brief, skip the interrogation and proceed. If any are missing, ask — do not invent answers.

### Step 2: Propose the journey

Output a blueprint, one section per screen, in journey order. For each screen:

```markdown
### N. <Screen name>

**Route**: `/route/path` (proposed) · **Kind**: stack | modal | sheet | tab
**Intent**: one sentence — what this screen exists to do
**Emotional beat**: one sentence — what the user should feel here
**Key decision**: the choice the user is making on this screen (or "none — transitional")
**Friction notes**: where the user might hesitate, and the design response to that hesitation
**Primary action**: the one thing the user is meant to do
**Secondary actions**: at most two, named
**Exit**: where this screen leads to and on what action
```

The blueprint is prose, not bullet soup. Each field is a complete sentence. A reader should be able to read the blueprint top-to-bottom and feel the journey in their body.

### Step 3: Emit the scaffold

Below the blueprint, generate the technical scaffold so a developer or `/craft` can pick it up. Match the project's detected router (expo-router or react-navigation):

**expo-router** — emit the proposed file tree:

```
app/
  (checkout)/
    _layout.tsx          # Stack with header hidden
    cart.tsx             # Screen 1
    shipping.tsx         # Screen 2
    payment.tsx          # Screen 3
    confirm.tsx          # Screen 4 (modal presentation)
    success.tsx          # Screen 5
```

For each file, emit a stub: `export default function CartScreen() { return null; }`. Mark modals with `presentation: 'modal'` in the parent `_layout.tsx`. Do not write screen UI — that is `craft`'s job.

**react-navigation** — emit the navigator definition:

```tsx
// navigation/CheckoutStack.tsx
export function CheckoutStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Shipping" component={ShippingScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="Confirm" component={ConfirmScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Success" component={SuccessScreen} />
    </Stack.Navigator>
  );
}
```

Plus stub component files for each screen. Wire the new navigator into the existing root navigator with a one-line diff snippet showing where to add it.

### Step 4: Hand-off note

End with a short note pointing the user at next steps: which screen to `craft` first (usually the one carrying the heaviest emotional beat or the most decision weight), and which screens are likely to need a `shape` round before craft (any screen with a non-trivial decision or a custom interaction).

## Mode: `flow rethink`

The user names an existing journey. Scan the app first to ground the rethink in the actual current state.

### Step 1: Locate the journey

```bash
node .cursor/skills/impeccable-native/scripts/flow-scan.mjs --dir=.
```

The scan produces a JSON document of screens, navigators, transitions, deep links, and entry points. Consume the full JSON. Do not pipe through `head`, `tail`, `grep`, or `jq`.

Use the scan plus the journey name the user gave (`onboarding`, `checkout`, `settings`, etc.) to identify the set of screens that compose the current journey. Heuristics, in priority order:

1. **Route segment match.** Screens whose route contains the journey name (`/onboarding/welcome`, `/onboarding/permissions`).
2. **Route group match.** Screens grouped under a route group of that name (`app/(onboarding)/*`).
3. **Navigator name match.** A `OnboardingStack`, `CheckoutNavigator`, etc.
4. **Transition reachability.** The screens reachable from the named entry point within the journey's natural boundary (e.g., from `/onboarding/welcome` until the journey exits to a tab root).

If the journey cannot be confidently located, list candidate journeys back to the user and ask which one. Do not guess.

### Step 2: Critique the current journey

For each screen in the located journey, in current order, emit a critique:

```markdown
### N. <Screen name> — <Route>

**Today's intent**: what the screen currently appears to do (inferred from the code and route)
**Today's emotional beat**: what a user likely feels on this screen as-is
**What's wrong**: the friction, the missed beat, the dead air, the broken pacing — be specific, name the symptom
**What's working**: keep this honest — name what should survive the rethink
```

The critique is not a scorecard. It is a journalist's read of the current experience. If a screen is fine as-is, say so plainly.

### Step 3: Propose the reshaped journey

Now design the journey as if from scratch, using the `flow create` blueprint format (Step 2 of that mode). Every screen gets the full blueprint: intent, emotional beat, key decision, friction notes, primary action, secondary actions, exit.

Where the reshape preserves an existing screen, say so and reference the original (`reuses ProfileScreen — see app/profile/index.tsx`). Where the reshape introduces a new screen or splits an existing one into two, mark it clearly (`new`, `split from PaymentScreen`).

### Step 4: Emit the diff scaffold

The scaffold for a rethink is a **diff**, not a fresh tree. For each change, emit one of:

- `+ new file: app/(checkout)/review.tsx` (stub the file)
- `- delete: app/(checkout)/payment-confirm.tsx` (note why)
- `~ move: app/(checkout)/payment.tsx → app/(checkout)/(secure)/payment.tsx` (note why)
- `~ edit: app/(checkout)/_layout.tsx` (show the diff hunk)

A developer should be able to read the diff scaffold and apply the structural change without reading the prose. The prose explains the *why*; the diff carries the *what*.

### Step 5: Hand-off note

Same as `create` mode: name the screen to `craft` first, name the screens likely to need `shape` first, and call out any screen whose visual rework is large enough to warrant `rethink` (the design-system one, not this command).

## Shared rules

- Every screen in any blueprint must have a named **emotional beat**. "Neutral" is allowed once per journey, no more. If a journey is all-neutral, the design is failing the user — interrogate the brief again or recritique.
- **No more than seven screens per journey** in a single pass. If a journey is longer, split it into sub-journeys (`/flow create onboarding-part-1`, then `-part-2`) and design them as a chain with a named hand-off screen between them. Seven screens is the upper limit of what a human can hold in their head as a single shape.
- **Modals are not free screens.** A modal is a deliberate interruption. Use it when the user must resolve something before continuing the journey, never as a substitute for a stack push.
- **No diagrams.** No Mermaid, no ASCII boxes-and-arrows, no flowchart images. The blueprint *is* the artifact. Diagrams flatten the felt experience into geometry; we are not designing geometry.
- Do not invent screens that contradict the project's detected flavor or router. If the project uses expo-router, propose file-based routes. If react-navigation, propose navigator + Screen entries.
- Do not write screen UI. That is `craft`'s job. The scaffold is structural only.

## What works in a journey, and what doesn't

These are the heuristics that separate a journey people remember from one they slog through. Hold them in mind while writing every blueprint.

### Pacing

**Do:**
- Vary the weight of consecutive screens. A heavy decision screen earns a light confirmation screen after it. Two heavy screens in a row is exhausting; two light screens in a row is filler.
- Let the user *catch their breath* after a commitment. The screen after "Confirm payment" is not the moment to upsell — it is the moment to reassure.
- Compress what can be compressed. If three steps could be one screen with three fields, make it one screen. Step counts are not a virtue.

**Don't:**
- Pad the journey to feel "thorough." A five-step wizard for a two-field form is a confidence problem, not a UX one.
- Stack two decision screens back-to-back without an acknowledgment beat between them. Decision fatigue is real and measurable.
- Use a loading screen as a beat. Loading is dead air, not pacing. If the work is fast, skip the screen; if it's slow, embed progress inline.

### Emotional arc

**Do:**
- Name the *start* feeling and the *end* feeling before designing anything in between. Onboarding usually moves from *skeptical* → *invested*. Checkout moves from *deciding* → *trusting* → *relieved*. Recovery moves from *anxious* → *in control*.
- Land the highest emotional moment on a screen that does almost nothing else. The "you're in" moment of onboarding should not also ask for notifications permission. Let the beat breathe.
- Mirror the user's state. If the user just did something hard (entered card details, uploaded an ID), the next screen should *feel* like the app understands that was hard.

**Don't:**
- Treat every screen as neutral. Neutrality is the texture of bad enterprise software. If a journey is all-neutral, it is failing.
- Punish the user for finishing. A confetti screen that you can't dismiss, a success screen that immediately offers a paid upgrade, a thank-you that demands a review — these all invert the arc at the worst moment.
- Confuse intensity with arc. A journey is not a series of escalating bangs. It is a shape: rising, falling, resolving.

### Decisions

**Do:**
- Make sure every screen has *one* decision (or none, transitional). Two decisions on one screen means the user is being asked to multitask.
- Front-load reversible decisions, back-load irreversible ones. Pick a username early; confirm a payment late. The user's tolerance for friction is highest near the goal.
- Show the consequence of the decision in the same view. "Free shipping if you add $4 more" lives next to the add-to-cart, not three screens away.

**Don't:**
- Hide the primary decision behind a scroll. If the user has to scroll to find the "Continue" button on a decision screen, the decision is buried.
- Offer a decision the user can't make yet. Asking "Which plan?" before showing what the plans include is a confidence trap, not a choice.
- Use destructive-action confirmations as your only safety net. "Are you sure?" modals are evidence that the underlying action should have been reversible in the first place. Undo beats confirm.

### Friction

**Do:**
- Add friction *only* where the user's future self will thank their present self for slowing down. Sending money, deleting an account, publishing publicly — friction here is care.
- Remove friction everywhere else, aggressively. Autofill, smart defaults, remembered choices, skippable steps. Every tap the user didn't have to make is a tap they can spend on what they came for.
- Make required friction *legible*. If you must show a 2FA step, say *why* in the same view. Friction without explanation reads as bureaucracy.

**Don't:**
- Add friction to protect *your* business at the cost of *the user's* time. Cancellation flows with seven screens, account deletion that requires emailing support, "Are you sure you want to unsubscribe?" twice in a row.
- Treat every error as a full-screen interruption. Inline correction beats modal apology, every time.
- Force a login wall before the user understands what the app does. Let them see value first; gate later.

### Modals, sheets, and interruptions

**Do:**
- Use modals when the user *must* finish or cancel before continuing the parent task. Payment confirmation, destructive confirmation, blocking permission requests.
- Use bottom sheets for *contextual elaboration* of something the user is already looking at — filter options on a list, details on a tapped item, action menus.
- Use full-screen takeovers (the rarest tool) for moments of real emotional weight: a one-time onboarding hero, a celebration of a milestone, a recovery from a serious error.

**Don't:**
- Reach for a modal because "it's faster to build." Modals are a UX commitment, not a layout shortcut.
- Stack modals on modals. If you're opening a sheet from inside a modal, the parent screen was wrong.
- Use a sheet for a primary navigation destination. "Settings" as a sheet from every tab means the app has no anchor for settings — give it a screen.

### Navigation as memory

**Do:**
- Preserve the back stack the way the user expects: linear journeys back out one screen at a time; tab switches don't reset stacks; modals dismiss to where they were summoned.
- Make "where am I" answerable in under a second from any screen — header text, tab indication, breadcrumb when nested deep.
- Honor deep links into the middle of a journey by reconstructing the journey *up to* that point in the back stack, so back still works.

**Don't:**
- Reset the user's stack on a tab switch unless the tab represents a truly independent domain.
- Drop the user onto a screen with no obvious way back. "Where am I, and how do I leave" must always be answerable.
- Loop the user. If finishing a journey lands them on its first screen again, the journey has no exit. Always land on a *next* place.

### First-run, recovery, and dead-end journeys

**Do:**
- Treat first-run as the *only* journey the user is guaranteed to take in order. Earn the right to ask for permissions, notifications, and personal data by showing value first.
- Treat recovery (password reset, payment failure, lost connection) as a first-class journey, not an afterthought. The screens a user sees when something is wrong define their trust more than the happy path.
- Design the empty state as the journey's *zero-th screen*. If the user has nothing yet, the empty state is their first real screen — make it shape the next action.

**Don't:**
- Front-load a five-screen onboarding before the user has seen a single piece of real content. Drop them into the app; teach in-context.
- Hand-wave error screens as "the developer will handle it." The error screen *is* the design.
- Leave an empty state as "No items." An empty state with no next action is a dead end.

### Groundbreaking examples to learn from

Carry these as touchstones. Each one solved a journey problem that the category had previously taken for granted.

- **Snapchat opening to the camera.** Every other social app of its era opened to a feed. Snapchat decided the journey began with *making*, not *consuming*. The choice of *first screen* defined the product. Lesson: the entry point is a design decision, not a default.
- **Square's signature-on-screen checkout (2010).** Checkout journeys at the time ended at a printer. Square ended them with the customer drawing on the merchant's iPad. The final beat became human, tactile, memorable. Lesson: the closing screen of a journey is where emotional memory is stored — invest there.
- **Stripe Checkout's single-page flow.** Stripe took the five-screen e-commerce checkout (cart → address → shipping → payment → confirm) and folded it into one scrollable page with inline validation. The journey became *one screen, not five*. Lesson: not every journey needs multiple screens; sometimes the right shape is one screen with deliberate vertical pacing.
- **Duolingo's streak-and-loss loop.** Duolingo made *not finishing* the journey a felt loss (broken streak, sad owl). The journey's emotional weight extends *past* the session. Lesson: a journey can have a felt presence even when the user is not on the screen.
- **Apple Pay's double-press confirmation.** A payment journey usually ends with a button. Apple Pay ended it with a hardware gesture and a haptic. The decision became *physical*. Lesson: the right input device for the highest-stakes moment may not be the touchscreen.
- **iA Writer's "Focus Mode" as a journey of one screen.** Writing apps before iA Writer treated the editor as a tool with chrome around it. iA Writer treated the act of writing as a journey, and removed everything that wasn't the next sentence. Lesson: a single-screen journey is a real journey when the felt arc is deliberate.
- **Headspace's first session.** Meditation apps before Headspace dropped users into a library of content. Headspace's first journey was a *guided ten-minute session with Andy* — one path, one voice, one outcome. The first journey was the product pitch. Lesson: a strong opinion about the first journey beats a wide menu of options.
- **Cash App's $cashtag identity.** Payment journeys before Cash App required account numbers, emails, or phone numbers — friction at the worst moment. The $cashtag made the recipient *findable as a person*. Lesson: removing friction from a journey often means inventing a new primitive, not optimizing the old one.
- **Things 3's "Today" as a daily journey.** Most to-do apps showed every task; Things 3 made the daily journey a deliberate act of *choosing* what today contained. The journey *into* the day became part of the product. Lesson: a journey can be a ritual the user performs, not a path the app pushes them down.

## Output shape

The full deliverable is a single markdown document:

```
# Flow: <journey name>

<mode line — "create" or "rethink (against current app)">

## Brief
<one paragraph restating the journey, the persona, the arc, and the decision>

## Blueprint
<per-screen sections, in journey order>

## Scaffold
<file tree or diff, plus stubs>

## Hand-off
<one short paragraph naming the next commands to run and on which screens>
```

That is the entire artifact. A developer reads it and knows both what to build and why the journey is shaped this way.

**NEVER**:
- Emit a Mermaid graph. The blueprint replaces it.
- Score the journey or rank screens. Critique is qualitative.
- Write screen-level UI code. Stubs only.
- Invent personas, decisions, or constraints the user did not give you. Ask.
- Skip the emotional beat field on any screen. It is the spine of the journey.
- Run other commands (`audit`, `critique`, `rethink`) inside flow. Recommend them in the hand-off; do not invoke them.
