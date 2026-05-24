# Rebrand

Design a new brand and design system from scratch for an existing app — derived from the app's current reality, justified by a brand position, and validated against the mess that's already there. Outputs a `brand-brief.json` that `migration` consumes directly.

`rebrand` is upstream of `migration`. `migration` answers "how do I safely replace System A with System B?" but assumes System B exists. `rebrand` produces System B — and produces it knowing what System A actually looks like, including all its contradictions.

Use `rebrand` when:
- The app's foundation is strong but the brand and visual identity are off — wrong concept, not wrong execution.
- The app has been built without a designer and has drifted into a mashup of styles (different blues that aren't quite the same, three font families that shouldn't coexist, sharp and pill radii in the same flow).
- A rebrand is needed and the team wants the new system to be derived from real evidence, not vibes.
- `rethink` has been applied to a few screens, the developer likes the direction, and now the whole app needs to follow.

Do not use `rebrand` when the existing system is coherent and you just want to refresh colors — that's `migration` with a new palette. Do not use it for a single screen — that's `rethink`.

## Sub-modes

`rebrand` has three sub-modes. The first word after `rebrand` selects the mode.

| Mode | Purpose | Output |
|---|---|---|
| `scan` | Run forensics only. Standalone diagnostic. | `forensics.json` + `forensics.md` |
| `direction` | Full pipeline: forensics → interrogation → 3 divergent directions → converge → write brief. | `brand-brief.json` + `brand.md` |
| `resume` | Continue an in-progress direction from saved state. | `brand-brief.json` + `brand.md` |

If no sub-mode is given, default to presenting the three options and asking the user to pick.

---

## Mode: `scan`

Forensics only. Useful as a diagnostic on its own ("how messy is my app actually?") or as the first step of `direction`.

```bash
node .claude/skills/impeccable-native/scripts/rebrand/rebrand-scan.mjs --dir=. [--de=3.5]
```

`--de` is the CIEDE2000 threshold below which two colors are considered perceptually identical. Default 3.5 (slightly stricter than the "just noticeable difference" of ~2.3). Raise to 5.0 if the report flags colors you consider distinct; lower to 2.5 if it misses obvious duplicates.

Runs four scripts in sequence:

1. **`rebrand/style-inventory.mjs`** — Builds a perceptual inventory of every color, font size, spacing, and radius value in the codebase. Colors are clustered by CIEDE2000 ΔE so that 6 visually-identical blues collapse into 1 perceived color. The output answers "how many distinct visual decisions does this app actually express, regardless of how many tokens claim to exist."

2. **`rebrand/vibe-fingerprint.mjs`** — Derives the app's *current implicit vibe* from the data, across six axes: temperature, density, voice, posture, era, convention. Outputs a one-paragraph "your app currently reads as: ___" that is often uncomfortable to read — which is the point. The gap between the derived vibe and the intended vibe is the brief.

3. **`rebrand/incoherence-report.mjs`** — Hunts contradictions: perceptually-identical colors used as if distinct, mixed spacing rhythms, sharp + pill radii coexisting, too many font families, undisciplined type scale. Each finding has evidence and a one-line recommendation.

4. **`shared/hardcoded-violations.mjs`** — Same script `migration` uses. Hardcoded values bypass any rebrand and need to be flagged.

Output: `.impeccable/forensics.json` plus per-script intermediates (`rebrand-style-inventory.json`, `rebrand-vibe-fingerprint.json`, `rebrand-incoherence.json`, `rebrand-violations.json`).

