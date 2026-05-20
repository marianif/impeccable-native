### Purpose

Resolve one stable target, run two independent assessments, synthesize a design critique for a React Native / Expo surface, persist a snapshot, and ask the user what to improve next. The chat response is the primary deliverable; the snapshot is an archive/backlog for future commands.

Before assessing: confirm the flavor detector has run for this session (`node {{scripts_path}}/detect-rn-flavor.mjs`) and that `load-context.mjs` has surfaced PRODUCT.md + DESIGN.md. `Platform Fidelity` and `Primary Devices` from PRODUCT.md set the bar for what counts as a finding.

### Hard Invariants

- Assessment A (design review) and Assessment B (implementation evidence) are both required.
- Assessment A must finish before implementation findings enter the parent synthesis context. Code-level evidence is concrete, but it still anchors judgment.
- If sub-agents are unavailable, fall back sequentially: finish and record Assessment A first, then run Assessment B, then synthesize.
- A skipped implementation scan is a failed critique run unless the scripts are missing or crash after a real attempt.
- **Platform parity is non-negotiable** (Constitution Principle IV). Visual inspection must cover iOS Simulator **and** Android Emulator. A single-platform critique is incomplete and must be reported as such.
- Any simulator/emulator process started for screenshotting must be left in the state the user expects (already-running stays running; freshly booted by you gets shut down or noted), and the action recorded in Run Notes.

### Setup

1. **Resolve the target** to a concrete file path. Prefer the component / screen source over a route name when both identify the same surface; routes are renamed, paths are stabler.
   - "the home tab" → `app/(tabs)/index.tsx` (Expo Router) or `src/screens/HomeScreen.tsx`
   - "the settings sheet" → the primary component file (`components/SettingsSheet.tsx`)
   - "this screen" → the screen file currently rendered in the sim
2. **Compute the slug**:
   ```bash
   node {{scripts_path}}/critique-storage.mjs slug "<resolved-path>"
   ```
   Keep it. If the command exits non-zero, skip persistence and trend for this run, but continue the critique.
3. **Read `.impeccable/critique/ignore.md`** if it exists. Drop matching findings silently; it is the only prior-run input critique consumes.

### Assessment Orchestration

Delegate Assessment A and Assessment B to separate sub-agents when possible. They must not see each other's output. Do not show findings to the user until synthesis.

<codex>
Codex sub-agent gate:
- If `spawn_agent` is exposed and the user explicitly allowed sub-agents, delegation, or parallel agent work, spawn A and B immediately.
- If `spawn_agent` is exposed but the user did not explicitly allow sub-agents, ask exactly once: "impeccable-native critique is designed to run two independent sub-agents for an unanchored assessment. May I use sub-agents for this critique?" Then stop until the user answers.
- If allowed, spawn A and B. If declined, run sequentially and report `Assessment independence: degraded (sub-agents declined by user)`.
- If `spawn_agent` is not exposed, do not ask; run sequentially and report `Assessment independence: degraded (spawn_agent unavailable in this session)`.
- If spawning fails after permission, run sequentially and report `Assessment independence: degraded (sub-agent spawn failed: <exact error>)`.
Prefer `fork_context: false` with self-contained prompts containing cwd, target, sim/emulator state, references, PRODUCT.md + DESIGN.md, and output contract. If using `fork_context: true`, omit `agent_type`, `model`, and `reasoning_effort`.
</codex>

### Assessment A: Design Review

Read the target source file and its primary collaborators (theme provider, navigation host, the screens that link in). Pair source reading with simulator screenshots from both platforms.

**Capture screenshots first** (one set per platform; light + dark; default font scale + 2× Dynamic Type if Adaptive is in scope):
```bash
node {{scripts_path}}/screenshot.mjs --platform ios --slug <slug>
node {{scripts_path}}/screenshot.mjs --platform android --slug <slug>
```
If `screenshot.mjs` is missing or fails for one platform, capture the other and report the gap. Do not synthesize without at least one platform's imagery.

Evaluate, thinking like a design director:

- **AI slop**: would someone believe "AI made this" immediately? Check all DON'T guidance from the parent impeccable-native skill (gradient buttons, purple-to-pink, generic Material 3 defaults, identical card grids, bounce-on-everything, etc.).
- **Mobile-native fit**: thumb-zone reachability, primary action within thumb arc, gesture conflicts, system back behavior on Android, FAB / hamburger / modal misuse, bottom-sheet appropriateness.
- **Holistic design**: hierarchy, IA, emotional fit, discoverability, composition, typography, color, states (loading / empty / error / success), copy, edge cases (long names, slow network, offline).
- **Cognitive load**: consult [cognitive-load](cognitive-load.md); report checklist failures and any decision point with >4 visible options on screen.
- **Emotional journey**: peak-end rule, emotional valleys at high-stakes moments (paywall, delete, sign-out, permissions priming), reassurance moments.
- **Nielsen heuristics**: consult [heuristics-scoring](heuristics-scoring.md); score all 10 heuristics 0–4 with mobile interpretation (e.g. *Visibility of System Status* covers loading skeletons, pull-to-refresh feedback, optimistic UI; *User Control and Freedom* covers swipe-to-go-back on iOS, Android hardware back, undo toasts).

Return: AI slop verdict, heuristic scores, cognitive load summary, emotional journey notes, 2–3 strengths, 3–5 priority issues, persona red flags, minor observations, and provocative questions. Reference specific screenshots by name where relevant.

### Assessment B: Implementation Evidence

Run code-level scans on the target file (and its directly imported children, when small enough to include). Assessment B is mandatory and must remain isolated from Assessment A until both are complete.

Run the available scanners:
```bash
node {{scripts_path}}/a11y-audit.mjs --json <target>
node {{scripts_path}}/platform-parity.mjs --json <target>
node {{scripts_path}}/extract-tokens.mjs --json --dry-run <target>
```

- `a11y-audit.mjs` — static analysis: every `Pressable` / `TouchableOpacity` has `accessibilityRole` + `accessibilityLabel`; every `Image` either declares `accessibilityLabel` or is hidden; no labels on purely decorative elements.
- `platform-parity.mjs` — flags iOS-only `shadowColor` without `elevation`, missing `Platform.select` on platform-divergent props, `KeyboardAvoidingView` without per-platform `behavior`, iOS-only haptics, `BackHandler` missing where Android back should close a modal/sheet.
- `extract-tokens.mjs --dry-run` — surfaces duplicated literals (colors, sizes, durations) in the file that should route through `tokens.ts`.

If any scanner is missing or crashes, report the deterministic scan unavailable for that dimension and continue with manual review of the same checks.

