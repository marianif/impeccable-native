# Project Instructions for Claude

## Skill bootstrap: skip the post-update-cleanup step

The `<post-update-cleanup>` block in `.claude/skills/impeccable-native/SKILL.md` runs `scripts/cleanup-deprecated.mjs` and then self-deletes. **Do not run it in this repo, and do not delete the block.** This repo is the source of truth for the skill; the cleanup script targets consumer projects, not the source tree. The block is regenerated from `skill/SKILL.md` on every `node scripts/build.js`. Skip it silently.

## Architecture

One user-invocable skill: `impeccable-native`, with 22 sub-commands.

- `skill/SKILL.md` — frontmatter, shared design laws, command router table
- `skill/reference/` — one `<command>.md` per command, plus domain reference files (`typography.md`, `color-and-contrast.md`, etc.)
- `skill/scripts/` — `load-context.mjs`, `pin.mjs`, `command-metadata.json`, and RN-specific tools
- `skill/agents/` — subagent definitions (asset producer)
- `scripts/build.js` — compiles `skill/` into `.claude/skills/` and `.cursor/skills/`
- `scripts/lib/` — build utilities (transformer factory, provider configs, utils)
- `tests/` — node:test suite for build infrastructure and skill scripts

**Do not add standalone skills.** All commands live under `/impeccable-native`.

## Build

```bash
node scripts/build.js          # compile skill/ + sync harness dirs
node scripts/build.js --clean  # clean dist/ first
```

Editing files in `skill/` requires a rebuild to propagate to `.claude/skills/`. The build is fast (<1s).

## Test

```bash
node --test tests/cleanup-deprecated.test.mjs tests/impeccable-paths.test.mjs tests/load-context.test.mjs tests/critique-storage.test.mjs tests/design-parser.test.mjs
```

## Adding new commands

1. Create `skill/reference/<command>.md`
2. Add a row to the Commands router table in `skill/SKILL.md`
3. Add the command to `IMPECCABLE_SUB_COMMANDS` in `scripts/lib/utils.js`
4. Add it to `VALID_COMMANDS` in `skill/scripts/pin.mjs`
5. Add its metadata to `skill/scripts/command-metadata.json`
6. Rebuild: `node scripts/build.js`

## Versioning

One component to version: the skill itself.

- `.claude-plugin/plugin.json` → `version`
- `.claude-plugin/marketplace.json` → `plugins[0].version`

Bump when skill content changes (`skill/`, reference files, command metadata).

## What is NOT here

- No web/CLI anti-pattern detector (`cli/` removed)
- No marketing site (`site/` removed)
- No browser extension (`extension/` removed)
- No live browser overlay scripts (removed; use `screenshot.mjs` for simulator iteration)
- Only two harness targets: `.claude/` and `.cursor/`
