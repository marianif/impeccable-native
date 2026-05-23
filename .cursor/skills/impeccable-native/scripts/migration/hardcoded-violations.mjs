#!/usr/bin/env node

/**
 * hardcoded-violations.mjs
 *
 * Finds every place the codebase bypasses the token system: inline hex colors,
 * magic spacing numbers, raw fontSizes, magic borderRadius, etc.
 *
 * These are the screens that won't respond to token changes after migration.
 * A high violation count is a "fix violations first" blocker for the migration.
 *
 * Usage:
 *   node hardcoded-violations.mjs [--scope-file=path] [--dir=path]
 *
 * Output (stdout, JSON):
 *   {
 *     "violations": [ { file, line, col, kind, value, nearestToken, context } ],
 *     "byFile":     { "<file>": count },
 *     "byKind":     { "<kind>": count },
 *     "totalCount": N,
 *     "verdict":    "clean | moderate | severe",
 *     "recommendation": "...",
 *     "summary":    { fileCount, violationCount, verdict }
 *   }
 */

import fs from 'fs';
import path from 'path';

// ── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function flag(name) {
  const f = args.find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
}

const rootDir = path.resolve(flag('dir') ?? process.cwd());
const scopeFilePath = flag('scope-file');

// ── scope loading ──────────────────────────────────────────────────────────

function loadScope() {
  if (scopeFilePath) return JSON.parse(fs.readFileSync(path.resolve(scopeFilePath), 'utf-8'));
  const cached = path.join(rootDir, '.impeccable', 'migration-scope.json');
  if (fs.existsSync(cached)) return JSON.parse(fs.readFileSync(cached, 'utf-8'));
  return null;
}

// ── violation detectors ────────────────────────────────────────────────────

/**
 * Each detector returns an array of { line, col, kind, value, nearestToken }.
 * They operate on a single file's source string + split lines array.
 */

// Hex colors: #fff, #f0f0f0, #RGBA (4/8 hex digit forms too)
const HEX_RE = /#([0-9a-fA-F]{3,8})\b/g;
// rgb/rgba literals
const RGB_RE = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)/g;
// hsl/hsla literals
const HSL_RE = /hsla?\(\s*\d+\s*,\s*[\d.]+%\s*,\s*[\d.]+%(?:\s*,\s*[\d.]+)?\s*\)/g;

// Magic spacing: fontSize, padding, margin, gap, width, height, borderRadius
// as literal numbers in StyleSheet.create or inline style objects.
// Pattern: propertyName: <number> (not inside a token accessor)
const MAGIC_SPACING_RE = /\b(padding(?:Horizontal|Vertical|Top|Bottom|Left|Right|Start|End)?|margin(?:Horizontal|Vertical|Top|Bottom|Left|Right|Start|End)?|gap|rowGap|columnGap|width|height|minWidth|maxWidth|minHeight|maxHeight|size)\s*:\s*(\d+(?:\.\d+)?)\b/g;
const MAGIC_RADIUS_RE = /\b(borderRadius|borderTopLeftRadius|borderTopRightRadius|borderBottomLeftRadius|borderBottomRightRadius)\s*:\s*(\d+(?:\.\d+)?)\b/g;
const MAGIC_FONTSIZE_RE = /\b(fontSize|lineHeight|letterSpacing)\s*:\s*(\d+(?:\.\d+)?)\b/g;

// Named color strings: 'red', 'blue', 'transparent' are often fine but
// 'dodgerblue', 'tomato', custom named literals are violations.
const NAMED_COLOR_STRINGS = new Set([
  'aliceblue','antiquewhite','aqua','aquamarine','azure','beige','bisque',
  'blanchedalmond','blueviolet','brown','burlywood','cadetblue','chartreuse',
  'chocolate','coral','cornflowerblue','cornsilk','crimson','cyan',
  'darkblue','darkcyan','darkgoldenrod','darkgray','darkgreen','darkkhaki',
  'darkmagenta','darkolivegreen','darkorange','darkorchid','darkred',
  'darksalmon','darkseagreen','darkslateblue','darkslategray','darkturquoise',
  'darkviolet','deeppink','deepskyblue','dimgray','dodgerblue','firebrick',
  'floralwhite','forestgreen','fuchsia','gainsboro','ghostwhite','gold',
  'goldenrod','greenyellow','honeydew','hotpink','indianred','indigo',
  'ivory','khaki','lavender','lavenderblush','lawngreen','lemonchiffon',
  'lightblue','lightcoral','lightcyan','lightgoldenrodyellow','lightgray',
  'lightgreen','lightpink','lightsalmon','lightseagreen','lightskyblue',
  'lightslategray','lightsteelblue','lightyellow','lime','limegreen','linen',
  'magenta','maroon','mediumaquamarine','mediumblue','mediumorchid',
  'mediumpurple','mediumseagreen','mediumslateblue','mediumspringgreen',
  'mediumturquoise','mediumvioletred','midnightblue','mintcream','mistyrose',
  'moccasin','navajowhite','navy','oldlace','olive','olivedrab','orange',
  'orangered','orchid','palegoldenrod','palegreen','paleturquoise',
  'palevioletred','papayawhip','peachpuff','peru','pink','plum','powderblue',
  'rebeccapurple','rosybrown','royalblue','saddlebrown','salmon','sandybrown',
  'seagreen','seashell','sienna','silver','skyblue','slateblue','slategray',
  'snow','springgreen','steelblue','tan','teal','thistle','tomato','turquoise',
  'violet','wheat','yellowgreen',
]);

