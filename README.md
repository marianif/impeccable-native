# impeccable-native

A React Native design skill for AI coding agents. Hard fork of [impeccable](https://github.com/pbakaus/impeccable), rewritten for mobile-first UI work with Expo and bare React Native.

Type `/impeccable-native` in Claude Code to get a senior product designer + mobile engineer hybrid that reads your project's brand and design context and produces real, production-quality React Native code.

## What's different from the web version

- All 22 commands rewritten for React Native: StyleSheet + tokens, Reanimated, Skia, Expo Router, platform parity gates
- `live` mode removed (no browser runtime in RN); replaced with `screenshot` tooling for simulator iteration
- New scripts: `detect-rn-flavor`, `extract-tokens`, `platform-parity`, `a11y-audit`
- Asset producer updated for SVG-first, multi-density raster, app icon + splash workflows
- Absolute bans updated for mobile: no FAB-as-default, no hamburger over bottom tabs, no gradient buttons

## Commands

| Category | Commands |
|---|---|
| Build | `craft` `shape` `teach` `document` `extract` |
| Evaluate | `critique` `audit` |
| Refine | `polish` `bolder` `quieter` `distill` `harden` `onboard` |
| Enhance | `animate` `colorize` `typeset` `layout` `delight` `overdrive` |
| Fix | `clarify` `adapt` `optimize` |

## Install

```bash
npx skills add <this-repo-url>
```

Or manually copy `.claude/skills/impeccable-native/` into your project's `.claude/skills/`.

## Build

```bash
node scripts/build.js
```

Compiles `skill/` into `.claude/skills/` and `.cursor/skills/`.

## Status

Work in progress. Reference files are being rewritten in dogfood order:
`teach` → `document` → `shape` → `craft` → `audit` → `critique` → refinement set → `animate`/`overdrive`

## License

Apache 2.0. Forked from [impeccable](https://github.com/pbakaus/impeccable) by Paul Bakaus. See NOTICE.md for attribution.
