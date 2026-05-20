# Teach Flow

Gathers design context for a React Native / Expo project and writes two complementary files at the project root:

- **PRODUCT.md** (strategic): register, target users, product purpose, platform fidelity, primary devices, brand personality, anti-references, design principles. Answers "who/what/why/where".
- **DESIGN.md** (visual): token definitions for color, typography, spacing, radius, shadow, and motion — structured as a `tokens.ts` module. Answers "how it looks".

Every other impeccable-native command reads these files before doing any work.

## Step 1: Load current state

Run the shared loader first so you know what already exists:

```bash
node {{scripts_path}}/load-context.mjs
```

The output tells you whether PRODUCT.md and/or DESIGN.md already exist. If `migrated: true`, legacy `.impeccable.md` was auto-renamed to `PRODUCT.md`. Mention this once to the user.

Decision tree:
- **Neither file exists (empty project or no context yet)**: do Steps 2-4 (write PRODUCT.md), then decide on DESIGN.md based on whether there's code to analyze.
- **PRODUCT.md exists, DESIGN.md missing**: skip to Step 5 and offer to run `{{command_prefix}}impeccable-native document` for DESIGN.md.
- **PRODUCT.md exists but has no `## Register` section (legacy)**: add it. Also check for the `## Platform Fidelity` and `## Primary Devices` sections; if missing, ask and add them. Infer a hypothesis from the codebase (see Step 2), confirm with the user, write the fields.
- **Both exist**: {{ask_instruction}} Ask which file to refresh. Skip the one the user doesn't want changed.
- **Just DESIGN.md exists (unusual)**: do Steps 2-4 to produce PRODUCT.md.

Never silently overwrite an existing file. Always confirm first.

If teach was invoked as a setup blocker by another command, such as `{{command_prefix}}impeccable-native craft onboarding flow`, pause that command here. Complete teach, re-run the loader, then resume the original command with the freshly loaded context. For craft, resume into shape next; teach creates project context, but it is not a substitute for the task-specific shape interview and confirmed design brief.

## Step 2: Explore the codebase

Before asking questions, thoroughly scan the project to discover what you can. Also run the flavor detector if not already done this session:

```bash
node {{scripts_path}}/detect-rn-flavor.mjs
```

Then look for:

- **README and docs**: App purpose, target audience, any stated goals
- **package.json / app.json / app.config.js**: SDK version, dependencies, existing libraries (navigation, animation, styling)
- **Existing screens and components**: Current design patterns, spacing, color values, typography in use
- **Brand assets**: App icon, splash image, logo files — any established brand color
- **Existing tokens or theme files**: `tokens.ts`, `theme.ts`, `colors.ts`, `StyleSheet` constants — extract values if present
- **Navigation structure**: Tab bar screens, stack screens, drawer — this reveals the app's primary hierarchy

Also form a **register hypothesis** and **platform hypothesis**:

- Brand signals: splash screens, onboarding brand moments, marketing-style landing screens, hero imagery, campaign surfaces.
- Product signals: tab navigators, stack navigators with data screens, settings screens, dashboards, forms, lists.
- Platform fidelity signals: presence of `Platform.OS` checks, `@react-navigation/native-stack` (leans iOS-native), `@react-navigation/material-top-tabs` (leans Material), NativeWind or custom design system (leans custom-cross-platform).

Register and platform-fidelity are hypotheses at this point; Step 3 confirms them.

Note what you've learned and what remains unclear. This exploration feeds both PRODUCT.md and DESIGN.md.

## Step 3: Ask strategic questions (for PRODUCT.md)

{{ask_instruction}} Ask only about what you couldn't infer from the codebase.

### Interview mode, not confirmation mode

If the repo is empty or the user's brief is sparse, run a short interview before proposing PRODUCT.md. Do **not** turn a one-sentence request into a complete inferred PRODUCT.md and ask for blanket confirmation.

- Use the harness's structured question tool when one exists. Otherwise, ask directly in chat and stop.
- Ask **2-3 questions per round**, then wait for answers.
- Use inferred answers as hypotheses or options, not as finished facts.
- Complete at least one real user-answer round before drafting PRODUCT.md, unless every required answer is directly discoverable from repo docs.
- Round 1 should establish register, users/purpose, and desired outcome.
- Round 2 should establish brand personality or references, anti-references, and accessibility needs.

### Minimum viable interview

Ask enough to complete PRODUCT.md. At minimum, cover register confirmation, users and purpose, brand personality, anti-references, and accessibility needs unless each answer is directly discoverable from repo context. After at least one interview round, you may propose inferred answers, but the user must confirm them before you write PRODUCT.md. Never synthesize PRODUCT.md from the original task prompt alone.

### Register (ask first; it shapes everything below)

Every design task is either **brand** (splash screens, onboarding brand moments, marketing surfaces: design IS the product) or **product** (app UI, navigation flows, settings, dashboards, tools: design SERVES the product).

If Step 2 produced a clear hypothesis, lead with it: *"From the codebase, this looks like a [brand / product] surface. Does that match your intent, or should we treat it differently?"*

