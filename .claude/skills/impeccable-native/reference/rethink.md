# Rethink Flow

Redesign a component from its **purpose outward** — what job it does, where in the choreography it does it, who it serves at that exact moment — then express that purpose through the existing brand vocabulary. The aesthetic is given; the *meaning* is the work.

`rethink` is the default creative refine after a rebrand or migration, when tokens are freshly authoritative and the UI needs to catch up to them without questioning them. Every UI choice — weight, density, prominence, motion, hierarchy — must trace back to a shared purpose. If a component could be lifted out of its flow and dropped into any other app without anyone noticing, it has failed its only job.

This is the sibling to `break`. They divide the creative space cleanly:

- **`break`** questions the design system. It escapes the existing tokens, designs unconstrained, then reconciles. Use when the brand itself is the problem.
- **`rethink`** treats the design system as given (read-only) and questions *the component's reason for existing in this spot*. Use when the brand is right but the component is generic, weightless, or doesn't earn its place in the flow.

If the brand is fine and you want the component cleaner, calmer, or louder, redirect to `distill`, `quieter`, or `bolder`. If the brand itself feels wrong, redirect to `break`. Confirm the scope is genuinely "the design isn't pulling its weight in the flow" before spending the effort.

## Before You Start: Run the Reconnaissance Script

A purpose-driven redesign needs to know three things the model can't reliably infer from one file: which tokens the brand actually offers (so the redesign stays inside the vocabulary), which screens this component lives in and what surrounds it (so role and weight can be tuned to context), and how sibling components on those same screens are treated (so hierarchy choices are deliberate, not accidental).

```bash
node .claude/skills/impeccable-native/scripts/rethink-scan.mjs --target=<path-to-component> --dir=.
```

The output has four parts:

- **`brandSurface`** — the token vocabulary (colors, spacing, type, radii, motion) as a **read-only** map. These are the words the redesign is allowed to use. The redesign never proposes new VALUES for these tokens; it composes them differently.
- **`usageSites`** — every screen and parent that mounts this component, with file:line. Tells you where this component lives in the app.
- **`flowNeighbors`** — for each usage site, what renders immediately before/after/around the component on that screen. The redesign's weight, prominence, and hierarchy choices are made relative to these neighbors.
- **`siblingTreatment`** — other components rendered alongside this one on shared screens, with a same-treatment signal (same height, same padding, same weight). When every block on a screen is sized and styled the same, hierarchy is dead — and the redesign's job is to break the sameness *meaningfully*, not decoratively.

The script finds structural relationships, not intent. Use it as a map, then read the actual screens to confirm what the component is *for* in each flow.

## Step 1: Establish Purpose Before Pixels

Before touching any visual decision, answer the five purpose questions in writing. The redesign rests on these answers — they're not preamble.

1. **Where does this live?** Name the screens (from `usageSites`) and, for each, the step of the flow. "Mounted on `app/onboarding/3-permissions.tsx` as the third of four steps."
2. **What job is it doing?** Not "displays X" — what *decision*, *action*, or *feeling* does it enable for the user at this exact moment? "Reassures the user that location access is private before they tap Allow."
3. **Who's reading it, and in what posture?** The scene sentence (per Shared design laws → Theme), grounded in *this specific moment* in the flow. "First-time user, mid-onboarding, slightly impatient, deciding whether to trust the app with location."
4. **What are the neighbors saying?** From `flowNeighbors` and `siblingTreatment`: what's above, below, before, after — and how loud are they? Your component's volume is relative to theirs.
5. **What would make this component unmistakably *this*, in *this* place, for *this* purpose?** The thing that, if you saw the component alone, would tell you exactly which screen and which moment it came from.

If you can't answer all five with conviction, stop and ask the developer. A purpose-driven redesign with weak answers becomes a generic redesign.

## Step 2: Redesign Inside the Vocabulary

Now design — but every visual decision must (a) trace back to one of the five answers and (b) use only tokens from `brandSurface`. The creative move is *combinatorial*: new compositions of existing tokens, new hierarchies, new emphasis, new motion choices — not new values.

For each design decision, write one line in the form: **"<decision> — because <purpose-answer>."**
- "Larger type on the headline — because this is the moment of decision and the headline carries the trust ask."
- "Tighter vertical rhythm than the sibling cards on the same screen — because this card is the primary actor and they're context."
- "Spring entrance from below — because the screen is asking the user to commit, and the motion is the ask reaching up to them."

If a decision can't be traced to a purpose answer, it's decoration — cut it.

### Token Policy: Brand is Read-Only

`rethink` never proposes token VALUE changes. Two dispositions only:

- **KEEP** — consume the token unchanged. This is the default for every existing token the redesign uses.
- **NEW** — add a new token alongside the existing ones, *only* when the brand vocabulary genuinely lacks a word the purpose demands. Frame it as "extending the system's voice," not "layering a new vibe." If the developer can compose the effect from existing tokens, NEW is wrong.

If the redesign needs to change a token's VALUE, that is the signal that this is the wrong command. Redirect to `break` (for one component's worth of system questioning) or `migration` (for a system-wide swap). Do not silently propose UPDATEs.

Honor the project's theming approach from `brandSurface.themingInfra`: emit `tokens.ts` edits for a vanilla/context system, theme-object edits for Restyle/styled-components/Tamagui, `tailwind.config` + className changes for NativeWind. Never mix idioms. Never introduce a second theming system.

## Step 3: Deliver Plan + Diffs

The deliverable is the purpose chain made visible:

1. **Purpose statement** — the five answers from Step 1, in plain language. This is the spine of the redesign and the document the developer can argue with.
2. **Decision log** — every visual decision paired with the purpose answer it traces back to. The developer can scan this and immediately see which choices to push back on.
3. **Code edits** — the rewritten component using only `brandSurface` tokens. Any NEW tokens (rare) added to the declared token module from `brandSurface.tokenDefinitions`, with a one-line rationale per addition.
4. **Hierarchy note** — if the redesign changes the component's weight relative to its `flowNeighbors` or `siblingTreatment`, call it out. The developer needs to know whether neighbors now need adjustment too (often: yes; sometimes: that's the point, and the contrast is the work).
5. **Verification** — test on **both** iOS Simulator and Android Emulator before considering it done (Constitution Principle IV). For purpose-driven changes, also verify in the *actual flow*, not in isolation — a component that looks right alone but wrong next to its neighbors has failed.

After applying, offer `/impeccable-native audit <target>` to verify touch targets, contrast, and platform parity hold up.

**NEVER**:
- Propose a token VALUE change. If the brand needs to move, that's `break` or `migration`, not `rethink`.
- Introduce a NEW token without proving the existing vocabulary can't express the purpose.
- Make a visual decision that can't be traced to one of the five purpose answers.
- Treat the component in isolation — `flowNeighbors` and `siblingTreatment` are not optional context; they're the frame the redesign is judged inside.
- Ship a "generic-but-prettier" version. If the redesigned component could be lifted into any other app without notice, it has failed.
- Introduce a second theming system (e.g. add styled-components to a NativeWind project).
