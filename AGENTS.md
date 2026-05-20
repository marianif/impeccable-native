# Repository Guidelines

## Skill bootstrap: skip the post-update-cleanup step

The `<post-update-cleanup>` block in `.claude/skills/impeccable-native/SKILL.md` runs `scripts/cleanup-deprecated.mjs` and then self-deletes. **Do not run it in this repo, and do not delete the block.** This repo is the source of truth for the skill; the cleanup script targets consumer projects, not the source tree. The block is regenerated from `skill/SKILL.md` on every `node scripts/build.js`. Skip it silently.

## Architecture

One user-invocable skill: `impeccable-native`, with 22 sub-commands. Users type `/impeccable-native polish`, `/impeccable-native audit`, etc.

- `skill/SKILL.md` — frontmatter, shared design laws, command router table
- `skill/reference/` — one `<command>.md` per command, plus domain reference files
- `skill/scripts/` — `load-context.mjs`, `pin.mjs`, `command-metadata.json`, and RN-specific tools
- `skill/agents/` — subagent definitions (asset producer)
- `scripts/build.js` — compiles `skill/` into `.claude/skills/` and `.cursor/skills/`

## Build

```bash
node scripts/build.js        # compile + sync harness dirs
node scripts/build.js --clean  # clean dist/ first
```

## Test

```bash
node --test tests/cleanup-deprecated.test.mjs tests/impeccable-paths.test.mjs tests/load-context.test.mjs tests/critique-storage.test.mjs tests/design-parser.test.mjs
```

## What is NOT here

- No web/CLI anti-pattern detector (`cli/` was removed)
- No marketing site (`site/` was removed)
- No browser extension (`extension/` was removed)
- No live browser iteration scripts (RN has no browser; see `screenshot.mjs` instead)
- Only two harness targets: `.claude/` and `.cursor/`
