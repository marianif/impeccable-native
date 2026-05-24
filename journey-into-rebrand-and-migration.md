# Journey Into Rebrand and Migration

*A technical narrative of how impeccable-native learned to replace a design system end to end — from forensics through phased rewrite, with scripts written by the agent itself.*
*Compiled: May 24, 2026 — covering the May 23–24 design + build sessions*

---

## 1. The Problem That Started It

Most design-system tooling answers the wrong question. Linters check rules. Token extractors document what exists. Theme switchers swap one palette for another. All of these assume the system is sound and the work is incremental.

The work that prompted this skill is the opposite case: an app built fast, foundations strong, but the visual identity wrong at the concept level. Not a wrong color — a wrong *idea* of what the app is supposed to feel like. A vibecoded app, in the honest sense of the word: shipped before the brand was thought through, drifted into a mashup of styles over months of iteration. Six blues that aren't quite the same blue. Three font families that shouldn't coexist. Sharp corners and pill corners in the same flow. A `padding: 17` next to a `padding: 16` next to a `padding: 18`, each one a small accident with no author.

You cannot fix this with `rethink`. `rethink` reconciles one screen with the existing system. The problem here is that the existing system itself is the problem. The whole brand has to be re-thought, the whole token surface has to be replaced, every screen has to follow — and it has to happen without ten weeks of disciplined hand-work that no solo developer will ever schedule.

That was the problem. The skill that emerged from it has two halves: **`rebrand`** for authoring the new system, and **`migration`** — substantially rebuilt — for executing the swap. They were designed together, in conversation, over two sessions.

---

## 2. Designing in Public: The Conversational Architecture

The work began with a conversation, not a spec. The user described the situation: foundations strong, brand vibes wrong, `rethink` had been used on a few screens with results they liked, and now the whole app had to follow. The instinct was to extend `migration`, which already existed as a four-script reconnaissance pipeline. But `migration` had a quiet assumption baked into it: that the new design system *already existed*. It asked "how do I replace System A with System B?" and assumed B was already authored.

The honest answer was that B did not exist. There was no document, no token file, no opinion strong enough to hand `migration` and let it run. The vibes the developer wanted were in their head, scattered across reference apps, partially expressed in five rethought screens. The new system had to be derived — from real evidence about the old one, from a brand position the developer would actually defend, from the constraint of what `migration` could consume.

That gap is where `rebrand` was born. Not as an extension of `migration` but as the missing upstream stage: a skill whose job was to **produce** the brief that `migration` was missing.

The architecture took shape across three design questions, asked and answered before any code was written:

1. **How opinionated should the brand interrogation be?** The options were pure Socratic ("you do all the creative work, I just ask") or generative ("after a few questions, I propose 2-3 directions you pick from"). The decision was generative — solo developers without designers need the proposal surface; Socratic is too slow and tends to surface the developer's existing taste rather than push it.

2. **Should the new system inherit from rethought files?** The temptation was to lock in the decisions already made — they were already liked. The decision was the opposite: rethought files are *user-supplied references*, not defaults. If you want them to influence direction, paste them in as context. The skill should not assume what you liked yesterday is what you should ship tomorrow.

3. **What does the forensics layer actually need to surface?** This was the question that drove most of the script design. A vibecoded app's *tell* is not "47 colors." It's "6 different blues that are 2% apart in hue, used in 3 components, with no semantic distinction between them." The forensics had to be perceptual, not nominal — the developer needed to *feel* the mess, not be handed a tidy inventory of it.

Those three answers locked the shape. `rebrand` would have three sub-modes: `scan` for standalone forensics, `direction` for the full author-the-system flow, `resume` for picking up across sessions. Forensics would run perceptual clustering (CIEDE2000 ΔE), not hex equality. Direction generation would force genuine divergence, not three flavors of "modern + clean."

---

## 3. Forensics That Hurt to Read