If the signal is split (e.g. an app with both a marketing onboarding and a product core), {{ask_instruction}} Ask which register describes the **primary** surface.

### Users & Purpose
- Who uses this app? Age range, technical level, primary use case?
- When and where do they open it — on a commute, at a desk, in a specific workflow?
- What job are they trying to get done?
- For brand: what emotions should the app evoke? (confidence, calm, delight, urgency)
- For product: what's the primary task on any given screen?

### Platform & Devices
- Is this phone-only, or does it need to work on tablet too? Foldables in scope?
- Platform fidelity stance: should iOS feel iOS-native and Android feel Android-native, or is there a custom design language consistent across both?
  - Lead with the hypothesis from Step 2: *"The codebase suggests [cupertino-android-pragmatic / custom-cross-platform]. Does that match your intent?"*
  - Options: `cupertino-everywhere`, `material-everywhere`, `cupertino-android-pragmatic` (recommended default), `custom-cross-platform`.

### Brand & Personality
- How would you describe the brand personality in 3–5 words?
- Reference apps that capture the right feel? What specifically about them?
  - Push for real app references, not generic adjectives: e.g. "Notion's calm information density", "Duolingo's playful progression", "Linear's keyboard-first precision".
- What should this explicitly NOT look like? Anti-references?
  - Prompt if needed: "Not another white-background todo app?", "Not Material 3 defaults?", "Not a Stripe-cream finance app?"

### Accessibility
- Any known accessibility requirements? (VoiceOver support, minimum touch target sizes, Dynamic Type support)
- Users with motor impairments or visual impairments to consider?
- `prefers-reduced-motion` / `useReducedMotion` — should animations be skippable by default?

Skip questions where the answer is already clear. **Do NOT ask about colors, fonts, radii, or spacing here.** Those belong in DESIGN.md, not PRODUCT.md.

## Step 4: Write PRODUCT.md

Write PRODUCT.md only after the user has confirmed the strategic answers from Step 3. If an inferred answer is uncertain or unconfirmed, ask before writing.

Synthesize into a strategic document:

```markdown
# Product

## Register

product

## Users
[Who they are, their age range, technical level, context — when and where they open the app]

## Product Purpose
[What this app does, why it exists, what success looks like for the user]

## Platform Fidelity

cupertino-android-pragmatic

## Primary Devices

phone-only

## Brand Personality
[3–5 adjectives. Voice, tone, emotional goals.]

## Anti-references
[What this should NOT look like. Specific bad-example apps or patterns to avoid.]

## Design Principles
[3–5 strategic principles derived from the conversation. E.g. "thumb-first everything", "one primary action per screen", "calm by default, expressive on success". NOT visual rules like "use #D4522A" or "borderRadius: 12".]

## Accessibility
[VoiceOver/TalkBack requirements, Dynamic Type support, reduced motion policy, minimum touch target commitment]
```

`Register` is either `brand` or `product` as a bare value. `Platform Fidelity` is one of: `cupertino-everywhere`, `material-everywhere`, `cupertino-android-pragmatic`, `custom-cross-platform`. `Primary Devices` is one of: `phone-only`, `phone-and-tablet`, `phone-tablet-foldable`. No prose, no commentary on these fields.

Write to `PROJECT_ROOT/PRODUCT.md`. If `.impeccable.md` existed, the loader already renamed it; merge into that content rather than starting from scratch.

## Step 5: Decide on DESIGN.md

Offer `{{command_prefix}}impeccable-native document` either way. Two paths:

- **Code exists** (existing screens, StyleSheet.create calls, a theme file): "I can generate a DESIGN.md that captures your token system (colors, typography, spacing, shadows) as a `tokens.ts` shape so variants stay on-brand. Want to do that now?"
- **Pre-implementation** (empty project): "I can seed a starter DESIGN.md from a few quick questions about color strategy, type direction, and references. You can re-run `document` once there's code to capture the real extracted tokens. Want to start the seed now?"

If the user agrees, load `reference/document.md` and follow that flow.

If the user prefers to skip, mention they can run `{{command_prefix}}impeccable-native document` any time later.

## Step 6: Confirm and wrap up

Summarize:
- Register captured (brand / product)
- Platform fidelity stance and primary devices
- What was written (PRODUCT.md, DESIGN.md, or both)
- The 3–5 design principles from PRODUCT.md that will guide future work
- If DESIGN.md is pending, remind the user: `{{command_prefix}}impeccable-native document`

**Critical: re-run the loader to refresh session context.** After writing PRODUCT.md, run `node {{scripts_path}}/load-context.mjs` one final time and let its full JSON output land in conversation. This ensures subsequent commands in this session use the freshly-written PRODUCT.md, not a stale version.

If teach was invoked as a blocker by another impeccable-native command (e.g. the user ran `{{command_prefix}}impeccable-native audit` with no PRODUCT.md), resume that original task now with the fresh context.

Optionally {{ask_instruction}} Ask whether they'd like a brief summary of PRODUCT.md appended to {{config_file}} for easier agent reference. If yes, append a short **Design Context** pointer section there.
