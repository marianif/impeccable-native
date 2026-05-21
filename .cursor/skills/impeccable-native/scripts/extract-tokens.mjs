#!/usr/bin/env node

/**
 * extract-tokens.mjs
 *
 * Parses .ts and .tsx files in the current working directory, finds
 * StyleSheet.create blocks and bare style objects, and surfaces duplicated
 * literal values (colors, sizes, radii, durations) that appear in 3+ places.
 *
 * Usage:
 *   node extract-tokens.mjs [--dry-run] [--min-count=N] [--dir=path]
 *
 * Flags:
 *   --dry-run       Print ranked candidates; do not write anything (default).
 *   --min-count=N   Minimum occurrences to report (default: 3).
 *   --dir=path      Root directory to scan (default: cwd).
 *
 * Output (stdout, JSON):
 *   {
 *     "colors":    [ { value, count, locations: [ { file, line } ] } ],
 *     "sizes":     [ ... ],
 *     "radii":     [ ... ],
 *     "durations": [ ... ],
 *     "summary":   { totalFiles, totalLiterals, candidates }
 *   }
 *
 * The script finds *literals*, not intent. Use output as a map:
 * values at the top of each list are the highest-priority extraction candidates.
 */

import fs from 'fs';
import path from 'path';

// ── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const minCount = (() => {
  const flag = args.find(a => a.startsWith('--min-count='));
  return flag ? parseInt(flag.split('=')[1], 10) : 3;
})();
const rootDir = (() => {
  const flag = args.find(a => a.startsWith('--dir='));
  return flag ? path.resolve(flag.split('=')[1]) : process.cwd();
})();

// ── file discovery ─────────────────────────────────────────────────────────

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.expo', '.metro-cache',
  'android', 'ios', '__generated__', 'coverage',
]);

function collectFiles(dir, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, results);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

// ── literal extraction ─────────────────────────────────────────────────────

// Color: hex #rgb / #rrggbb / #rrggbbaa (case-insensitive)
const COLOR_RE = /#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

// rgba/rgb functional notation
const RGBA_RE = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)/g;

// Numeric size literals used as style values — specifically in common style
// keys. We look for  someKey: NUMBER  patterns inside style objects/arrays.
// Keys that are clearly sizes/spacing/radii/font-related:
const SIZE_KEYS =
  'width|height|padding(?:Top|Bottom|Left|Right|Horizontal|Vertical)?|' +
  'margin(?:Top|Bottom|Left|Right|Horizontal|Vertical)?|' +
  'top|bottom|left|right|' +
  'fontSize|lineHeight|letterSpacing|' +
  'borderWidth|borderRadius|borderTopLeftRadius|borderTopRightRadius|' +
  'borderBottomLeftRadius|borderBottomRightRadius|' +
  'gap|rowGap|columnGap|' +
  'flex(?:Basis)?|minWidth|maxWidth|minHeight|maxHeight';
const SIZE_RE = new RegExp(`(?:${SIZE_KEYS})\\s*:\\s*(\\d+(?:\\.\\d+)?)`, 'g');

// Duration / delay in ms — keys used by Reanimated / tokens.motion
const DURATION_KEYS = 'duration|delay|damping|stiffness|mass|velocity|overshootClamping';
const DURATION_RE = new RegExp(`(?:${DURATION_KEYS})\\s*:\\s*(\\d+(?:\\.\\d+)?)`, 'g');

// borderRadius specifically (to bucket separately)
const RADIUS_KEYS =
  'borderRadius|borderTopLeftRadius|borderTopRightRadius|' +
  'borderBottomLeftRadius|borderBottomRightRadius';
const RADIUS_RE = new RegExp(`(?:${RADIUS_KEYS})\\s*:\\s*(\\d+(?:\\.\\d+)?)`, 'g');

/**
 * Extract all literal occurrences from a file's source text.
 * Returns arrays of { value, line } for each category.
 */