The first script written was `style-inventory.mjs`. Its job is to look at every `.tsx` and `.jsx` file in a project and answer one question honestly: **how many distinct visual decisions does this app actually express, regardless of how many tokens claim to exist?**

The answer is almost always uncomfortable. The CIEDE2000 perceptual distance algorithm — implemented inline, no dependencies, sRGB → Lab → ΔE2000 per Sharma et al. 2005 — groups colors by what the eye sees, not what the hex value spells. An app with `#3B82F6`, `#3B82F4`, `#3D83F7`, `#3A81F5`, `#3C82F6`, and `#3B83F6` does not have six blues. It has one blue, accidentally written six ways, and the codebase pretends those are different decisions.

The same logic applies to spacings (clustered within 2pt), font sizes (within 1px), and radii. Each cluster preserves its members, so the developer can see "you have 6 colors that are visually indistinguishable, here's where each one is used, the most-used variant is the leader." The leader is the canonical answer — collapse to it.

`vibe-fingerprint.mjs` was the second script, and the one most likely to produce discomfort. Its job is to derive the app's *current implicit vibe* from the data — not what the developer thinks it is, what the pixels actually say. It analyzes the perceptual palette and outputs a fingerprint across six axes: temperature, density, voice, posture, era, and convention. Then it synthesizes a paragraph:

> Your app currently reads as cool and confident, in a balanced density. The dominant hue family is blue (avg 176°, saturation 0.05). The corner language is "soft" and the spacing rhythm is 8pt-based (78% fit). You have 11 perceptually-distinct colors and 2 clusters where multiple colors collapse to the same visual answer. 4 font families are in use, which dilutes the typographic signal.

That paragraph is meant to be read out loud. If it doesn't match what the developer thinks the app is — and it usually doesn't — the gap is the brief for the rebrand.

`incoherence-report.mjs` rounded out forensics by hunting contradictions: perceptually-identical colors used as if distinct, mixed spacing rhythms in the same flow, sharp and pill radii coexisting without intent, too many font families, undisciplined type scales. Each finding has file:line evidence and a one-line recommendation. The point isn't a complete list — it's the evidence the developer needs to *feel* the mess before being asked to redesign it.

These three scripts and a fourth (`shared/hardcoded-violations.mjs`, lifted from `migration` and moved to a shared directory so both skills could use it) compose the `rebrand scan` sub-mode. Run it standalone if you want a diagnostic. Run it as the first phase of `rebrand direction` if you want to keep going.

---

## 4. Forced Divergence: Three Bets, Not Three Palettes

The generative half of `rebrand` is where the design risk lived. The failure mode was obvious: ask an LLM "give me three brand directions for this app" and get three flavors of "modern, clean, approachable" with different accent colors. That is the failure mode of every AI design tool, and it would have made the skill worse than useless — three coats of taste-laundering on the same predictable answer.

The solution was a **forced divergence rule**, written into the skill reference doc as a non-negotiable. Each of the three proposed directions must differ from the other two on at least three of six axes: temperature (warm/cool/neutral), density (generous/efficient/balanced), voice (quiet/direct/warm), posture (restrained/confident/expressive), era (timeless/of-the-moment/mixed), and convention (inherits-platform/mostly-platform/distinct). The agent is instructed to check pairwise — if A and B differ on fewer than three axes, throw one away and regenerate. The rule does not police whether the directions are *good*; it polices whether they are *different bets*.

Each direction is presented as a complete brand: a name, a position paragraph, the explicit axis values (so divergence is visible), a "what this rules out" ban list (the constraint *is* the brand), a full token system with rationale per role, borrowed lessons from 2–3 reference apps, and an ASCII mockup of one screen so the direction is concrete rather than abstract.

