#!/usr/bin/env node

/**
 * app-anatomy.mjs
 *
 * Builds a structural map of what the app *is*:
 *   - screens and the routes they answer to
 *   - user journeys named in PRODUCT.md
 *   - stated goals / KPIs from PRODUCT.md or strategy doc
 *
 * For brownfield apps, screen discovery comes from the filesystem (expo-router
 * `app/`, React Navigation `screens/`, custom dirs). For PRODUCT.md, we parse
 * the H2/H3 headings and look for canonical sections: "Goals", "Journeys",
 * "Flows", "Personas".
 *
 * This script is deliberately tolerant — if PRODUCT.md is missing it still
 * emits a useful screen map; if screens dirs are missing it still emits the
 * goals & journeys.
 *
 * Usage:
 *   node app-anatomy.mjs [--dir=path] [--product=PRODUCT.md]
 *                        [--screens-dir=screens,app,src/screens]
 *
 * Output (stdout, JSON):
 *   {
 *     "screens":   [ Screen, ... ],
 *     "journeys":  [ Journey, ... ],
 *     "goals":     [ Goal, ... ],
 *     "personas":  [ Persona, ... ],
 *     "summary":   { ... }
 *   }
 */

import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
function flag(name) {
  const f = args.find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
}
const rootDir = path.resolve(flag('dir') ?? process.cwd());
const productPath = flag('product') ?? 'PRODUCT.md';
const screensDirs = (flag('screens-dir') ?? 'screens,app,src/screens')
  .split(',').map(s => s.trim()).filter(Boolean);

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.expo', '.metro-cache',
  'android', 'ios', '__generated__', 'coverage', '.impeccable', '.next',
]);

// ── screen discovery ──────────────────────────────────────────────────────

function collectFiles(dir, results = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, results);
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.(test|spec)\.|stories\./.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

function existingDirs(roots) {
  return roots
    .map(r => path.join(rootDir, r))
    .filter(p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } });
}

/**
 * Derive a screen name + route guess from a file path.
 *   app/(tabs)/index.tsx          → { name: "IndexScreen", route: "/" }
 *   app/(tabs)/profile.tsx        → { name: "ProfileScreen", route: "/profile" }
 *   app/workout/[id].tsx          → { name: "WorkoutDetailScreen", route: "/workout/:id" }
 *   screens/HomeScreen.tsx        → { name: "HomeScreen", route: null }
 */
function deriveScreenIdentity(filePath, screenRoot) {
  const rel = path.relative(screenRoot, filePath);
  const base = path.basename(rel, path.extname(rel));
  const dir = path.dirname(rel);

  // Expo-router style: route from file path.
  const isExpoRouter = path.basename(screenRoot) === 'app';
  let route = null;
  if (isExpoRouter) {
    const parts = dir === '.' ? [] : dir.split(path.sep);
    const routeParts = [];
    for (const p of parts) {
      if (p.startsWith('(') && p.endsWith(')')) continue; // route group, invisible
      if (p.startsWith('_')) continue; // private
      routeParts.push(p.replace(/^\[(\.{3})?([^\]]+)\]$/, (_, spread, name) => spread ? `*${name}` : `:${name}`));
    }
    if (base === 'index') {
      route = '/' + routeParts.join('/');
    } else if (base.startsWith('_')) {
      route = null; // layout / private
    } else {
      const baseRoute = base.replace(/^\[(\.{3})?([^\]]+)\]$/, (_, spread, name) => spread ? `*${name}` : `:${name}`);
      route = '/' + [...routeParts, baseRoute].join('/');
    }
    route = route.replace(/\/+/g, '/');
  }

  // Component name guess.
  let name;
  if (base === 'index') {
    const last = (dir === '.' ? path.basename(screenRoot) : path.basename(dir)).replace(/[()_-]/g, '');
    name = `${cap(last)}Screen`;
  } else {
    const cleaned = base.replace(/[\[\]]/g, '').replace(/^\.\.\./, '');
    name = /Screen$/i.test(cleaned) ? cap(cleaned) : `${cap(cleaned)}Screen`;
  }

  return { name, route };
}

function cap(s) {
  if (!s) return s;
  return s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Light read of a screen file to surface signals useful to choreography:
 *   - imported design-system components (capitalized, local imports)
 *   - presence of navigation handlers (router.push, navigation.navigate)
 *   - presence of data hooks (useQuery, useEffect with fetch)
 */
function readScreenSignals(filePath) {
  let source;
  try { source = fs.readFileSync(filePath, 'utf-8'); } catch { return null; }
  const importedComponents = new Set();
  const importRe = /import\s+(?:type\s+)?(?:(\*\s+as\s+[A-Za-z_$][\w$]*)|(\{[^}]+\})|([A-Za-z_$][\w$]*))?(?:\s*,\s*(\{[^}]+\}))?\s+from\s+['"]([^'"]+)['"]/g;
  for (const m of source.matchAll(importRe)) {
    const spec = m[5];
    const isLocal = spec.startsWith('.') || spec.startsWith('@/') || spec.startsWith('~/') || spec.startsWith('src/');
    if (!isLocal) continue;
    const def = m[3];
    if (def && /^[A-Z]/.test(def)) importedComponents.add(def);
    for (const group of [m[2], m[4]]) {
      if (!group) continue;
      for (const part of group.slice(1, -1).split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop().trim();
        if (/^[A-Z][A-Za-z0-9_]*$/.test(name)) importedComponents.add(name);
      }
    }
  }
  return {
    importedComponents: [...importedComponents],
    hasNavigation: /\b(router|navigation)\.(push|navigate|replace|back)\b/.test(source),
    hasDataHook: /\b(useQuery|useSWR|useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*(fetch|axios))/.test(source),
    hasStateHook: /\b(useState|useReducer)\b/.test(source),
    lineCount: source.split('\n').length,
  };
}

