#!/usr/bin/env node

/**
 * rethink-scan.mjs
 *
 * Reconnaissance for `/impeccable-native rethink`. The purpose-driven sibling
 * of `break-scan`. Where `break-scan` asks "what can I change?", this script
 * asks "what is this component for, and what surrounds it?".
 *
 * The brand surface is read-only here — the redesign composes existing tokens
 * differently, it never proposes value changes. So the scan output focuses on
 * the *role* the target plays in the choreography:
 *
 *   1. brandSurface     — token vocabulary (read-only) + theming approach.
 *   2. usageSites       — screens and parents that mount the target.
 *   3. flowNeighbors    — what renders around the target on each screen.
 *   4. siblingTreatment — other components on shared screens with same-treatment signal.
 *
 * Usage:
 *   node rethink-scan.mjs --target=<path-to-component> [--dir=path]
 *
 * Output (stdout, JSON):
 *   {
 *     "brandSurface":     { tokenDefinitions, themingInfra: { approach, evidence } },
 *     "usageSites":       [ { file, line, importedAs } ],
 *     "flowNeighbors":    [ { screen, before: [...], after: [...], parent } ],
 *     "siblingTreatment": [ { screen, siblings: [ { name, sameHeight, samePadding, sameWeight } ] } ],
 *     "summary":          { ... }
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
const targetArg = flag('target');

if (!targetArg) {
  process.stderr.write(
    `rethink-scan: --target is required.\n` +
    `  Usage: node rethink-scan.mjs --target=<path-to-component> [--dir=path]\n`
  );
  process.exit(1);
}

// ── file discovery ─────────────────────────────────────────────────────────

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.expo', '.metro-cache',
  'android', 'ios', '__generated__', 'coverage',
]);

function collectFiles(dir, results = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, results);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) results.push(full);
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

// ── resolve target ─────────────────────────────────────────────────────────

function resolveTarget() {
  const abs = path.resolve(rootDir, targetArg);
  if (!fs.existsSync(abs)) {
    return { resolved: false, files: [], componentName: null };
  }
  const stat = fs.statSync(abs);
  const files = stat.isDirectory() ? collectFiles(abs) : [abs];
  // Derive a component name: prefer directory name, else basename without extension.
  let componentName;
  if (stat.isDirectory()) {
    componentName = path.basename(abs);
  } else {
    componentName = path.basename(abs).replace(/\.(tsx?|jsx?)$/, '');
    if (componentName === 'index') componentName = path.basename(path.dirname(abs));
  }
  return { resolved: true, files, componentName, absTargetPath: abs };
}

// ── 1. brand surface (token defs + theming approach) ──────────────────────

const TOKEN_FILE_RE = /(^|[./-])(tokens|theme|themes|colors|palette|design-?system|design-?tokens|styles?)\.(tsx?|jsx?)$/i;
const TOKEN_EXPORT_RE = /export\s+(?:const|default|let|var)\s+([A-Za-z_$][\w$]*)\s*[:=]/g;
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
  return defs.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'token-module' ? -1 : 1;
    return b.exports.length - a.exports.length;
  });
}

const THEMING_SIGNALS = [
  { approach: 'nativewind',        re: /\b(?:className\s*=|nativewind|tailwind\.config|useColorScheme\(\)[^]*className)/, label: 'NativeWind className / tailwind.config' },
  { approach: 'restyle',           re: /@shopify\/restyle|createTheme|useTheme<\s*Theme\s*>|createBox|createText/, label: '@shopify/restyle' },
  { approach: 'styled-components', re: /styled-components(?:\/native)?|styled\.\w+`|ThemeProvider/, label: 'styled-components' },
  { approach: 'tamagui',           re: /tamagui|createTamagui|@tamagui\//, label: 'Tamagui' },
  { approach: 'unistyles',         re: /react-native-unistyles|createStyleSheet|UnistylesRegistry/, label: 'react-native-unistyles' },
  { approach: 'context-usetheme',  re: /useTheme\s*\(\)|ThemeContext|createContext\([^)]*theme/i, label: 'useTheme() / ThemeContext' },
  { approach: 'usecolorscheme',    re: /useColorScheme\s*\(\)/, label: 'useColorScheme()' },
  { approach: 'stylesheet',        re: /StyleSheet\.create\s*\(/, label: 'StyleSheet.create (vanilla)' },
];

function findThemingInfra(files) {
  const tally = new Map();
  for (const filePath of files) {
    let source;
    try { source = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }
    const rel = path.relative(rootDir, filePath);
    const charToLine = charToLineFactory(source);
    for (const sig of THEMING_SIGNALS) {
      const m = source.match(sig.re);
      if (!m) continue;
      if (!tally.has(sig.approach)) tally.set(sig.approach, { count: 0, evidence: [] });
      const entry = tally.get(sig.approach);
      entry.count++;
      if (entry.evidence.length < 5) {
        entry.evidence.push({ signal: sig.label, file: rel, line: charToLine(m.index) });
      }
    }
  }
  let approach = 'unknown';
  const nonVanilla = [...tally.keys()].filter(k => k !== 'stylesheet' && k !== 'usecolorscheme');
  if (nonVanilla.length > 0) {
    approach = THEMING_SIGNALS.find(s => nonVanilla.includes(s.approach))?.approach ?? nonVanilla[0];
  } else if (tally.has('usecolorscheme')) approach = 'usecolorscheme';
  else if (tally.has('stylesheet')) approach = 'stylesheet';
  const evidence = [];
  for (const [, entry] of tally) for (const e of entry.evidence) evidence.push(e);
  return { approach, evidence };
}

// ── 2. usage sites (importers of the target) ──────────────────────────────

function findUsageSites(componentName, targetFiles, allFiles) {
  const targetSet = new Set(targetFiles.map(f => path.resolve(f)));
  const importRe = new RegExp(
    `import\\s+(?:\\{[^}]*\\b${componentName}\\b[^}]*\\}|${componentName}|\\*\\s+as\\s+\\w+)\\s+from\\s+['"]([^'"]+)['"]`,
    'g'
  );
  const sites = [];
  for (const filePath of allFiles) {
    if (targetSet.has(path.resolve(filePath))) continue;
    let source;
    try { source = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }
    const charToLine = charToLineFactory(source);
    for (const m of source.matchAll(importRe)) {
      const rel = path.relative(rootDir, filePath);
      sites.push({
        file: rel,
        line: charToLine(m.index),
        importedAs: componentName,
        fromPath: m[1],
      });
      break; // one entry per importing file is enough
    }
  }
  return sites;
}

// ── 3. flow neighbors (what surrounds <Target/> in each usage file) ───────

function findFlowNeighbors(componentName, usageSites) {
  const elementOpenRe = /<([A-Z][A-Za-z0-9_]*)\b/g;
  const targetTagRe = new RegExp(`<${componentName}\\b`, 'g');
  const neighbors = [];

  for (const site of usageSites) {
    const filePath = path.resolve(rootDir, site.file);
    let source;
    try { source = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }

    // Collect all JSX-like opens, then for each target occurrence pick the
    // N elements before and after by character position.
    const allOpens = [];
    for (const m of source.matchAll(elementOpenRe)) {
      allOpens.push({ tag: m[1], index: m.index });
    }
    const targetIndices = [...source.matchAll(targetTagRe)].map(m => m.index);
    if (targetIndices.length === 0) continue;

    for (const targetIdx of targetIndices) {
      const positionInOpens = allOpens.findIndex(o => o.index === targetIdx);
      if (positionInOpens < 0) continue;
      const before = allOpens.slice(Math.max(0, positionInOpens - 4), positionInOpens)
        .map(o => o.tag).filter(t => t !== componentName);
      const after = allOpens.slice(positionInOpens + 1, positionInOpens + 5)
        .map(o => o.tag).filter(t => t !== componentName);
      neighbors.push({ screen: site.file, before, after });
    }
  }
  return neighbors;
}

// ── 4. sibling treatment (other components on shared screens) ─────────────

function findSiblingTreatment(usageSites, componentName) {
  const elementOpenRe = /<([A-Z][A-Za-z0-9_]*)\b/g;
  const styleRefRe = /style\s*=\s*\{([^}]+)\}/g;

  const result = [];
  for (const site of usageSites) {
    const filePath = path.resolve(rootDir, site.file);
    let source;
    try { source = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }

    const tagCounts = new Map();
    for (const m of source.matchAll(elementOpenRe)) {
      const tag = m[1];
      if (tag === componentName) continue;
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    // Same-treatment heuristic: pull style references and count which style
    // identifiers are reused across the file (a proxy for "looks the same").
    const styleRefs = new Map();
    for (const m of source.matchAll(styleRefRe)) {
      const ref = m[1].trim().split(/[,\s]+/)[0];
      if (!ref) continue;
      styleRefs.set(ref, (styleRefs.get(ref) ?? 0) + 1);
    }
    const reusedStyles = [...styleRefs.entries()]
      .filter(([, n]) => n >= 2)
      .map(([ref, n]) => ({ ref, count: n }));

    const siblings = [...tagCounts.entries()]
      .filter(([tag]) => /^[A-Z]/.test(tag) && !['View','Text','ScrollView','SafeAreaView','Fragment'].includes(tag))
      .map(([name, occurrences]) => ({ name, occurrences }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 10);

    result.push({
      screen: site.file,
      siblings,
      sameTreatmentSignal: reusedStyles.length > 0
        ? { reusedStyles, hint: 'Multiple elements share style refs — hierarchy may be flat.' }
        : { reusedStyles: [], hint: 'No reused style refs detected.' },
    });
  }
  return result;
}

// ── main ───────────────────────────────────────────────────────────────────

function run() {
  if (!fs.existsSync(rootDir)) {
    process.stderr.write(`rethink-scan: directory not found: ${rootDir}\n`);
    process.exit(1);
  }
  const allFiles = collectFiles(rootDir);
  if (allFiles.length === 0) {
    process.stderr.write(`rethink-scan: no .ts/.tsx files found under ${rootDir}\n`);
    process.exit(1);
  }

  const target = resolveTarget();
  if (!target.resolved) {
    process.stderr.write(`rethink-scan: target not found: ${targetArg}\n`);
    process.exit(1);
  }

  const tokenDefinitions = findTokenDefinitions(allFiles);
  const themingInfra = findThemingInfra(allFiles);
  const usageSites = findUsageSites(target.componentName, target.files, allFiles);
  const flowNeighbors = findFlowNeighbors(target.componentName, usageSites);
  const siblingTreatment = findSiblingTreatment(usageSites, target.componentName);

  const result = {
    brandSurface: {
      tokenDefinitions,
      themingInfra,
      policy: 'read-only — rethink may compose these tokens differently but never proposes value changes.',
    },
    usageSites,
    flowNeighbors,
    siblingTreatment,
    summary: {
      totalFiles: allFiles.length,
      componentName: target.componentName,
      usageSiteCount: usageSites.length,
      hasTokenModule: tokenDefinitions.some(d => d.kind === 'token-module'),
      approach: themingInfra.approach,
      note: buildNote(target, tokenDefinitions, usageSites, siblingTreatment),
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(0);
}

function buildNote(target, defs, sites, siblings) {
  const parts = [];
  if (sites.length === 0) {
    parts.push(`No usage sites found for "${target.componentName}". Either the component is unused (candidate for deletion) or imports use a non-standard path the scan missed — verify manually.`);
  } else {
    parts.push(`${target.componentName} is mounted in ${sites.length} file(s).`);
  }
  if (defs.length === 0) {
    parts.push('No token module found — the redesign has no brand vocabulary to compose from. Run /impeccable-native document or /impeccable-native rebrand first.');
  } else {
    parts.push(`${defs.length} token declaration(s) available as read-only vocabulary.`);
  }
  const flatScreens = siblings.filter(s => s.sameTreatmentSignal.reusedStyles.length >= 3);
  if (flatScreens.length > 0) {
    parts.push(`Flat hierarchy signal on ${flatScreens.length} screen(s) — the redesign's job is to break sameness meaningfully.`);
  }
  return parts.join(' ');
}

try {
  run();
} catch (err) {
  process.stderr.write(`rethink-scan: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
