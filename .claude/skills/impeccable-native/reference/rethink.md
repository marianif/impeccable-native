# Rethink Flow

Reimagine a screen or component's UI and UX from scratch — including radical changes to color, style, and overall vibe — then reconcile that vision with the existing design system so the result either evolves the tokens deliberately or stays retrocompatible.

Every other refine command (`polish`, `quieter`, `bolder`, `distill`) works *within* the current design system and respects its tokens. `rethink` is the one command with permission to question the system itself. Use it when the developer says the component's design is uninspired, derivative, or wrong at the concept level — not when it just needs tuning.

This is a heavy command. If the user only wants the component cleaner, calmer, or louder, redirect them to `distill`, `quieter`, or `bolder`. Confirm the scope is genuinely "from scratch" before spending the effort.

## Before You Start: Run the Reconnaissance Script

A from-scratch redesign wants to invent new colors, spacing, and type. But the component lives inside a real app with a real theme. Before proposing anything, map what already exists so each token decision is informed:

```bash
node .claude/skills/impeccable-native/scripts/rethink-scan.mjs --target=<path-to-component> --dir=.
```

The output has three parts, each answering one question:

- **`tokenDefinitions`** — where the design system is *declared* (token modules, theme exports). These are the files you may edit, keep, or extend. If empty, there is no system to stay compatible with: you are free to define one.
- **`themingInfra.approach`** — *how* theming is wired (`context-usetheme`, `nativewind`, `restyle`, `styled-components`, `tamagui`, `unistyles`, `usecolorscheme`, `stylesheet`). Your output must speak this approach's idiom. Do not introduce a second theming system.
- **`blastRadius`** — for each token the target consumes, how many *other* files consume it. This is the retrocompatibility cost of changing that token's value.

The script finds declarations and references, not intent. Use it as a map, then read the actual token module before deciding anything.

## Step 1: Reimagine, Unconstrained

First, design the right answer without looking at the current tokens. This is the radical step — the point of `rethink` is to escape the existing system's gravity.

- Write the **scene sentence** (per Shared design laws → Theme): who uses this, where, under what light, in what posture. Let it drive the redesign, not the old design.
- Pick a fresh **color strategy** (Restrained / Committed / Full palette / Drenched). The current strategy is not a constraint here.
- Run the **category-reflex check** at both altitudes. A rethink that lands on the first training-data reflex for the category has failed its only job.
- Decide the new vibe: typography character, density, motion personality, the one thing this component should make a user feel.

Produce a short written vision: what changes, and why the old design was wrong. This is the redesign rationale.

## Step 2: Reconcile With the System — Token by Token

Now hold the unconstrained vision against the scan output. For **every** color, spacing, radius, type, and motion value the new design needs, classify it and present the choice to the developer. Do not silently mutate anything.

For each token, propose one of three dispositions with a one-line rationale:

- **UPDATE** — change the existing token's value. Only when blast radius is low (the token is used by the target and few others) *or* the developer explicitly wants the whole app to move with this redesign. State the blast radius count so the cost is visible.
- **KEEP** — leave the token as-is and design around it. Default when blast radius is high: mutating it would ripple into unrelated screens.
- **NEW** — add a new token alongside the existing ones (retrocompatible). The new vibe layers on top without breaking current consumers. Prefer this over UPDATE whenever the value is genuinely new rather than a correction.

Present this as a table the developer can decide from. **The developer chooses per token before any file is edited** — this command never auto-applies token changes. Surface high-blast-radius UPDATEs explicitly as the expensive, opt-in choices they are.

Honor the project's theming approach from the scan: emit `tokens.ts` edits for a vanilla/context system, theme-object edits for Restyle/styled-components/Tamagui, `tailwind.config` + className changes for NativeWind. Never mix idioms.

## Step 3: Deliver Plan + Diffs

The deliverable is both the rationale and the concrete edits:

1. **Redesign rationale** — the vision from Step 1: what was wrong, what the new concept is, the scene sentence and color strategy.
2. **Token disposition table** — every token, its disposition (UPDATE / KEEP / NEW), blast radius, and the developer's confirmed choice.
3. **Code edits** — the rewritten component plus any confirmed token-module changes, in the project's theming idiom. New tokens are added to the declared token module from `tokenDefinitions`; KEEP tokens are consumed unchanged; UPDATE tokens are edited only after explicit confirmation.
4. **Migration note** — if any UPDATE shipped, list the other consumers (from blast radius `files`) that now render differently, so the developer can verify them. Test on **both** iOS Simulator and Android Emulator before considering it done (Constitution Principle IV).

After applying, offer `/impeccable-native audit <target>` to verify the redesign holds up on touch targets, contrast, and platform parity.

**NEVER**:
- Mutate a token value without surfacing its blast radius and getting explicit confirmation.
- Introduce a second theming system (e.g. add styled-components to a NativeWind project).
- Treat the current design as a constraint during Step 1 — that defeats the purpose; reconcile in Step 2, not before.
- Ship a redesign that lands on the category's first- or second-order training-data reflex.
- Skip the scan and guess at the token surface — the blast radius is the whole point.