// Safe magic numbers that are almost certainly intentional (0, 1, 100%, flex values)
const SAFE_MAGIC_NUMBERS = new Set([0, 1, 2, 100]);
const SAFE_FLEX_NUMBERS = new Set([0, 1, 2, 3, 4, 5, 6]);

function lineAndCol(source, index) {
  const before = source.slice(0, index);
  const line = before.split('\n').length;
  const col = index - before.lastIndexOf('\n');
  return { line, col };
}

function extractLineContext(lines, lineNum) {
  return (lines[lineNum - 1] ?? '').trim().slice(0, 80);
}

// Detect if a number is inside a token accessor (not a magic number)
// e.g. theme.spacing[16] or spacing.md → not a violation
function isInsideTokenAccessor(source, matchIndex) {
  const before = source.slice(Math.max(0, matchIndex - 40), matchIndex);
  return /(?:theme|tokens?|spacing|colors?|palette)\s*[\[.]\s*$/.test(before);
}

function detectHexColors(source, lines, relPath) {
  const violations = [];
  HEX_RE.lastIndex = 0;
  for (const m of source.matchAll(HEX_RE)) {
    // Skip inside token files — they're defining the system
    if (/(?:tokens?|theme|colors?|palette)\.(ts|tsx|js)$/.test(relPath)) continue;
    // Skip comments
    const lineText = lines[lineAndCol(source, m.index).line - 1] ?? '';
    if (lineText.trim().startsWith('//') || lineText.trim().startsWith('*')) continue;
    const pos = lineAndCol(source, m.index);
    violations.push({
      kind: 'inline-color',
      value: m[0],
      nearestToken: null,
      line: pos.line,
      col: pos.col,
      context: extractLineContext(lines, pos.line),
    });
  }
  return violations;
}

function detectRgbColors(source, lines, relPath) {
  if (/(?:tokens?|theme|colors?|palette)\.(ts|tsx|js)$/.test(relPath)) return [];
  const violations = [];
  for (const re of [RGB_RE, HSL_RE]) {
    re.lastIndex = 0;
    for (const m of source.matchAll(re)) {
      const pos = lineAndCol(source, m.index);
      const lineText = lines[pos.line - 1] ?? '';
      if (lineText.trim().startsWith('//')) continue;
      violations.push({
        kind: 'inline-color',
        value: m[0],
        nearestToken: null,
        line: pos.line,
        col: pos.col,
        context: extractLineContext(lines, pos.line),
      });
    }
  }
  return violations;
}

function detectNamedColors(source, lines) {
  const violations = [];
  const namedRe = /['"]([a-z]{4,})['"]/g;
  namedRe.lastIndex = 0;
  for (const m of source.matchAll(namedRe)) {
    if (!NAMED_COLOR_STRINGS.has(m[1])) continue;
    const pos = lineAndCol(source, m.index);
    violations.push({
      kind: 'inline-color',
      value: m[1],
      nearestToken: null,
      line: pos.line,
      col: pos.col,
      context: extractLineContext(lines, pos.line),
    });
  }
  return violations;
}

function detectMagicSpacing(source, lines) {
  const violations = [];
  MAGIC_SPACING_RE.lastIndex = 0;
  for (const m of source.matchAll(MAGIC_SPACING_RE)) {
    const num = parseFloat(m[2]);
    if (SAFE_MAGIC_NUMBERS.has(num)) continue;
    if (isInsideTokenAccessor(source, m.index)) continue;
    const pos = lineAndCol(source, m.index);
    violations.push({
      kind: 'magic-spacing',
      value: `${m[1]}: ${m[2]}`,
      nearestToken: suggestSpacingToken(num),
      line: pos.line,
      col: pos.col,
      context: extractLineContext(lines, pos.line),
    });
  }
  return violations;
}

function detectMagicRadius(source, lines) {
  const violations = [];
  MAGIC_RADIUS_RE.lastIndex = 0;
  for (const m of source.matchAll(MAGIC_RADIUS_RE)) {
    const num = parseFloat(m[2]);
    if (SAFE_FLEX_NUMBERS.has(num)) continue;
    if (isInsideTokenAccessor(source, m.index)) continue;
    const pos = lineAndCol(source, m.index);
    violations.push({
      kind: 'magic-radius',
      value: `${m[1]}: ${m[2]}`,
      nearestToken: suggestRadiusToken(num),
      line: pos.line,
      col: pos.col,
      context: extractLineContext(lines, pos.line),
    });
  }
  return violations;
}

function detectMagicFontSize(source, lines) {
  const violations = [];
  MAGIC_FONTSIZE_RE.lastIndex = 0;
  for (const m of source.matchAll(MAGIC_FONTSIZE_RE)) {
    const num = parseFloat(m[2]);
    if (SAFE_FLEX_NUMBERS.has(num)) continue;
    if (isInsideTokenAccessor(source, m.index)) continue;
    const pos = lineAndCol(source, m.index);
    violations.push({
      kind: 'magic-fontsize',
      value: `${m[1]}: ${m[2]}`,
      nearestToken: suggestTypographyToken(num),
      line: pos.line,
      col: pos.col,
      context: extractLineContext(lines, pos.line),
    });
  }
  return violations;
}

// ── nearest-token suggestions ──────────────────────────────────────────────

const SPACING_SCALE = [
  [2, 'spacing.xxs'], [4, 'spacing.xs'], [8, 'spacing.sm'],
  [12, 'spacing.md'], [16, 'spacing.lg'], [20, 'spacing.xl'],
  [24, 'spacing.2xl'], [32, 'spacing.3xl'], [40, 'spacing.4xl'],
  [48, 'spacing.5xl'],
];

const RADIUS_SCALE = [
  [2, 'radii.xs'], [4, 'radii.sm'], [8, 'radii.md'],
  [12, 'radii.lg'], [16, 'radii.xl'], [24, 'radii.2xl'],
  [9999, 'radii.full'],
];

const FONT_SCALE = [
  [10, 'type.xs'], [12, 'type.sm'], [14, 'type.md'],
  [16, 'type.lg'], [18, 'type.xl'], [20, 'type.2xl'],
  [24, 'type.3xl'], [28, 'type.4xl'], [32, 'type.5xl'],
];

function nearestFromScale(value, scale) {
  let best = scale[0][1];
  let bestDist = Math.abs(value - scale[0][0]);
  for (const [sv, label] of scale) {
    const dist = Math.abs(value - sv);
    if (dist < bestDist) { bestDist = dist; best = label; }
  }
  return best;
}

function suggestSpacingToken(n) { return nearestFromScale(n, SPACING_SCALE); }
function suggestRadiusToken(n) { return nearestFromScale(n, RADIUS_SCALE); }
function suggestTypographyToken(n) { return nearestFromScale(n, FONT_SCALE); }

// ── verdict ────────────────────────────────────────────────────────────────

function computeVerdict(count, fileCount) {
  const density = count / Math.max(fileCount, 1);
  if (count === 0) return 'clean';
  if (count < 10 || density < 2) return 'moderate';
  return 'severe';
}

function buildRecommendation(verdict, count) {
  if (verdict === 'clean') return 'No hardcoded values found — ready to migrate.';
  if (verdict === 'moderate') {
    return `${count} hardcoded value(s) found. Consider fixing before migration — these files won't respond to token changes.`;
  }
  return `${count} hardcoded values found across multiple files. Resolve violations before migration — the new token system cannot reach these values and the migration will produce inconsistent results.`;
}

// ── main ───────────────────────────────────────────────────────────────────

function run() {
  const scopeData = loadScope();
  if (!scopeData) {
    process.stderr.write(
      'hardcoded-violations: no scope data found.\n' +
      '  Run migration-scope.mjs first, or pass --scope-file=path.\n'
    );
    process.exit(1);
  }

  const scopeFiles = [
    ...(scopeData.screens?.map(s => s.file) ?? []),
    ...(scopeData.components ?? []),
  ];

  const violations = [];
  const byFile = {};
  const byKind = {};

  for (const relPath of scopeFiles) {
    const absPath = path.resolve(rootDir, relPath);
    let source;
    try { source = fs.readFileSync(absPath, 'utf-8'); } catch { continue; }
    const lines = source.split('\n');

    const fileViolations = [
      ...detectHexColors(source, lines, relPath),
      ...detectRgbColors(source, lines, relPath),
      ...detectNamedColors(source, lines),
      ...detectMagicSpacing(source, lines),
      ...detectMagicRadius(source, lines),
      ...detectMagicFontSize(source, lines),
    ];

    for (const v of fileViolations) {
      violations.push({ file: relPath, ...v });
      byFile[relPath] = (byFile[relPath] ?? 0) + 1;
      byKind[v.kind] = (byKind[v.kind] ?? 0) + 1;
    }
  }

  const verdict = computeVerdict(violations.length, scopeFiles.length);

  const result = {
    violations,
    byFile,
    byKind,
    totalCount: violations.length,
    verdict,
    recommendation: buildRecommendation(verdict, violations.length),
    summary: {
      fileCount: scopeFiles.length,
      violationCount: violations.length,
      verdict,
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

try {
  run();
} catch (err) {
  process.stderr.write(`hardcoded-violations: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
