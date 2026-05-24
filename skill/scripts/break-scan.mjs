#!/usr/bin/env node

/**
 * break-scan.mjs
 *
 * Reconnaissance for `/impeccable-native break`. Before a radical redesign
 * that questions the existing design system,
 * this maps the existing design-system surface so the redesign can decide,
 * per token: UPDATE it (evolve the system), KEEP it (stay retrocompatible),
 * or just gain CONTEXT (understand what a change would ripple into).
 *
 * It answers three questions:
 *   1. Where is the design system DECLARED?     (token definitions)
 *   2. HOW is theming wired?                      (theming infra)
 *   3. What is the BLAST RADIUS of a token change? (shared usage)
 *
 * Usage:
 *   node break-scan.mjs [--target=path] [--dir=path]
 *
 * Flags:
 *   --target=path   The component/screen being rethought (file or dir).
 *                   Blast radius is computed relative to the tokens IT uses.
 *   --dir=path      Project root to scan (default: cwd).
 *
 * Output (stdout, JSON):
 *   {
 *     "tokenDefinitions": [ { file, kind, exports: [...], line } ],
 *     "themingInfra":     { approach, evidence: [ { signal, file, line } ] },
 *     "blastRadius":      { targetTokens: [...], consumers: [ { token, count, files: [...] } ] },
 *     "summary":          { totalFiles, hasTokenModule, approach, targetResolved }
 *   }
 *
 * The script finds declarations and references, not intent. Use it as a map:
 * a token with a large blast radius is expensive to mutate (favor KEEP or add
 * a new token); a token used only by the target is cheap to redesign freely.
 */

import fs from 'fs';
import path from 'path';

// ── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const rootDir = (() => {
  const flag = args.find(a => a.startsWith('--dir='));
  return flag ? path.resolve(flag.split('=')[1]) : process.cwd();
})();
const targetArg = (() => {
  const flag = args.find(a => a.startsWith('--target='));
  return flag ? flag.split('=')[1] : null;
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

function charToLineFactory(source) {
  const lineOffsets = [];
  let offset = 0;
  for (const line of source.split('\n')) {
    lineOffsets.push(offset);
    offset += line.length + 1;
  }
  return function charToLine(charIndex) {
    let lo = 0, hi = lineOffsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineOffsets[mid] <= charIndex) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
}

// ── 1. token definitions ─────────────────────────────────────────────────────

// Files whose basename looks like a token/theme module.
const TOKEN_FILE_RE = /(^|[./-])(tokens|theme|themes|colors|palette|design-?system|design-?tokens|styles?)\.(tsx?|jsx?)$/i;

// `export const tokens = {`, `export const theme = {`, `export const colors = {`, etc.
const TOKEN_EXPORT_RE =
  /export\s+(?:const|default|let|var)\s+([A-Za-z_$][\w$]*)\s*[:=]/g;

// Heuristic: an exported identifier that names a design surface.
const TOKEN_NAME_RE = /^(tokens?|theme|themes|colors?|palette|spacing|space|radii|radius|shadows?|typography|type|fonts?|motion|elevation|darkTheme|lightTheme|dark|light)$/i;

function findTokenDefinitions(files) {
  const defs = [];
  for (const filePath of files) {
    let source;
    try { source = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }
    const rel = path.relative(rootDir, filePath);
    const charToLine = charToLineFactory(source);

    const nameMatchesFile = TOKEN_FILE_RE.test(path.basename(filePath));
    const exportsFound = [];

    for (const m of source.matchAll(TOKEN_EXPORT_RE)) {
      const name = m[1];
      if (nameMatchesFile || TOKEN_NAME_RE.test(name)) {
        exportsFound.push({ name, line: charToLine(m.index) });
      }
    }

    if (exportsFound.length === 0) continue;

    defs.push({
      file: rel,
      kind: nameMatchesFile ? 'token-module' : 'token-export',
      exports: exportsFound.map(e => e.name),
      line: exportsFound[0].line,
    });
  }
  // Token modules first, then files with the most token exports.
  return defs.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'token-module' ? -1 : 1;
    return b.exports.length - a.exports.length;
  });
}