After running, present the forensics summary to the developer:
- The derived vibe paragraph (read it out loud — if it doesn't match what they think the app is, they have a problem to solve).
- The top 3–5 contradictions with file:line evidence.
- The readiness verdict (`coherent-enough` | `consider-rebrand` | `rebrand-recommended`).
- The recommendation: continue to `direction` or fix the worst contradictions first.

Stop here unless the user explicitly asks for `direction`.

---

## Mode: `direction`

Full pipeline. Three phases.

### Phase 1: forensics

If `.impeccable/forensics.json` exists and is fresh (generated within the same session), reuse it. Otherwise run `rebrand-scan.mjs` first.

Present the derived vibe and top contradictions before moving on. The developer needs to see what's actually there before being asked what they want.

### Phase 2a: interrogation

Run a structured but conversational interrogation. 5–7 questions, not a form. The goal is to surface **position** — every other decision follows from position.

Ask one question at a time. Wait for the answer. Use the AskUserQuestion tool when the question has discrete options; ask in plain text when the answer is open-ended.

Required questions (in order):

1. **The moment.** "Describe the user in one sentence — not demographics, but the moment they open the app. What are they doing 10 seconds before? What do they want 10 seconds after?"

2. **Three apps that feel right.** "Name three apps that feel right to you, and for each one say the *specific thing* they get right. Not 'Linear is fast' — 'Linear treats the keyboard as the primary input device and that respect shows in every screen.'"

3. **One that almost gets it.** "One app that *almost* gets it right but misses — and what specifically they got wrong."

4. **First three seconds.** "First 3 seconds: what should the user feel. What would be wrong to feel."

5. **Off-limits adjectives.** "Three adjectives that are **off-limits** for this brand. More useful than 'fits' — every brand wants 'modern' and 'clean.' Telling me 'never playful, never corporate, never cute' carves a real shape."

6. **Tool, companion, or stage.** "Is this app a tool, a companion, or a stage? Tool = invisible, gets out of the way. Companion = present, has personality, talks back. Stage = the user performs through it. Pick one. The other two are wrong."

7. **Optional context.** "Anything you want me to look at? Rethought files, screenshots, competitor URLs, a brand doc, a Pinterest board, a song. Optional — skip if nothing comes to mind."

Save answers to `.impeccable/rebrand-state.json` after each question so `resume` can pick up where the session stopped.

### Phase 2b: generate three divergent directions

Synthesize the forensics + interrogation answers into **three brand directions that are genuinely different bets**, not variations on one theme.

**Forced-divergence rule.** Each direction must differ from the other two on at least **3 of these 6 axes**:

| Axis | Poles |
|---|---|
| Temperature | warm / cool / neutral |
| Density | generous / efficient / balanced |
| Voice | quiet / direct / warm |
| Posture | restrained / confident / expressive |
| Era | timeless / of-the-moment / mixed |
| Convention | inherits-platform / mostly-platform / distinct |

Before presenting, check pairwise: if directions A and B differ on fewer than 3 axes, throw one away and regenerate. Do not present three variations of "modern + clean + approachable" with different accent colors. That is the failure mode.

For each direction, produce:

- **Name** — 2–3 words that capture the bet ("Quiet Instrument", "Warm Companion", "Daily Practice").
- **Position** — one paragraph that states the bet. Who the user is in this version. What this app would feel like if this direction won.
- **Axes** — explicit values across the 6 axes (so the divergence is visible).
- **What this rules out** — concrete list: "no animated success states, no illustrations, no gradients, no brand mascots, no onboarding tours." The ban list is as important as the position.
- **Color** — palette with one-line rationale per role (brand, surface, text, feedback). Include hex values. State the hue family and saturation profile.
- **Type** — family choice with rationale, weight strategy, scale (5–8 steps with sizes + line heights), how hierarchy is expressed (size + weight, or size + color, or letter-spacing).
- **Spacing** — base unit (4 / 8), rhythm preferences, density character.
- **Radius** — language (sharp / soft / large / pill) with rationale, scale.
- **Motion** — posture (restrained / confident / expressive), duration scale, easing preference, banned motion patterns.
- **Elevation** — philosophy (flat-with-borders / soft-shadows / layered) with rationale.
- **Borrowed lessons** — which 2–3 apps inspired this direction and what specifically was borrowed.
- **ASCII mockup** — one screen (login, home, or a representative core screen) in this direction. Boxes and labels showing layout, type sizes, where color lands. Concrete enough to feel real, cheap enough to throw away.

Present all three directions in one response. Number them. End with: "Pick one (1/2/3), remix across them (e.g., '2's color + 1's type'), or reject all three (and tell me what's missing across all of them)."

### Phase 2c: converge

Branch on the user's response:

- **Pick one** → Refine. Ask 1–2 targeted questions ("the accent feels right, but the type might be too restrained — push it?"). Iterate until the user approves. Then write the brief.
- **Remix** → Generate a combined direction by pulling the named pieces. Check coherence: does the type match the color temperature? does the spacing match the density? Flag any tensions ("the warm palette + restrained motion will read as cautious — is that the intent?"). User approves or adjusts. Then write the brief.
- **Reject all three** → Ask what's missing across all of them ("none of these are bold enough," "all three feel too quiet"). Regenerate with that as an explicit constraint. Re-run Phase 2b with the new constraint added.

Convergence ends when the user says "yes, that's the one." Then write `brand-brief.json` and `brand.md`.

### Brief schema

Write `.impeccable/brand-brief.json` with this exact shape — `migration` reads it directly:

```jsonc
{
  "version": "1.0",
  "generatedAt": "<ISO timestamp>",
  "generatedBy": "rebrand direction",
  "sourceForensics": ".impeccable/forensics.json",

  "position": {
    "name": "<direction name>",
    "sceneSentence": "<one sentence describing the user in the moment>",
    "oneParagraph": "<the position>",
    "is": ["<adjective>", "<adjective>", "<adjective>"],
    "isNot": ["<adjective>", "<adjective>", "<adjective>"],
    "feelInFirst3Seconds": "<...>",
    "wouldBeWrongToFeel": "<...>",
    "appType": "<tool|companion|stage>"
  },

  "axes": {
    "temperature": "<warm|cool|neutral>",
    "density": "<generous|efficient|balanced>",
    "voice": "<quiet|direct|warm>",
    "posture": "<restrained|confident|expressive>",
    "era": "<timeless|of-the-moment|mixed>",
    "convention": "<inherits-platform|mostly-platform|distinct>"
  },

  "inheritedFrom": {
    "references": [
      { "type": "<file|app|image|doc>", "ref": "<path or name>", "lesson": "<what it taught>" }
    ],
    "rejectedDirections": [
      { "name": "<direction name>", "whyRejected": "<...>" }
    ]
  },

  "tokens": {
    "color": {
      "clusters": [
        {
          "name": "<brand|surface|text|feedback|...>",
          "tokens": [
            {
              "name": "<colors.primary>",
              "value": "<#hex>",
              "role": "<one-line role>",
              "why": "<rationale>",
              "disposition": "<UPDATE|NEW|RETIRE>",
              "previousValue": "<#hex or null>"
            }
          ]
        }
      ]
    },
    "type": {
      "family": { "value": "<font name>", "why": "<...>" },
      "scale": [
        { "name": "<display|title|body|...>", "size": <px>, "lineHeight": <px>, "weight": <100-900>, "use": "<...>" }
      ],
      "hierarchyStrategy": "<size+weight|size+color|...>",
      "why": "<...>"
    },
    "spacing": {
      "base": <4|8>,
      "rhythm": [<numbers>],
      "why": "<...>"
    },
    "radius": {
      "language": "<sharp|soft|large|pill>",
      "scale": { "sm": <n>, "md": <n>, "lg": <n>, "pill": 999 },
      "why": "<...>"
    },
    "motion": {
      "posture": "<restrained|confident|expressive>",
      "durations": { "fast": <ms>, "base": <ms>, "slow": <ms> },
      "easings": { "standard": "<bezier>" },
      "banned": ["<pattern>"],
      "why": "<...>"
    },
    "elevation": {
      "philosophy": "<flat-with-borders|soft-shadows|layered>",
      "scale": [],
      "why": "<...>"
    }
  },

  "rules": {
    "ruledOut": ["<concrete ban>", "<...>"],
    "platformParity": "<note>",
    "darkMode": { "supported": <bool>, "strategy": "<...>" },
    "accessibility": { "minContrast": "WCAG AA", "minTouchTarget": 44 }
  },

  "migrationHints": {
    "suggestedNamespace": "<theme.v2|tokens.next|...>",
    "dualResidentStrategy": "side-by-side until cleanup",
    "phaseHints": "<advisory notes for migration>"
  }
}
```

Also write `.impeccable/brand.md` as a human-readable version of the same content. Section order: Position → Axes → Ruled Out → Tokens (Color, Type, Spacing, Radius, Motion, Elevation) → Rules → Migration Hints. Include the ASCII mockup of the chosen direction at the end.

### Handoff to `migration`

After writing the brief, tell the user:

> Brand brief written to `.impeccable/brand-brief.json`. To execute the rebrand across the app, run `/impeccable-native migration --scope=app --brand-brief=.impeccable/brand-brief.json`. `migration` will skip its design step and use this brief directly.

---

## Mode: `resume`

If `.impeccable/rebrand-state.json` exists, load it and continue from where the session stopped: re-present the last completed phase's output and ask the user to confirm before moving on. If no state file exists, fall back to `direction`.

---

## What `rebrand` Is NOT

- Not a refactor tool — it produces a brief, not file changes. `migration` applies the brief.
- Not a `rethink` for the whole app — `rethink` reconciles with the existing system. `rebrand` replaces it.
- Not a color picker — color is one of seven token surfaces, and every decision is justified by position.
- Not magic — the directions are bets. The forced-divergence rule keeps them honest, but the user picks.

## NEVER

- Never present three directions that differ only on accent color. Run the divergence check and regenerate if needed.
- Never write `brand-brief.json` before the user has explicitly approved a converged direction.
- Never skip the forensics step. The directions have to be grounded in what's actually there.
- Never inherit rethought files automatically. The user has to pass them as reference in Phase 2a question 7 if they want them to influence direction.
- Never propose generic adjectives ("modern", "clean", "minimal") in the position. They're true of every app and therefore meaningless.