The interrogation that feeds this — five to seven questions, conversational, structured — refuses to ask the questions that produce mush. Not "what colors do you like." Instead: "Describe the user in one sentence — not demographics, but the moment they open the app. What are they doing 10 seconds before? What do they want 10 seconds after?" And: "Three adjectives that are *off-limits* for this brand. More useful than 'fits' — every brand wants 'modern' and 'clean.' Telling me 'never playful, never corporate, never cute' carves a real shape." And: "Is this app a tool, a companion, or a stage? Pick one. The other two are wrong."

The output is `brand-brief.json` (machine-readable, for `migration` to consume) plus `brand.md` (human-readable, for review and defense). The brief carries not just the values but the rationale per token — so a future developer asking "why isn't this bolder?" gets answered by the brief instead of by reinvention.

---

## 5. The Migration Rebuild: From "Agent Edits 47 Files" to Generated Scripts

`rebrand` shipped first. Within hours, the next conversation surfaced the real architectural problem.

The original `migration` Step 4 read, in essence: "Migrate the files in the phase (apply the new tokens, update imports, swap className/style references to the new system)." Translation: the agent reads each file, holds it in context, edits it, moves to the next. For a real-app phase of 30–80 files, that meant 47 reads + 47 edits in one context window. Three problems became visible the moment anyone tried it:

1. **Context burn.** The window would be exhausted before the phase finished.
2. **Drift.** File 1 and file 47 get edited by an agent that has forgotten what it did to file 3. Subtle inconsistencies accumulate.
3. **No verification surface.** "Did file 23 get migrated correctly?" requires re-reading file 23. There is no machine record of what changed.

The brief already had everything a deterministic rewrite needed: the token clusters, the disposition per token, the file list per phase. Most of the migration work was not creative — it was mechanical substitution. **Mechanical substitution is what scripts are for.**

The rebuild took two design conversations. The first proposed a generic `migrate-phase.mjs` that handled every styling library, every destructuring pattern, every edge case. The second conversation killed that idea cleanly: a universal engine would become a 2000-line config-flag mess trying to anticipate every codebase, and the agent — by Step 3.5, after reading the brief and the token graph and the violations report — already *knows* the codebase's exact pattern. Forcing that knowledge through a generic engine throws it away.

The right shape was: the skill ships **the scanners** (deterministic, reusable) and **the helpers** (a small library of well-tested primitives). The agent authors the project-specific script that wires them together. The script is throwaway — it lives in `.impeccable/generated/` and exists only for this migration. Two hundred lines of readable, project-specific code is reviewable. A two-thousand-line generic engine is not.