// ── 2. theming infra ─────────────────────────────────────────────────────────

// Ordered by specificity — first hit with the most evidence wins as `approach`.
const THEMING_SIGNALS = [
  { approach: 'nativewind',        re: /\b(?:className\s*=|nativewind|tailwind\.config|useColorScheme\(\)[^]*className)/, label: 'NativeWind className / tailwind.config' },
  { approach: 'restyle',           re: /@shopify\/restyle|createTheme|useTheme<\s*Theme\s*>|createBox|createText/, label: '@shopify/restyle' },
  { approach: 'styled-components',  re: /styled-components(?:\/native)?|styled\.\w+`|ThemeProvider/, label: 'styled-components' },
  { approach: 'tamagui',           re: /tamagui|createTamagui|@tamagui\//, label: 'Tamagui' },
  { approach: 'unistyles',         re: /react-native-unistyles|createStyleSheet|UnistylesRegistry/, label: 'react-native-unistyles' },
  { approach: 'context-usetheme',  re: /useTheme\s*\(\)|ThemeContext|createContext\([^)]*theme/i, label: 'useTheme() / ThemeContext' },
  { approach: 'usecolorscheme',    re: /useColorScheme\s*\(\)/, label: 'useColorScheme()' },
  { approach: 'stylesheet',        re: /StyleSheet\.create\s*\(/, label: 'StyleSheet.create (vanilla)' },
];

function findThemingInfra(files) {
  const tally = new Map(); // approach -> { count, evidence: [...] }
  for (const filePath of files) {
    let source;
    try { source = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }
    const rel = path.relative(rootDir, filePath);
    const charToLine = charToLineFactory(source);

    for (const sig of THEMING_SIGNALS) {
      const m = source.match(sig.re);
      if (!m) continue;
      if (!tally.has(sig.approach)) tally.set(sig.approach, { count: 0, label: sig.label, evidence: [] });
      const entry = tally.get(sig.approach);
      entry.count++;
      if (entry.evidence.length < 10) {
        entry.evidence.push({ signal: sig.label, file: rel, line: charToLine(m.index) });
      }
    }
  }

  // Pick the most specific approach that has real evidence. THEMING_SIGNALS is
  // ordered specific→generic; vanilla StyleSheet is the fallback only if it is
  // the sole signal present.
  let approach = 'unknown';
  const nonVanilla = [...tally.keys()].filter(k => k !== 'stylesheet' && k !== 'usecolorscheme');
  if (nonVanilla.length > 0) {
    // Honor THEMING_SIGNALS order for specificity.
    approach = THEMING_SIGNALS.find(s => nonVanilla.includes(s.approach))?.approach ?? nonVanilla[0];
  } else if (tally.has('usecolorscheme')) {
    approach = 'usecolorscheme';
  } else if (tally.has('stylesheet')) {
    approach = 'stylesheet';
  }

  const evidence = [];
  for (const [, entry] of tally) {
    for (const e of entry.evidence) evidence.push(e);
  }

  return { approach, evidence };
}

// ── 3. blast radius ───────────────────────────────────────────────────────────

function resolveTargetFiles(allFiles) {
  if (!targetArg) return null;
  const abs = path.resolve(rootDir, targetArg);
  if (!fs.existsSync(abs)) return { resolved: false, files: [] };
  const stat = fs.statSync(abs);
  if (stat.isDirectory()) {
    return { resolved: true, files: collectFiles(abs) };
  }
  return { resolved: true, files: [abs] };
}

// A "token" reference in the target is a member access off a theme-ish root:
//   tokens.color.accent, theme.spacing.lg, colors.primary, t.color.bg
const TOKEN_REF_RE =
  /\b(tokens?|theme|colors?|palette|t)\.([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/g;

function collectTargetTokens(targetFiles) {
  const tokens = new Set();
  for (const filePath of targetFiles) {
    let source;
    try { source = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }
    for (const m of source.matchAll(TOKEN_REF_RE)) {
      // Normalize to root.firstSegment (e.g. tokens.color) so we measure at a
      // useful granularity rather than every leaf.
      const root = m[1];
      const firstSeg = m[2].split('.')[0];
      tokens.add(`${root}.${firstSeg}`);
    }
  }
  return [...tokens];
}

function computeBlastRadius(targetTokens, allFiles, targetFiles) {
  const targetSet = new Set(targetFiles.map(f => path.resolve(f)));
  const consumers = new Map(); // token -> { count, files: Set }

  for (const token of targetTokens) consumers.set(token, { count: 0, files: new Set() });

  // Escape for regex; match the same root.firstSeg shape anywhere in the project.
  const patterns = targetTokens.map(tok => ({
    token: tok,
    re: new RegExp('\\b' + tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g'),
  }));

  for (const filePath of allFiles) {
    const isTarget = targetSet.has(path.resolve(filePath));
    let source;
    try { source = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }
    const rel = path.relative(rootDir, filePath);
    for (const { token, re } of patterns) {
      const hits = source.match(re);
      if (!hits) continue;
      const entry = consumers.get(token);
      entry.count += hits.length;
      // Files OUTSIDE the target are the actual blast radius.
      if (!isTarget) entry.files.add(rel);
    }
  }

  return [...consumers.entries()]
    .map(([token, { count, files }]) => ({
      token,
      count,
      otherConsumerCount: files.size,
      files: [...files].slice(0, 20),
    }))
    .sort((a, b) => b.otherConsumerCount - a.otherConsumerCount);
}

// ── main ───────────────────────────────────────────────────────────────────

function run() {
  if (!fs.existsSync(rootDir)) {
    process.stderr.write(
      `break-scan: directory not found: ${rootDir}\n` +
      `  Run from the root of your React Native project, or pass --dir=path.\n`
    );
    process.exit(1);
  }

  const files = collectFiles(rootDir);
  if (files.length === 0) {
    process.stderr.write(
      `break-scan: no .ts/.tsx files found under ${rootDir}\n` +
      `  Check that you are running from your project root.\n`
    );
    process.exit(1);
  }

  const tokenDefinitions = findTokenDefinitions(files);
  const themingInfra = findThemingInfra(files);

  const target = resolveTargetFiles(files);
  let blastRadius = null;
  if (target && target.resolved && target.files.length > 0) {
    const targetTokens = collectTargetTokens(target.files);
    blastRadius = {
      targetTokens,
      consumers: targetTokens.length > 0
        ? computeBlastRadius(targetTokens, files, target.files)
        : [],
    };
  }

  const result = {
    tokenDefinitions,
    themingInfra,
    blastRadius,
    summary: {
      totalFiles: files.length,
      hasTokenModule: tokenDefinitions.some(d => d.kind === 'token-module'),
      approach: themingInfra.approach,
      targetResolved: target ? target.resolved : false,
      note: buildNote(tokenDefinitions, themingInfra, blastRadius),
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(0);
}

function buildNote(defs, infra, blast) {
  const parts = [];
  if (defs.length === 0) {
    parts.push('No token module found — the redesign can define one freely; nothing to stay retrocompatible with.');
  } else {
    parts.push(`${defs.length} design-system declaration(s) found; consult them before mutating any value.`);
  }
  parts.push(`Theming approach: ${infra.approach}.`);
  if (blast) {
    const heavy = blast.consumers.filter(c => c.otherConsumerCount >= 3);
    if (heavy.length > 0) {
      parts.push(`High blast radius on ${heavy.map(c => c.token).join(', ')} — favor KEEP or add a new token rather than mutating.`);
    } else if (blast.targetTokens.length > 0) {
      parts.push('Target tokens have low blast radius — safe to redesign freely.');
    } else {
      parts.push('Target references no shared tokens — fully free to redesign.');
    }
  } else {
    parts.push('No --target passed: blast radius not computed. Re-run with --target=path for retrocompatibility guidance.');
  }
  return parts.join(' ');
}

try {
  run();
} catch (err) {
  process.stderr.write(`break-scan: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
