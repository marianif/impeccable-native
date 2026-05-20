# Codex: Visual Direction & Asset Production

This file is loaded by `{{command_prefix}}impeccable-native craft` when the harness has native image generation (currently Codex via `image_gen`). Other harnesses skip it. It covers the two craft steps that depend on real image generation: landing the visual direction, and producing the assets the implementation will compose.

Read this *before* generating any images. The order matters, and the per-step user pauses are what keep generated imagery from drifting away from the brief.

### Four stop points before code

Steps A through D each end with the user. Do not advance past any of them on your own read of the situation.

1. **STOP after Step A questions.** Wait for answers.
2. **STOP after Step B palette generation.** Wait for "confirm palette."
3. **STOP after Step C mocks.** Wait for direction approval or delegation.
4. **Only after Step D approves a direction** do you return to craft.md Step 4 and write code.

Prior shape approval does **not** satisfy any of these. Shape's "confirm or override" advances you into Step A; it is not a substitute for it.

## Step A: Explore Directions with the User

Before generating anything, run a brief direction conversation grounded in the shape brief.

**Step A is required even when shape just produced a confirmed brief.** The shape questions and Step A questions cover different ground: shape pins purpose, content, scope; Step A pins palette, atmosphere, and named visual references for the comps you're about to generate. The only time you can skip Step A is when the user has already answered these exact palette/atmosphere/reference questions in the same session.

Ask **2-3 targeted questions** about visual lane, color strategy, atmosphere, and named anchor references. Don't enumerate generic menus; tie each question to the shape brief's answers. Example shape-grounded questions:

- "Brief says 'editorial restraint, Klim-adjacent.' Are we closer to a quiet specimen page or a magazine-spread feel with hero imagery?"
- "Palette strategy from shape was 'Committed.' Want it warm-grounded (deep oxblood + cream) or cool-grounded (slate + paper white)?"

**STOP and wait for answers.** These pin the palette before any pixel gets generated. Do not proceed to Step B until the user has responded.

## Step B: Generate the Brand Palette First

Generate **one** palette artifact before any mocks. This is a small, focused image: typography pairing on the chosen background, primary + accent color swatches, one signature ornament or motif. Single image, single pass.

Capture the values for `tokens.ts` as you go. Note the hex for each swatch — those are what will land in `tokens.color.light` (and the dark-mode siblings if dark is in scope).

Why palette first: mocks generated against a vague color sense produce noise that drowns out the structural decisions. A confirmed palette is the first concrete contract for everything downstream.

Show the palette to the user. Ask one question: "This is the palette I'm locking in for the mocks. Confirm, or call out what to shift?"

**STOP and wait for confirmation.** Do not generate mocks against an unconfirmed palette. "Probably good enough" is the wrong call here; the palette is the contract for everything downstream.

## Step C: Generate 1-3 Visual Mocks Against the Palette

Once the palette is confirmed, generate **1 to 3** high-fidelity north-star comps. Each mock must use the confirmed palette and typography. Mocks differ in *structural* direction (hierarchy, density, composition, navigation treatment), not in color or motif.

Render mocks at realistic phone dimensions (roughly 9:19.5 portrait, e.g. 1170×2532 for iPhone 15 Pro). Include the status bar and any nav chrome the screen actually uses — tab bar, header, home indicator — so density and touch-target spacing land believably and the second-glance read isn't dominated by missing system UI. If the screen has a meaningful Android variant (different header treatment, material ripple, system back), generate it as a sibling, not a separate direction.

- Brand work (splash, onboarding hero, marketing surface): push visual identity, composition, mood, and signature motifs.
- Product work (app screens, settings, dashboards, lists): push hierarchy, density, navigation treatment, grounded in realistic content.
- Multi-screen flows: render at minimum the primary screen plus one supporting state (empty, success, modal sheet) so the system reads beyond a single hero.

Use the `image_gen` tool directly (or via the imagegen skill when available). Don't ask the user to install anything.

## Step D: Approval Loop

Show the comps. Ask what carries forward. Iterate until **one direction is approved** or the user explicitly delegates.

**STOP and wait for the approval or the delegation.** Do not begin Step E or return to craft.md Step 4 until a single direction is named. If the user delegates, pick the strongest direction and explain it from the brief, not personal taste.

Before moving to assets, summarize what to carry into code and what *not* to literalize from the mock. This is the handoff between visual exploration and semantic implementation.