function extractLiterals(source, filePath) {
  const lines = source.split('\n');
  // Build a line-number index: character offset → line number (1-based)
  const lineOffsets = [];
  let offset = 0;
  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1; // +1 for \n
  }
  function charToLine(charIndex) {
    let lo = 0, hi = lineOffsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineOffsets[mid] <= charIndex) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  }

  const colors = [];
  const sizes = [];
  const radii = [];
  const durations = [];

  // Colors — hex
  for (const m of source.matchAll(COLOR_RE)) {
    colors.push({ value: m[0].toLowerCase(), line: charToLine(m.index) });
  }
  // Colors — rgba/rgb
  for (const m of source.matchAll(RGBA_RE)) {
    // Normalize whitespace for dedup
    const normalized = m[0].replace(/\s+/g, '');
    colors.push({ value: normalized.toLowerCase(), line: charToLine(m.index) });
  }

  // Radii (before sizes so we can exclude from sizes)
  const radiusPositions = new Set();
  for (const m of source.matchAll(RADIUS_RE)) {
    const val = parseFloat(m[1]);
    if (val > 0) {
      radii.push({ value: val, line: charToLine(m.index) });
      radiusPositions.add(m.index);
    }
  }

  // Sizes — exclude positions already captured as radii
  for (const m of source.matchAll(SIZE_RE)) {
    if (radiusPositions.has(m.index)) continue;
    const val = parseFloat(m[1]);
    // Skip values that are almost certainly intentional one-offs (0, 1, flex: 1)
    if (val > 1) {
      sizes.push({ value: val, line: charToLine(m.index) });
    }
  }

  // Durations
  for (const m of source.matchAll(DURATION_RE)) {
    const val = parseFloat(m[1]);
    if (val > 0) {
      durations.push({ value: val, line: charToLine(m.index) });
    }
  }

  return { colors, sizes, radii, durations };
}

// ── aggregation ────────────────────────────────────────────────────────────

/**
 * Given an array of { value, file, line }, group by value, count occurrences,
 * and return entries with count >= minCount, sorted by count desc.
 */
function aggregate(entries, min) {
  const map = new Map();
  for (const { value, file, line } of entries) {
    const key = String(value);
    if (!map.has(key)) map.set(key, { value, count: 0, locations: [] });
    const entry = map.get(key);
    entry.count++;
    // Keep locations list bounded — up to 20 examples is enough for a map
    if (entry.locations.length < 20) {
      entry.locations.push({ file, line });
    }
  }
  return [...map.values()]
    .filter(e => e.count >= min)
    .sort((a, b) => b.count - a.count);
}

// ── main ───────────────────────────────────────────────────────────────────

function run() {
  if (!fs.existsSync(rootDir)) {
    process.stderr.write(
      `extract-tokens: directory not found: ${rootDir}\n` +
      `  Run from the root of your React Native project, or pass --dir=path.\n`
    );
    process.exit(1);
  }

  const files = collectFiles(rootDir);

  if (files.length === 0) {
    process.stderr.write(
      `extract-tokens: no .ts/.tsx files found under ${rootDir}\n` +
      `  Check that you are running from your project root.\n`
    );
    process.exit(1);
  }

  const allColors = [];
  const allSizes = [];
  const allRadii = [];
  const allDurations = [];
  let totalLiterals = 0;

  for (const filePath of files) {
    let source;
    try {
      source = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    // Relative path for readable output
    const rel = path.relative(rootDir, filePath);
    const { colors, sizes, radii, durations } = extractLiterals(source, filePath);

    for (const c of colors) allColors.push({ ...c, file: rel });
    for (const s of sizes) allSizes.push({ ...s, file: rel });
    for (const r of radii) allRadii.push({ ...r, file: rel });
    for (const d of durations) allDurations.push({ ...d, file: rel });

    totalLiterals += colors.length + sizes.length + radii.length + durations.length;
  }

  const colors = aggregate(allColors, minCount);
  const sizes = aggregate(allSizes, minCount);
  const radii = aggregate(allRadii, minCount);
  const durations = aggregate(allDurations, minCount);

  const candidates = colors.length + sizes.length + radii.length + durations.length;

  const result = {
    colors,
    sizes,
    radii,
    durations,
    summary: {
      totalFiles: files.length,
      totalLiterals,
      candidates,
      minCount,
      note: candidates === 0
        ? 'No duplicated literals found above the threshold. Either the codebase already uses tokens, or --min-count is too high.'
        : `${candidates} candidate(s) found. Values with the highest count are the best extraction targets.`,
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(0);
}

try {
  run();
} catch (err) {
  process.stderr.write(`extract-tokens: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
