#!/usr/bin/env node

/**
 * migration-scope.mjs
 *
 * Resolves a --scope argument into a concrete, flat list of screen and
 * component files the migration will touch.
 *
 * Scope kinds:
 *   --scope=app                  every screen reachable from the entry point
 *   --scope=flow:onboarding      screens in a named flow (uses flow-scan output)
 *   --scope=routes:settings/**   a route glob
 *   --scope=tokens:color         every file that references a token axis
 *
 * Usage:
 *   node migration-scope.mjs --scope=<scope> [--dir=path] [--flow-scan=path]
 *
 * Output (stdout, JSON):
 *   {
 *     "scope":      { kind, name, raw },
 *     "screens":    [ { route, file, hopDistance? } ],
 *     "components": [ "components/Button.tsx", ... ],
 *     "excluded":   [ { file, reason } ],
 *     "summary":    { screenCount, componentCount, excludedCount }
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
const scopeRaw = flag('scope');
const flowScanPath = flag('flow-scan'); // optional path to cached flow-scan JSON

if (!scopeRaw) {
  process.stderr.write(
    'migration-scope: --scope is required.\n' +
    '  Examples: --scope=app  --scope=flow:onboarding  --scope=routes:settings/**\n'
  );
  process.exit(1);
}

// ── file discovery ─────────────────────────────────────────────────────────

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.expo', '.metro-cache',
  'android', 'ios', '__generated__', 'coverage', '.impeccable',
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

// ── scope parsing ──────────────────────────────────────────────────────────

function parseScope(raw) {
  if (raw === 'app') return { kind: 'app', name: 'app', raw };
  if (raw.startsWith('flow:')) return { kind: 'flow', name: raw.slice(5), raw };
  if (raw.startsWith('routes:')) return { kind: 'routes', name: raw.slice(7), raw };
  if (raw.startsWith('tokens:')) return { kind: 'tokens', name: raw.slice(7), raw };
  // Fallback: treat as a glob / path
  return { kind: 'routes', name: raw, raw };
}

// ── screen detection ───────────────────────────────────────────────────────

// Expo Router: files under app/ that are not layouts or special files.
const EXPO_SCREEN_RE = /^app[/\\](?!.*_layout).*\.(tsx?|jsx?)$/;
// React Navigation: files in screens/ or pages/ directories.
const RN_SCREEN_RE = /(?:^|[/\\])(?:screens?|pages?)[/\\][^/\\]+\.(tsx?|jsx?)$/;

function isLikelyScreen(relPath) {
  return EXPO_SCREEN_RE.test(relPath) || RN_SCREEN_RE.test(relPath);
}

function fileToRoute(relPath) {
  // Expo Router: strip app/ prefix, extension, and route groups
  if (relPath.startsWith('app/') || relPath.startsWith('app\\')) {
    return '/' + relPath
      .replace(/^app[/\\]/, '')
      .replace(/\.(tsx?|jsx?)$/, '')
      .replace(/\([^)]+\)\//g, '') // strip (group)/ segments
      .replace(/index$/, '');
  }
  return '/' + relPath.replace(/\.(tsx?|jsx?)$/, '');
}

// ── transitive import walk ─────────────────────────────────────────────────

const IMPORT_RE = /import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
const REQUIRE_RE = /require\(['"]([^'"]+)['"]\)/g;

function resolveImport(importPath, fromFile) {
  if (!importPath.startsWith('.')) return null; // external package
  const base = path.resolve(path.dirname(fromFile), importPath);
  const candidates = [
    base,
    base + '.ts', base + '.tsx', base + '.js', base + '.jsx',
    path.join(base, 'index.ts'), path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function collectTransitiveComponents(seedFiles, allFilesSet) {
  const visited = new Set(seedFiles.map(f => path.resolve(f)));
  const queue = [...seedFiles.map(f => path.resolve(f))];
  const components = new Set();

  while (queue.length) {
    const filePath = queue.shift();
    let source;
    try { source = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }

    const patterns = [IMPORT_RE, REQUIRE_RE];
    for (const re of patterns) {
      re.lastIndex = 0;
      for (const m of source.matchAll(re)) {
        const resolved = resolveImport(m[1], filePath);
        if (!resolved) continue;
        if (visited.has(resolved)) continue;
        visited.add(resolved);
        const rel = path.relative(rootDir, resolved);
        // Only include files that are part of the project (in our allFiles set)
        if (allFilesSet.has(resolved)) {
          if (!isLikelyScreen(rel)) components.add(rel);
          queue.push(resolved);
        }
      }
    }
  }
  return [...components];
}

// ── glob matching (minimal, no deps) ──────────────────────────────────────

function globToRe(pattern) {
  // Convert simple glob (with * and **) to regex
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '§DOUBLESTAR§')
    .replace(/\*/g, '[^/\\\\]*')
    .replace(/§DOUBLESTAR§/g, '.*');
  return new RegExp(escaped);
}