// ── PRODUCT.md parser ─────────────────────────────────────────────────────

function readProductDoc() {
  const candidates = [productPath, 'PRODUCT.md', 'docs/PRODUCT.md', 'product.md'];
  for (const c of candidates) {
    const full = path.isAbsolute(c) ? c : path.join(rootDir, c);
    try {
      if (fs.statSync(full).isFile()) return { path: path.relative(rootDir, full), content: fs.readFileSync(full, 'utf-8') };
    } catch {}
  }
  return null;
}

/**
 * Split a markdown doc into sections keyed by H2 heading text (lowercased).
 * Inside each section, sub-bullets and H3s are kept as raw chunks.
 */
function sectionize(md) {
  const sections = new Map();
  const lines = md.split('\n');
  let current = '__preamble__';
  sections.set(current, []);
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      current = h2[1].trim().toLowerCase();
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    sections.get(current).push(line);
  }
  return sections;
}

function extractBullets(sectionLines) {
  const out = [];
  for (const line of sectionLines) {
    const m = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
}

function extractH3Blocks(sectionLines) {
  const blocks = [];
  let current = null;
  for (const line of sectionLines) {
    const h3 = line.match(/^###\s+(.+?)\s*$/);
    if (h3) {
      if (current) blocks.push(current);
      current = { title: h3[1].trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function parseProductDoc(content) {
  const sections = sectionize(content);
  const findSection = (...keys) => {
    for (const k of keys) {
      for (const [name, lines] of sections) {
        if (name === k || name.startsWith(k + ' ') || name.endsWith(' ' + k)) return lines;
      }
    }
    return null;
  };

  const goalsLines = findSection('goals', 'objectives', 'kpis', 'metrics') ?? [];
  const journeysLines = findSection('journeys', 'flows', 'user journeys', 'user flows', 'jobs to be done', 'jtbd') ?? [];
  const personasLines = findSection('personas', 'users', 'audience') ?? [];

  const goals = extractBullets(goalsLines).map((text, i) => ({ id: `goal-${i + 1}`, text }));
  const personas = extractBullets(personasLines).map((text, i) => ({ id: `persona-${i + 1}`, text }));

  // Journeys can be either bullets ("- Onboarding: ...") or H3 blocks.
  const h3 = extractH3Blocks(journeysLines);
  const journeys = h3.length
    ? h3.map((b, i) => ({
        id: `journey-${i + 1}`,
        name: b.title,
        body: b.body.join('\n').trim(),
        steps: extractBullets(b.body),
      }))
    : extractBullets(journeysLines).map((text, i) => {
        const [name, ...rest] = text.split(':');
        return {
          id: `journey-${i + 1}`,
          name: rest.length ? name.trim() : `Journey ${i + 1}`,
          body: rest.length ? rest.join(':').trim() : text.trim(),
          steps: [],
        };
      });

  return { goals, journeys, personas };
}

// ── main ──────────────────────────────────────────────────────────────────

function run() {
  const screenRoots = existingDirs(screensDirs);
  const screens = [];
  for (const root of screenRoots) {
    for (const filePath of collectFiles(root)) {
      // Skip layout files (expo-router _layout.tsx) and route groups — they aren't
      // "screens" the user perceives.
      const base = path.basename(filePath, path.extname(filePath));
      if (base.startsWith('_') || base === '+not-found') continue;
      const { name, route } = deriveScreenIdentity(filePath, root);
      const signals = readScreenSignals(filePath) ?? {};
      screens.push({
        name, route,
        file: path.relative(rootDir, filePath),
        ...signals,
      });
    }
  }

  // Sort screens: routed first by depth, then by name.
  screens.sort((a, b) => {
    const da = (a.route ?? '').split('/').filter(Boolean).length;
    const db = (b.route ?? '').split('/').filter(Boolean).length;
    if (da !== db) return da - db;
    return a.name.localeCompare(b.name);
  });

  const product = readProductDoc();
  const parsed = product ? parseProductDoc(product.content) : { goals: [], journeys: [], personas: [] };

  const result = {
    screens,
    journeys: parsed.journeys,
    goals: parsed.goals,
    personas: parsed.personas,
    summary: {
      rootDir,
      productDoc: product?.path ?? null,
      screenCount: screens.length,
      routedScreens: screens.filter(s => s.route).length,
      journeyCount: parsed.journeys.length,
      goalCount: parsed.goals.length,
      personaCount: parsed.personas.length,
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

try { run(); }
catch (err) {
  process.stderr.write(`app-anatomy: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
