#!/usr/bin/env node

/**
 * dead-code-report.mjs
 *
 * Identifies components that are dead weight in the codebase:
 *   - directly dead    — zero usages outside their own file
 *   - transitively dead — only used by other dead components
 *   - test-only        — used only in tests or stories, never in app code
 *
 * Reads component-inventory.mjs output. Adds per-entry "whyGuess" so the
 * agent has a one-line story per component before proposing deletion.
 *
 * Usage:
 *   node dead-code-report.mjs [--dir=path] [--inventory=path.json]
 *
 * Output (stdout, JSON):
 *   {
 *     "dead":            [ DeadEntry, ... ],
 *     "transitivelyDead":[ DeadEntry, ... ],
 *     "testOnly":        [ DeadEntry, ... ],
 *     "summary":         { ... }
 *   }
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const args = process.argv.slice(2);
function flag(name) {
  const f = args.find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
}
const rootDir = path.resolve(flag('dir') ?? process.cwd());
const inventoryPath = flag('inventory');

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.expo', '.metro-cache',
  'android', 'ios', '__generated__', 'coverage', '.impeccable', '.next',
]);

// ── load inventory ────────────────────────────────────────────────────────

function loadInventory() {
  if (inventoryPath) {
    return JSON.parse(fs.readFileSync(path.resolve(inventoryPath), 'utf-8'));
  }
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const inventoryScript = path.join(scriptDir, 'component-inventory.mjs');
  const out = execFileSync('node', [inventoryScript, `--dir=${rootDir}`], {
    stdio: ['ignore', 'pipe', 'inherit'],
    maxBuffer: 64 * 1024 * 1024,
  }).toString();
  return JSON.parse(out);
}

// ── dynamic-import scan (to avoid false-positive deletes) ─────────────────

function collectFiles(dir, results = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, results);
    else if (/\.(tsx?|jsx?|json|mdx?)$/.test(entry.name)) results.push(full);
  }
  return results;
}

/**
 * Build a set of names that appear inside dynamic-import-ish contexts, OR
 * are referenced by string in things like JSON config, MDX, or storybook
 * registries. We flag these as "do not delete blindly".
 */