// ── token-axis scope ───────────────────────────────────────────────────────

function filesReferencingTokenAxis(axis, allFiles) {
  const axisRe = new RegExp(`\\b(?:tokens?|theme|colors?|palette)\\.${axis}\\b`, 'i');
  return allFiles.filter(f => {
    try { return axisRe.test(fs.readFileSync(f, 'utf-8')); } catch { return false; }
  });
}

// ── flow-scan integration ──────────────────────────────────────────────────

function loadFlowScan() {
  const candidates = [
    flowScanPath,
    path.join(rootDir, '.impeccable', 'flow-scan.json'),
    path.join(rootDir, '.impeccable', 'flow.json'),
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { continue; }
    }
  }
  return null;
}

function screensForFlow(flowName, flowData) {
  if (!flowData?.screens) return null;
  const nameLower = flowName.toLowerCase();
  // Match screens whose route or navigator contains the flow name
  return flowData.screens.filter(s => {
    const route = (s.route ?? s.name ?? '').toLowerCase();
    const nav = (s.navigator ?? '').toLowerCase();
    return route.includes(nameLower) || nav.includes(nameLower);
  });
}

// ── main ───────────────────────────────────────────────────────────────────

function run() {
  const scope = parseScope(scopeRaw);
  const allFiles = collectFiles(rootDir);
  const allFilesSet = new Set(allFiles.map(f => path.resolve(f)));

  let rawScreenFiles = [];
  const excluded = [];

  if (scope.kind === 'app' || scope.kind === 'flow') {
    const flowData = loadFlowScan();
    let flowScreens = null;

    if (scope.kind === 'flow' && flowData) {
      flowScreens = screensForFlow(scope.name, flowData);
    } else if (scope.kind === 'app' && flowData) {
      flowScreens = flowData.screens ?? null;
    }

    if (flowScreens) {
      rawScreenFiles = flowScreens
        .map(s => path.resolve(rootDir, s.file))
        .filter(f => fs.existsSync(f));

      if (scope.kind === 'flow' && rawScreenFiles.length === 0) {
        process.stderr.write(
          `migration-scope: no screens matched flow name "${scope.name}" in flow-scan output.\n` +
          `  Available flows: check .impeccable/flow-scan.json or re-run flow-scan.\n`
        );
        process.exit(1);
      }
    } else {
      // Fallback: heuristic screen detection across whole project
      rawScreenFiles = allFiles.filter(f => isLikelyScreen(path.relative(rootDir, f)));
      if (scope.kind === 'flow') {
        // Further filter by path segment matching flow name
        const nameLower = scope.name.toLowerCase();
        rawScreenFiles = rawScreenFiles.filter(f =>
          path.relative(rootDir, f).toLowerCase().includes(nameLower)
        );
      }
    }
  } else if (scope.kind === 'routes') {
    const re = globToRe(scope.name);
    rawScreenFiles = allFiles.filter(f => re.test(path.relative(rootDir, f)));
  } else if (scope.kind === 'tokens') {
    rawScreenFiles = filesReferencingTokenAxis(scope.name, allFiles);
  }

  // Exclude navigator/layout files from the screen list (they're infrastructure)
  const LAYOUT_RE = /_layout\.(tsx?|jsx?)$|Navigator\.(tsx?|jsx?)$/;
  const screenFiles = rawScreenFiles.filter(f => {
    const rel = path.relative(rootDir, f);
    if (LAYOUT_RE.test(rel)) {
      excluded.push({ file: rel, reason: 'navigator/layout wrapper — no token surface to migrate' });
      return false;
    }
    return true;
  });

  // Build screen list with route and hopDistance from flow-scan if available
  const flowData = loadFlowScan();
  const hopMap = new Map();
  if (flowData?.screens) {
    for (const s of flowData.screens) {
      hopMap.set(path.resolve(rootDir, s.file), s.hopDistance ?? null);
    }
  }

  const screens = screenFiles.map(f => {
    const rel = path.relative(rootDir, f);
    const entry = { route: fileToRoute(rel), file: rel };
    const hop = hopMap.get(f);
    if (hop !== null && hop !== undefined) entry.hopDistance = hop;
    return entry;
  });

  // Collect components transitively imported by screens
  const components = collectTransitiveComponents(screenFiles, allFilesSet);

  const result = {
    scope,
    screens,
    components,
    excluded,
    summary: {
      screenCount: screens.length,
      componentCount: components.length,
      excludedCount: excluded.length,
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

try {
  run();
} catch (err) {
  process.stderr.write(`migration-scope: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