## Step E: Mock Fidelity Inventory

Inventory the approved mock's major visible ingredients. For each, decide implementation:

- **Semantic RN** — `View` + `StyleSheet` with token-driven props. Default for surfaces, layout, type, simple decorative shapes.
- **react-native-svg** — vector ingredients: icons, logos, line ornaments, custom shapes, chart strokes. Always preferred over raster when source is vector.
- **Skia (`@shopify/react-native-skia`)** — paths, shaders, image filters, particle systems, generative ornament, anything beyond what SVG composes cleanly.
- **expo-image** (or `react-native-fast-image` on bare RN) — photographic, place-led, product, portrait, or architectural imagery. With `contentFit`, blurhash placeholder, explicit `width`/`height`.
- **expo-linear-gradient** — gradient surfaces and overlays. Used surgically; the absolute ban on gradient buttons still applies.
- **expo-blur** (or `@react-native-community/blur` on bare) — native blur layers. Rare; tied to a specific composition decision, not decoration.
- **Reanimated worklets** — anything that animates state, gesture-driven motion, or layout transitions.
- **Icon library** — the project's established set (`@expo/vector-icons`, `lucide-react-native`, etc.). Don't introduce a second set.
- **Generated raster (PNG/WebP)** — only when none of the above can credibly carry the ingredient. Multi-density: ship `@1x`/`@2x`/`@3x` or use `expo-image` with a single high-res source.
- **Accepted omission** — flagged honestly to the user, not silently dropped.

Common ingredients to inventory for a mobile screen:

- Hero composition: imagery, ornament, type-led silhouette, or layered Skia surface
- Signature motifs (illustrated objects, generative patterns, photography, custom chart shapes, app icon echoes)
- Header treatment and primary CTA — including native vs custom on iOS/Android
- Tab bar or navigation chrome
- Section sequence beyond the fold (long scroll, onboarding pagination, modal sheets)
- Image-native content the concept depends on (avatar, product shot, place, illustration)
- Typography, density, color treatment, motion cues, haptic moments

Treat the mock as a north star, not a screenshot to trace. Don't rasterize core UI text. But if the running app on simulator lacks the mock's major ingredients, the implementation is wrong.

If a photographic, place-led, product, or portrait mock becomes generic `View` scenery, decorative SVG, bullet lists, or copy, stop and fix it. That's a broken implementation, not a harmless interpretation.

Don't substitute a different hero composition or visual driver post-approval without user sign-off.

## Step F: Asset Slicing via the Asset Producer

Raster and SVG ingredients identified in Step E need clean production assets. Use the bundled `impeccable_asset_producer` subagent rather than producing inline.

Spawn it as a scoped subagent. If you do not have explicit permission to use agents, stop and ask:

```text
Asset production will work better as a scoped subagent job. Should I spawn the Impeccable asset producer subagent for this step?
```

Pass to the agent:

- Approved mock path or screenshot reference
- Crop paths or a contact sheet with crop ids
- Output directory (typically `assets/images/` for raster, `assets/svg/` or inline components for vector)
- Required dimensions and format. For raster: prefer WebP; emit multi-density `@1x`/`@2x`/`@3x` for iOS, or `mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi` for Android, unless the consumer is `expo-image` (single high-res source is fine there).
- Transparency requirements
- Avoid list
- App icon and splash screen dimensions when the brief calls for them (iOS: 1024×1024 master + `app.json` `icon`; Android: adaptive icon foreground + background or monochrome; splash: see `expo-splash-screen` spec)
- Notes on what should remain semantic RN / `react-native-svg` / Skia instead of raster

Attach image generation capability to the spawned agent when the harness supports it. Do **not** load image-generation reference material into the parent thread.

Inline asset production is allowed only if the user declines subagents, the harness cannot spawn the authorized agent, or the user explicitly asks for single-thread mode.

Prefer semantic RN, `react-native-svg`, or Skia when they can credibly reproduce an ingredient; reach for raster imagery when the mock or subject matter calls for actual photographic, illustrated, or product content. The skill ships vector-first by default — RN's SVG support is mature, and shipping pre-rasterized icons or ornaments is a regression unless the asset is genuinely raster-native.

## After This File

Once Steps A through F are complete, return to `craft.md` Step 4 (Build to Production Quality). The implementation builds against the confirmed palette (now landed in `tokens.ts`), the approved mock, and the assets the producer wrote.
