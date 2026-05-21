# Extract Flow

Identify reusable patterns, components, and design tokens, then extract and consolidate them into the design system for systematic reuse.

## Before You Start: Run the Discovery Script

Before manual scanning, run the `extract-tokens.mjs` script in dry-run mode. It parses `.tsx` and `.ts` files, finds `StyleSheet.create` blocks, and surfaces duplicated literals (colors, sizes, durations) across the codebase:

```bash
node .cursor/skills/impeccable-native/scripts/extract-tokens.mjs --dry-run
```

The output is a ranked list of values appearing in 3+ places — these are your extraction candidates. Use it as a map, not a full answer; the script finds literals, not intent.

## Step 1: Discover the Design System

Find the design system, component library, or shared UI directory. Understand its structure: component organization, naming conventions, token module structure, import/export conventions.

Look for `tokens.ts` first (or `theme.ts`, `colors.ts` — whatever DESIGN.md names as the token module). The token module is the source of truth for values; `document.md` defines its authoritative shape. Cross-reference it before extracting — a value that already exists as a token is a migration task, not a new extraction.

**CRITICAL**: If no design system exists, ask the user directly to clarify what you cannot infer. before creating one. Understand the preferred location and structure first.

## Step 2: Identify Patterns

Look for extraction opportunities in the target area. In React Native codebases, the highest-signal signals are:

- **Repeated `StyleSheet.create` values**: the same color hex, spacing number, or radius appearing in 3+ separate `StyleSheet.create` blocks
- **Repeated `Text` style combinations**: `fontSize` + `fontWeight` + `lineHeight` triples copied across components rather than reading from `tokens.type`
- **Repeated `View` wrapper patterns**: the same container structure (padding + borderRadius + shadow split) appearing in multiple screens or components
- **Hard-coded values**: color hex literals, raw spacing numbers, hard-coded `borderRadius`, `elevation`, or `shadowOpacity` that belong in `tokens.ts`
- **Repeated component shapes**: similar UI patterns used 3+ times (cards, list rows, empty states, form rows)
- **Animation literals**: repeated `duration` values or `withSpring` configs that should be `tokens.motion` entries

Assess value: only extract things used 3+ times with the same intent. Premature abstraction is worse than duplication.

## Step 3: Plan Extraction

Create a systematic plan:

- **Components to extract**: which UI elements become reusable components?
- **Tokens to create**: which hard-coded values become entries in `tokens.ts`?
- **Variants to support**: what variations does each component need?
- **Naming conventions**: component names, token names, prop names that match existing patterns
- **Migration path**: how to refactor existing uses to consume the new shared versions

**IMPORTANT**: Design systems grow incrementally. Extract what is clearly reusable now, not everything that might someday be reusable.

## Step 4: Extract & Enrich

Build improved, reusable versions:

- **Components**: clear props API with sensible defaults, proper variants for different use cases, accessibility built in (`accessibilityRole`, `accessibilityLabel`, `accessibilityState` on toggles and interactive states — VoiceOver and TalkBack are first-class users), documentation and usage examples
- **Design tokens**: output target is `tokens.ts` — see `document.md` for the authoritative module shape (`export const tokens = { color, type, space, radius, shadow, motion }`). Clear naming (primitive vs semantic), proper hierarchy, documentation of when to use each token. Values are unitless numbers (dp/pt) or hex strings — no CSS units.
- **Patterns**: when to use this pattern, code examples, variations and combinations

## Step 5: Migrate

Replace existing uses with the new shared versions:

- **Find all instances**: search `.tsx` and `.ts` files for the patterns you extracted. `extract-tokens.mjs --dry-run` surfaces the exact file + line for each duplicated literal; use it as your migration checklist.
- **Replace systematically**: update each use to consume the shared version — token values via `tokens.ts` imports, shared components via their props API
- **Test thoroughly**: ensure visual and functional parity on **both** iOS Simulator and Android Emulator (Constitution Principle IV — extracted components must be tested on both platforms before the migration is considered done)
- **Delete dead code**: remove old inline values and one-off implementations

## Step 6: Document

Update design system documentation:

- Add new components to the shared components folder with inline TSDoc comments
- Update `tokens.ts` comments to document when each token is used and why (see `document.md` style guidelines: "Functional > decorative")
- Add usage examples in the component file or a companion `*.stories.tsx` if the project uses a component catalog (Storybook for RN, Ladle, or equivalent — document against whatever catalog the project already uses; don't introduce one)
- Note any Named Rules from DESIGN.md that the new tokens or components enforce

**NEVER**:
- Extract one-off, context-specific implementations without generalization
- Create components so generic they are useless
- Extract without considering existing design system conventions
- Skip proper TypeScript types or prop documentation
- Create tokens for every single value (tokens should have semantic meaning)
- Extract things that differ in intent (two buttons that look similar but serve different purposes should stay separate)
- Hard-code CSS concepts (`var(--token)`, `:root`, `@layer`, `@apply`) — token consumption in RN is a TypeScript import, not a CSS custom property