function buildDynamicReferenceIndex(allFiles, names) {
  const flagged = new Set();
  if (names.size === 0) return flagged;
  // Per-name regex would be slow on huge repos; do a single pass with a
  // dynamic-context heuristic, then check `names` membership.
  const dynRe = /(?:require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)|import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)|lazy\s*\(\s*\(\s*\)\s*=>\s*import\s*\(\s*['"`]([^'"`]+)['"`])/g;
  const stringRe = /['"`]([A-Z][A-Za-z0-9_]+)['"`]/g;

  for (const filePath of allFiles) {
    let source;
    try { source = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }
    if (!source) continue;
    // Dynamic requires/imports: pull the *path*, then see if any known
    // component file matches its tail.
    for (const m of source.matchAll(dynRe)) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (!spec) continue;
      const tail = spec.split('/').pop().replace(/\.\w+$/, '');
      if (names.has(tail)) flagged.add(tail);
    }
    // String references in JSON/MDX/storybook configs that happen to match a name.
    if (/\.(json|mdx?)$/.test(filePath) || /stories|storybook/i.test(filePath)) {
      for (const m of source.matchAll(stringRe)) {
        if (names.has(m[1])) flagged.add(m[1]);
      }
    }
  }
  return flagged;
}

// ── whyGuess ──────────────────────────────────────────────────────────────

function whyGuess(component, lastTouchedAgeDays) {
  if (lastTouchedAgeDays != null && lastTouchedAgeDays > 180) {
    return `Stale: last touched ${Math.round(lastTouchedAgeDays)} days ago. Likely abandoned.`;
  }
  if (component.parseConfidence === 'low') {
    return 'Could not parse the component cleanly — verify it is actually a component before deleting.';
  }
  if (component.kindGuess === 'atom' && (component.props?.length ?? 0) === 0) {
    return 'Propless atom with no consumers — likely an unused primitive.';
  }
  if (component.kindGuess === 'organism') {
    return 'Unused organism — investigate whether a screen used to render this and was deleted.';
  }
  return 'No consumers found.';
}

function ageDays(iso) {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
}

// ── classification ────────────────────────────────────────────────────────

const TEST_FILE_RE = /(\.(test|spec)\.(tsx?|jsx?)$)|(__tests__\/)/;
const STORY_FILE_RE = /\.stories\.(tsx?|jsx?)$/;

function classifyUsage(sites) {
  // inventory's usageSites already excludes test/story files (component-inventory
  // skips them when building the index), so any usage here is "real". For full
  // safety we still check.
  const real = [];
  const testOrStory = [];
  for (const s of sites) {
    if (TEST_FILE_RE.test(s.file) || STORY_FILE_RE.test(s.file)) testOrStory.push(s);
    else real.push(s);
  }
  return { real, testOrStory };
}

// ── main ──────────────────────────────────────────────────────────────────

function run() {
  const inventory = loadInventory();
  const components = inventory.components ?? [];
  const byName = new Map(components.map(c => [c.name, c]));

  // Pass 1: classify by real-usage count.
  const directlyDead = [];
  const testOnly = [];
  const live = new Set();

  for (const c of components) {
    const { real, testOrStory } = classifyUsage(c.usageSites ?? []);
    if (real.length === 0 && testOrStory.length === 0) directlyDead.push(c);
    else if (real.length === 0 && testOrStory.length > 0) testOnly.push({ component: c, testOrStorySites: testOrStory });
    else live.add(c.name);
  }

  // Pass 2: transitively dead — components used only by dead components.
  // We iterate: any component whose live consumers are all dead becomes dead.
  const deadNames = new Set(directlyDead.map(c => c.name));
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of components) {
      if (deadNames.has(c.name) || live.has(c.name) === false) continue;
      const consumers = (c.usageSites ?? [])
        .map(s => {
          // Find which component "owns" this file (if a component is defined there).
          const owner = components.find(x => x.file === s.file);
          return owner?.name ?? null;
        })
        .filter(Boolean);
      if (consumers.length > 0 && consumers.every(n => deadNames.has(n))) {
        deadNames.add(c.name);
        live.delete(c.name);
        changed = true;
      }
    }
  }

  const transitivelyDead = components.filter(c =>
    deadNames.has(c.name) && !directlyDead.some(d => d.name === c.name)
  );

  // Pass 3: check for dynamic references; flag candidates we should NOT auto-delete.
  const allFiles = collectFiles(rootDir);
  const allDeadNames = new Set([...directlyDead, ...transitivelyDead, ...testOnly.map(t => t.component)].map(x => (x.component ?? x).name));
  const dynamicallyReferenced = buildDynamicReferenceIndex(allFiles, allDeadNames);

  function enrich(c) {
    const age = ageDays(c.lastTouched);
    return {
      name: c.name,
      file: c.file,
      kindGuess: c.kindGuess,
      propCount: c.props?.length ?? 0,
      lastTouched: c.lastTouched,
      ageDays: age == null ? null : Math.round(age),
      dynamicallyReferenced: dynamicallyReferenced.has(c.name),
      safeToDelete: !dynamicallyReferenced.has(c.name) && c.parseConfidence !== 'low',
      whyGuess: whyGuess(c, age),
    };
  }

  const result = {
    dead: directlyDead.map(enrich),
    transitivelyDead: transitivelyDead.map(enrich),
    testOnly: testOnly.map(({ component, testOrStorySites }) => ({
      ...enrich(component),
      testOrStorySites,
    })),
    summary: {
      rootDir,
      componentCount: components.length,
      deadCount: directlyDead.length,
      transitivelyDeadCount: transitivelyDead.length,
      testOnlyCount: testOnly.length,
      dynamicallyReferencedCount: dynamicallyReferenced.size,
      totalDeadOrTestOnly:
        directlyDead.length + transitivelyDead.length + testOnly.length,
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

try { run(); }
catch (err) {
  process.stderr.write(`dead-code-report: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
