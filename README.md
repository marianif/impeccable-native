# impeccable-native

**React Native design fluency for AI coding agents.** Think of it as a senior product designer and mobile engineer fused into a single Claude Code / Cursor skill — one that reads your project's actual brand and design context, then writes production-quality React Native code that fits your app. Not generic AI defaults. Not boilerplate. Your design, in code.

Hard fork of [impeccable](https://github.com/pbakaus/impeccable), rewritten end-to-end for mobile-first work with Expo and bare React Native. 22 commands covering the full design-to-ship loop — from first-pass critique to accessibility audit to Reanimated motion to dark-mode polish.

Type `/impeccable-native` in Claude Code to start.

---

## What it does

It's a **design vocabulary**, not a code generator or a linter. It teaches the harness how to _think_ about React Native design decisions — visual hierarchy, touch targets, safe areas, platform parity, motion, theming, accessibility — and then writes code that honors those decisions.

What makes it mobile-native, versus the web original:

- All 22 commands rewritten for React Native: `StyleSheet` + typed tokens, Reanimated 3, Skia, Expo Router, platform-parity gates.
- **Platform Fidelity is a blocking gate.** Before any aesthetic judgment, the work must answer whether it feels native to its target OS. An Android app that looks like iOS isn't imperfect — it's wrong.
- Output is a typed **`tokens.ts`** module (not YAML/JSON), consumable by every RN toolchain with no build step.
- `live` browser mode removed (no browser runtime in RN); replaced with **simulator screenshot tooling** for iterate-on-device loops.
- A **static-analysis layer**: `detect-rn-flavor`, `extract-tokens`, `platform-parity`, `a11y-audit`. The skill doesn't just advise — it diagnoses real codebases.
- Asset producer rebuilt for SVG-first, multi-density raster, app-icon + splash workflows.
- Absolute bans retuned for mobile: no FAB-as-default, no hamburger over bottom tabs, no gradient buttons.

## Commands

| Category | Commands                                                      |
| -------- | ------------------------------------------------------------- |
| Build    | `craft` `shape` `teach` `document` `extract` `rethink`        |
| Evaluate | `critique` `audit`                                            |
| Refine   | `polish` `bolder` `quieter` `distill` `harden` `onboard`      |
| Enhance  | `animate` `colorize` `typeset` `layout` `delight` `overdrive` |
| Fix      | `clarify` `adapt` `optimize`                                  |

Run any of them as `/impeccable-native <command>` — e.g. `/impeccable-native craft`, `/impeccable-native audit`, `/impeccable-native critique`.

## Install

Add the marketplace, then install the plugin:

```
/plugin marketplace add marianif/impeccable-native
/plugin install impeccable-native
```

Or manually copy `.claude/skills/impeccable-native/` into your own project's `.claude/skills/`.

## Try it from source

Want to run the skill directly from the cloned repo — useful if you're tweaking commands or contributing? Two ways:

**Option A — point Claude Code at the cloned dir.** From your RN app, add the local clone as a marketplace:

```
/plugin marketplace add /path/to/impeccable-native
/plugin install impeccable-native
```

Claude Code reads the built `.claude/skills/` directly, so edits here show up after a rebuild.

**Option B — copy the built skill in.** Build, then drop the compiled skill into your app:

```bash
node scripts/build.js
cp -R .claude/skills/impeccable-native /path/to/your-rn-app/.claude/skills/
```

Then, inside your app, try a real loop:

```
/impeccable-native audit          # diagnose the current screens
/impeccable-native critique       # screenshot iOS + Android, light/dark
/impeccable-native craft          # build something new against your tokens
```

The static tools also run standalone against any RN project:

```bash
node .claude/skills/impeccable-native/scripts/a11y-audit.mjs --dir=./app
node .claude/skills/impeccable-native/scripts/platform-parity.mjs --dir=./app
node .claude/skills/impeccable-native/scripts/extract-tokens.mjs --dir=./app
```

## Build & test (for contributors)

```bash
node scripts/build.js          # compile skill/ → .claude/skills/ + .cursor/skills/
node scripts/build.js --clean  # clean dist/ first
npm test                       # node:test suite for build infra + skill scripts
```

Editing files under `skill/` requires a rebuild to propagate. The build is fast (<1s).

---

## How it was built

**It began with an inheritance, not a blank slate.** The parent `impeccable` skill was an opinionated _web_ design tool — CSS Grid, browser flexbox, YAML tokens, a "warm-paper editorial aesthetic with committed magenta." The founding question was whether those opinions could survive translation into the idiom of React Native and Expo.

**Phase 0 was demolition before construction.** Rather than gradually migrate, the project executed a clean hard fork: the web surface, nine non-target harness providers, the browser-overlay live mode, the CLI, and the multi-provider build system were all stripped — in one eight-minute burst of 20 observations — before a single line of mobile-specific content was written. "Clean room before you paint." This proved to be the most consequential architectural call: every later rewrite was unambiguous because there was no legacy web content to work around.

**Phase 1 rebuilt the foundation** — SKILL.md, the design laws, the command router — reframing the whole thing as a _vocabulary delivery system_. (Not without friction: an early SKILL.md write silently failed to persist three times, the project's first lesson in verifying the filesystem against the agent's belief about it.)

**Phase 2 was the bulk of the work**: migrating 29 reference files from web to mobile, file by file, tracked in `MIGRATION.md`. Two breakthroughs defined it — replacing YAML tokens with a typed **`tokens.ts`** module that RN consumes natively, and formalizing **Platform Fidelity as a blocking audit gate**. A live connection to the Mobbin MCP gave the skill empirical grounding in real-world mobile patterns.

**Phase 3 added the tooling layer** — the static analyzers that turned the skill from a consultant into an auditor. Its sharpest debugging saga lived here: an `a11y-audit` AST-scoping bug where `hasTextChild` searched the whole file instead of the element's own subtree, so a label belonging to a neighboring component made the current one falsely pass. The fix: bound the search to the element's own AST node.

**Memory was the structural precondition.** Across 34 sessions — including parallel subagents working different reference files simultaneously — persistent memory carried context across every session boundary and served as coordination infrastructure, with `MIGRATION.md` as its human-readable projection. The 94% context-savings rate isn't a marketing number; without it, the re-discovery cost at each boundary would have made a 36-hour sprint impossible.

---

## License

Apache 2.0. Forked from [impeccable](https://github.com/pbakaus/impeccable) by Paul Bakaus. See [NOTICE.md](./NOTICE.md) for attribution.