The helpers library, `migration/rewrite-helpers.mjs`, settled at seven primitives, each doing one job: `renameDottedAccess` (rewrites `theme.colors.primary` → `theme.colors.brand.primary` everywhere, skipping comments and strings), `replaceValueInTokensFile` (changes a token's value in the source-of-truth file using nesting-aware traversal), `replaceClassname` (NativeWind class swaps with context detection), `promoteLiteral` (hex literal → token reference), `planChanges` + `applyChanges` (collects edits across helpers, detects overlaps, runs dry-run or commit), `emitReport` (JSON + Markdown rewrite reports), and `checkGitClean` (refuses to commit-mode against a dirty tree).

Each helper has a stable contract. Each is small enough to test inline. The generated script does the wiring; the helpers do the heavy lifting.

The flow became: agent authors `substitution-table.json` from the scan data, developer reviews the human-readable `substitution-plan.md`, agent authors a per-phase `migrate-phase-N.mjs` from a worked-example template in the reference doc, mandatory dry-run shows what will change, `--commit` flag required to actually write, git-clean check is a hard safety rail. The agent's role shrinks to: review the table, handle the bounded `requiresAgent` list (5–15 files per phase, not 47), verify, commit. Linear scale instead of quadratic blowup.

---

## 6. The Violation Insight

The first version of the substitution table treated literal violations conservatively: auto-promote only if the literal value matched a new token *exactly*. Everything else — close-but-not-equal hex, magic spacing numbers, magic radii — went to the agent for case-by-case judgment.

A short conversation surfaced that this was backwards. The `hardcoded-violations.mjs` scanner *already* computes `nearestToken` for every violation. The substitution table was throwing that signal away. Most violations have an obvious answer:

- `padding: 17` → nearest scale step is `spacing.md (16)`, distance 1. Snap to scale.
- `borderRadius: 9` → nearest is `radii.sm (8)`, distance 1. Snap.
- `#3B82F4` when the brand uses `#3B82F6` → ΔE 0.8, perceptually identical. Promote.
- `fontSize: 15` → nearest is `type.md (14)`, distance 1. Snap.

The redesign added three confidence tiers to `literalPromotions` — `exact`, `perceptual` (ΔE2000 < 5.0), `snap` (distance ≤ 4pt for spacing/radius, ≤ 2pt for fontSize). Only true semantic ambiguity — a literal genuinely equidistant from two scale steps, or a token name that could plausibly map to two new tokens — landed in the `ambiguous` list. The ambiguous list went from "most violations" to "the actual edge cases."

The remaining hard case was off-palette colors — hexes with no perceptual match in the new system. The first instinct was to send them to the agent. The user pushed back: handle them in the script. The resolution became its own pattern: the script auto-creates a `colors.unresolved.<deterministic-name>` token in the tokens file (hue family + truncated hex, so the same hex always gets the same name across re-runs), rewrites every call-site to use it, and records the creation in a new `unresolvedPromotions` array. The brand brief is **not modified** — these are temporary legacy tokens, not approved additions; the brief stays as the developer approved it.

The cleanup commit then becomes the moment of accountability. Step 5 was extended with a hard gate: every `colors.unresolved.*` must be resolved before cleanup proceeds — either mapped to a brand token (rewrite call-sites, delete the unresolved entry) or explicitly accepted as a legitimate exception (data-viz palette, third-party brand asset, hard-coded illustration color) and moved to a `colors.exceptions.*` namespace with a one-line `why` comment. The migration cannot ship with unresolved tokens still floating in the codebase. The mess that started this whole journey is not allowed to survive into the new system silently.

Two new helpers landed alongside: `promoteNumericLiteral` (rewrites `padding: 17` → `padding: tokens.spacing.md` inside style objects, with comment/string detection) and `addTokenToTokensFile` (idempotent insertion at the correct nesting level, refuses to clobber existing entries with different values).

---

## 7. The Doc Boundary

One sub-decision was small in code but architecturally telling. The question came up: when should `PRODUCT.md` and `DESIGN.md` — the project context files every other command in the skill reads — be updated to reflect the new brand?

The instinct was "right after `rebrand` finishes." The honest answer was "no, not until `migration` cleanup completes." The reasoning was practical: every other command in the skill reads those docs as the source of truth about the project's design intent. If you update them while the codebase still reflects the old brand, every subsequent `audit`, `critique`, and `polish` flags the entire app as off-brand — because it is, until migration completes. You drown in false-positive noise during the very period you can least afford it.

The right place to update the docs is the cleanup commit, when the new system has landed in code and passed audit on both platforms. That is the moment the docs are allowed to follow the code. Before that, the brief lives in `.impeccable/brand-brief.json` as the *plan*; the docs reflect what *is*. Step 5 was extended to include a rewrite step driven by the brief, with explicit field mappings (`position` → PRODUCT.md `users` and `brand`, `tokens` → DESIGN.md sections, `rules.ruledOut` copied verbatim as the explicit anti-position). Clean replace, no "superseded" sections — git history is the archive.

This is the kind of decision that does not appear in any feature spec but determines whether the skill is pleasant or maddening to use in practice. The boundary between "plan" and "truth" matters. Get it wrong and every subsequent command lies to you.

---

## 8. What Shipped

Three releases over two days closed the loop:

- **v0.6.0** — `rebrand` skill introduced (three sub-modes, forensics scripts, forced-divergence direction generation). `shared/` directory established. `migration.md` updated to accept `--brand-brief=<path>` and skip its design step when one is supplied. `PRODUCT.md` / `DESIGN.md` rewrite added to `migration` Step 5, deliberately deferred from `rebrand`.
- **v0.7.0** — Substitution-table architecture replaces the "agent edits files" model. `rewrite-helpers.mjs` ships with seven primitives. New Step 3.5 (author the table, developer approves), Step 4 (generated per-phase scripts, mandatory dry-run, git-clean check, bounded `requiresAgent` list). The agent's role shrinks from "rewrite 47 files in one context window" to "wire seven helpers together in a 200-line script and handle 5–15 edge cases."
- **v0.7.1** — Aggressive auto-promotion (numeric-snap, perceptual color match, exact match) lands. `unresolvedPromotions` array handles off-palette colors via auto-created `colors.unresolved.*` legacy tokens. Cleanup commit blocks until each is resolved. Two new helpers: `promoteNumericLiteral` and `addTokenToTokensFile`. The ambiguous list goes from "most violations" to "the actual edge cases."

The proof point arrived on May 24: the full pipeline was run on a real project for the first time. Forensics surfaced the actual vibe, three directions diverged honestly, the developer picked one, the substitution table generated cleanly, the per-phase script applied changes deterministically. It worked.

---

## 9. What This Says About the Method

A few things about this work are worth naming, because they generalize beyond design systems.

**Design in conversation, build in commits.** Every architectural decision in this story was settled in dialogue before any code was written — the three-sub-mode shape of `rebrand`, the forced-divergence rule, the helpers-vs-engine call, the doc-update timing, the tiered confidence model for violations. The conversations were short — usually two or three messages with explicit trade-off questions, sometimes with side-by-side previews — but they happened before commits, not after. Every commit afterward was an execution against a settled decision. No commit reversed an architectural call.

**The agent's role should shrink as the system matures.** The first version of `migration` asked the agent to do everything — read every file, decide every substitution, write every edit. The mature version asks the agent to: review a table, author a small wiring script, handle a bounded list of genuinely-ambiguous cases. The work the agent does is the *judgment* work; the mechanical work is in scripts. This is the inverse of what most AI-assisted tooling does, and it scales.

**Scripts are write-once when they're project-specific.** The argument for a universal `migrate-phase.mjs` would have been "we ship it once, every user benefits." The actual cost would have been a 2000-line engine trying to handle every styling library, every framework, every destructuring pattern. The argument for project-specific generated scripts is the opposite: 200 lines of readable, codebase-specific code that the developer can audit, modify, and re-run. The agent's knowledge of the codebase is captured in the script it writes; the next migration starts fresh, with knowledge specific to *that* codebase. The helpers library is the only shared surface, and it stays small on purpose.

**Forensics should hurt before they help.** The most-important output of `rebrand scan` is not the JSON — it is the paragraph in `vibe-fingerprint` that reads the developer's app back to them. If the paragraph does not produce mild discomfort, the tool has failed. The same logic applies to `incoherence-report`: the point is not a complete list of contradictions, it is the evidence the developer needs to *feel* the mess before being asked to fix it. Tools that only produce comfortable outputs are tools that do not change behavior.

**The hardest design problems are about timing and trust, not features.** The decision about when to update `PRODUCT.md` / `DESIGN.md`. The decision to refuse cleanup while `colors.unresolved.*` survives. The decision to make dry-run the default and `--commit` an explicit flag. The decision to refuse `--commit` against a dirty git tree. None of these are features. All of them are about when the tool is allowed to take a step the user cannot easily undo, and what the tool requires before it does.

---

*`rebrand` and `migration` are now a single workflow: derive a brand from real evidence, get a brief the developer will defend, generate a project-specific rewrite script that wires seven helpers, dry-run, commit, verify, advance. The mess that started this story does not survive into the new system. That was the whole point.*