**Manual checks** (the scanners don't cover everything):

- Inline `style={{ ... }}` literals inside `FlatList` / `SectionList` `renderItem`.
- `keyExtractor` present and stable (not array index for mutable lists).
- Animations: Reanimated worklets via `useSharedValue` + `useAnimatedStyle`, or `Animated` with `useNativeDriver: true` for `transform` / `opacity` only. Layout-property animation (`width` / `height` / `top` / `padding`) is a finding.
- `useReducedMotion()` consumed by every animated component.
- `useColorScheme()` called once at the provider, not scattered inline.
- Custom font loading gated by splash so first paint isn't system font.
- Safe areas: `useSafeAreaInsets()` or `SafeAreaView` with explicit `edges`, no hardcoded `paddingTop: 44`.

**Simulator-driven probes** (run the surface, don't just read it):

- **VoiceOver pass on iOS**: enable VoiceOver, swipe through the screen, verify reading order and that every interactive element announces role + label + state.
- **TalkBack pass on Android**: enable TalkBack, repeat. Note any iOS-only or Android-only a11y findings.
- **Dynamic Type 2× on iOS** / **font scale Large on Android**: layout holds, nothing clips.
- **Light → Dark toggle**: every surface flips; no near-white surfaces on OLED, no unreadable text on dark backgrounds.
- **Reduce Motion on iOS** / **Remove Animations on Android**: animations substitute or skip; no broken transitions.
- **Android hardware/gesture back**: closes modals/sheets correctly; does not leak out of the app from a deep stack.
- **Keyboard avoidance**: open the form, focus each input, confirm visibility above the keyboard on both platforms.

Return: scanner JSON findings (file:line), manual checks pass/fail, simulator-probe results per platform, false positives, and any platform left unverified.

After Assessment B returns usable scanner findings, reuse them. Do not rerun the scanners in the parent unless Assessment B failed, was truncated, or omitted file locations or rule names.

<codex>
Codex failure accounting: final Run Notes must include target slug, ignore list, assessment independence, scanners run (a11y, parity, tokens), screenshots captured per platform, simulator probes per platform, and any fallback signal used. Do not run repo status checks, late spelunking, or unrelated verification after the report is assembled.
</codex>

### Generate Combined Critique Report

Synthesize both assessments into a single report. Do NOT simply concatenate. Weave the findings together, noting where the design review and code scan agree, where the scanner caught issues the review missed, and where scanner findings are false positives.

The chat response is the primary user-facing deliverable. Present the full structured critique below in chat; do not replace it with a summary and a link. The persisted snapshot is only an archive/backlog for later commands.

<codex>
Codex final-answer note: `$impeccable-native critique` produces a report artifact, so the final chat response should intentionally exceed the usual concise close-out style. Do not title the final response "Critique Summary" unless the user explicitly asked for a summary.
</codex>

Structure your feedback as a design director would:

#### Design Health Score
> *Consult [heuristics-scoring](heuristics-scoring.md)*

Present the Nielsen's 10 heuristics scores as a table, interpreted for mobile:

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | ? | [skeleton/spinner/optimistic UI gap, or "n/a" if solid] |
| 2 | Match System / Real World | ? | [platform-fidelity stance honored? iOS-isms on Android?] |
| 3 | User Control and Freedom | ? | [undo / swipe-back / Android back / cancel paths] |
| 4 | Consistency and Standards | ? | [tokens consumed? platform primitives used?] |
| 5 | Error Prevention | ? | [destructive actions guarded? form validation early?] |
| 6 | Recognition Rather Than Recall | ? | [icon-only nav, hidden gestures, undiscoverable affordances] |
| 7 | Flexibility and Efficiency | ? | [haptics, gestures, shortcuts for repeat users] |
| 8 | Aesthetic and Minimalist Design | ? | [AI-slop tells, decoration without purpose] |
| 9 | Error Recovery | ? | [error states, offline state, retry affordance] |
| 10 | Help and Documentation | ? | [empty states, first-run, contextual hints] |
| **Total** | | **??/40** | **[Rating band]** |

Be honest with scores. A 4 means genuinely excellent. Most real interfaces score 20–32.

#### Platform Coverage

State clearly which platforms were inspected and how:

- **iOS**: simulator [device], system version, light + dark, default + 2× Dynamic Type, VoiceOver pass [yes/no], Reduce Motion pass [yes/no]
- **Android**: emulator [device], API level, light + dark, default + Large font scale, TalkBack pass [yes/no], Remove Animations pass [yes/no]

If only one platform was inspected, **this critique is incomplete by Constitution Principle IV**. Say so plainly and recommend re-running with the second platform.

#### Anti-Patterns Verdict

**Start here.** Does this look AI-generated, or like a mobile app made of platform shortcuts?

**Design review assessment**: your own evaluation of AI slop tells. Cover overall aesthetic feel, layout sameness, generic composition, missed opportunities for personality, mobile-native fit (thumb zone, gestures, sheet vs modal vs full-screen).

**Implementation scan**: summarize what the scanners found, with counts and file:line locations. Note any additional issues caught (missing `accessibilityRole`, iOS-only shadow, duplicated literals) and flag false positives.

**Simulator probes**: report VoiceOver / TalkBack / Dynamic Type / Reduce Motion / system-back outcomes per platform. If a probe was skipped, say which and why.

#### Overall Impression
A brief gut reaction: what works, what doesn't, and the single biggest opportunity. Frame it for a thumb in motion, not a mouse on a 24-inch display.

#### What's Working
Highlight 2–3 things done well. Be specific about why they work (the token discipline, the haptic moment, the empty state, the platform-correct shadow).

#### Priority Issues
The 3–5 most impactful design problems, ordered by importance.

For each issue, tag with **P0–P3 severity** (consult [heuristics-scoring](heuristics-scoring.md) for severity definitions; mobile-specific: P0 includes "fails on one platform but not the other" when the stance demands parity):

- **[P?] What**: name the problem clearly
- **Where**: component / file:line, and platform (iOS / Android / both)
- **Why it matters**: how this hurts users or undermines goals (which persona, which moment, which platform)
- **Fix**: what to do about it — name the specific RN primitive, hook, or token
- **Suggested command**: which impeccable-native command could address this (from: {{available_commands}})

#### Persona Red Flags
> *Consult [personas](personas.md)*

Auto-select 2–3 personas most relevant to this surface (use the selection table in the reference). If PRODUCT.md contains a `## Design Context` section from `impeccable-native teach`, also generate 1–2 project-specific personas from the audience/brand info.

For each selected persona, walk through the primary user action and list specific red flags found. Be mobile-specific:

**Alex (Power User)**: no swipe-to-archive on the list, no long-press context menu, no haptic on key actions. Primary action requires 3 taps and a modal when a swipe action would do it in one.

**Jordan (First-Timer)**: icon-only bottom tabs (no labels), hidden onboarding behind a horizontal scroll, permissions priming missing before the system prompt — likely to deny camera access permanently.

**Sam (Accessibility-First)**: bottom sheet has no `accessibilityRole="dialog"`, VoiceOver reads the dim overlay as a button, focus does not trap inside the sheet, Dynamic Type 2× clips the CTA off-screen on iPhone SE.

Be specific. Name the exact elements and interactions that fail each persona. Don't write generic persona descriptions; write what broke for them.

#### Minor Observations
Quick notes on smaller issues worth addressing — copy nits, spacing inconsistencies, missing haptics on a key moment, a token that could be reused, a `numberOfLines` that should be `2` not `1`.

#### Questions to Consider
Provocative questions that might unlock better solutions:
- "What if the primary action were a bottom-sheet confirm with haptic, instead of a destructive modal?"
- "Does this screen need to be a screen, or could it be a sheet pushed from the prior one?"
- "What does this look like on a one-handed commute, on Android, with Large font scale?"

<codex>
#### Run Notes
Keep this compact. Include status for target slug, ignore list, assessment independence, scanners run (a11y, parity, tokens), screenshots captured per platform, simulator probes per platform (VoiceOver/TalkBack, Dynamic Type, Reduce Motion, system back, keyboard avoidance), and temp-file cleanup. For failed or skipped steps, give the concrete observed reason and the fallback signal used. In the final chat response, also include snapshot write and trend read status after persistence has run.

Codex Run Notes are final-chat only. Do not include this section in the persisted snapshot body, because persistence, trend read, and temp cleanup happen after the snapshot write and would otherwise archive stale status such as "pending after persistence."
</codex>

**Remember**:
- Be direct. Vague feedback wastes everyone's time.
- Be specific. "The submit button on iOS, line 142," not "some elements."
- Say what's wrong AND why it matters to users on a phone.
- Give concrete suggestions. Name the primitive, hook, or token. Cut "consider exploring..." entirely.
- Prioritize ruthlessly. If everything is P0, nothing is.
- Don't soften criticism. Developers need honest feedback to ship great mobile design.
- **Never score Platform Fidelity from one platform only.** If you couldn't inspect both, say so and call it incomplete.

### Persist the Snapshot

Once the report above is finalized, write it to `.impeccable/critique/` so the user can refer back, and so `{{command_prefix}}impeccable-native polish` can pick up the priority issues without a copy-paste.

Skip this step if the Setup slug was null (vague or root-level target).

1. **Write the body to a temp file** so you can pipe it to the helper. Use the full critique report (heuristic table, platform coverage, anti-patterns verdict, priority issues, persona red flags, minor observations, and questions), but stop before the "Ask the User" / "Recommended Actions" sections that come later.

   <codex>
   Codex: exclude Run Notes from the temp body file; Run Notes are final-chat only because persistence, trend read, and temp cleanup happen after the snapshot write.
   </codex>

2. **Pass the structured metadata** through `IMPECCABLE_CRITIQUE_META` (JSON), then run the write command:
   ```bash
   IMPECCABLE_CRITIQUE_META='{"target":"<user phrasing>","total_score":<n>,"p0_count":<n>,"p1_count":<n>,"platforms":["ios","android"]}' \
     node {{scripts_path}}/critique-storage.mjs write <slug> <body-file>
   ```
   The helper prints the absolute path it wrote. If only one platform was inspected, pass that platform alone and mark `"incomplete": true`.

3. **Delete the temp body file** after the write attempt completes, whether the write succeeded or failed. If deletion fails, mention `temp-file cleanup failed: <reason>` briefly in the final output, but do not block the critique.

4. **Read the trend** for context:
   ```bash
   node {{scripts_path}}/critique-storage.mjs trend <slug> 5
   ```
   This returns a JSON array of the last 5 frontmatter entries (including the one you just wrote).

5. **Append a single line to the user-visible output**, after the report and before the questions:

   > **Trend for `<slug>` (last 5 runs): 24 → 28 → 32 → 29 → 32**
   > Wrote `.impeccable/critique/<filename>`.

   If this is the first run for the slug, the trend is just one score; say so: "First run for this target, no trend yet."

This is fire-and-forget. Do not show the user the helper's JSON output; only the human-readable trend line and the written path. Failures here should not block the rest of the flow; print the error and move on.

### Ask the User

**After presenting findings**, use targeted questions based on what was actually found. {{ask_instruction}} These answers will shape the action plan.

Ask questions along these lines (adapt to the specific findings; do NOT ask generic questions):

1. **Priority direction**: based on the issues found, ask which category matters most to the user right now. For example: "I found problems with platform parity (iOS-only shadows, missing TalkBack labels), Dynamic Type clipping, and a FAB that's doing secondary-action work. Which area should we tackle first?" Offer the top 2–3 issue categories as options.

2. **Design intent**: if the critique found a tonal or platform-stance mismatch, ask whether it was intentional. For example: "The interface uses Material ripple on every Pressable but PRODUCT.md says `cupertino-everywhere`. Is the stance moving toward custom-cross-platform, or should we strip the ripples?" Offer 2–3 directions tied to the findings.

3. **Scope**: ask how much the user wants to take on. For example: "I found N issues across iOS and Android. Want to address everything, focus on P0 + P1, or fix only the platform-parity gaps first?" Offer scope options.

4. **Constraints** (optional; only ask if relevant): if the findings touch many areas, ask if anything is off-limits. For example: "Should any screens stay as-is for this release?" This prevents the plan from touching things the user considers done.

**Rules for questions**:
- Every question must reference specific findings from the report. Never ask generic "who is your audience?" questions.
- Keep it to 2–4 questions maximum. Respect the user's time.
- Offer concrete options, not open-ended prompts.
- If findings are straightforward (e.g. only 1–2 clear issues), skip questions and go directly to Recommended Actions.

<codex>
Codex final-question gate: The user-visible response must either include the targeted questions or explicitly say `Questions skipped: <reason>` because the findings were straightforward. Each question must include 2–3 concrete answer options tied to the actual critique findings. Do not end with only open-ended questions.
</codex>

### Recommended Actions

**After receiving the user's answers**, present a prioritized action summary reflecting the user's priorities and scope from Ask the User.

#### Action Summary

List recommended commands in priority order, based on the user's answers:

1. **`{{command_prefix}}impeccable-native <command>`**: brief description of what to fix (specific context from critique findings, e.g. "harden the New-Item bottom sheet — Android back leaks, focus doesn't trap, no haptic on confirm").
2. **`{{command_prefix}}impeccable-native <command>`**: brief description (specific context).
...

**Rules for recommendations**:
- Only recommend commands from: {{available_commands}}
- Order by the user's stated priorities first, then by impact
- Each item's description should carry enough context that the command knows what to focus on
- Map each Priority Issue to the appropriate command (e.g. platform-parity issues → `harden` or `adapt`; AI-slop → `quieter` or `bolder`; Dynamic Type clipping → `adapt`; token leakage → `extract`)
- Skip commands that would address zero issues
- If the user chose a limited scope, only include items within that scope
- If the user marked areas as off-limits, exclude commands that would touch those areas
- End with `{{command_prefix}}impeccable-native polish` as the final step if any fixes were recommended

After presenting the summary, tell the user:

> You can ask me to run these one at a time, all at once, or in any order you prefer.
>
> Re-run `{{command_prefix}}impeccable-native critique` after fixes to see your score improve — and re-verify on both iOS and Android.
