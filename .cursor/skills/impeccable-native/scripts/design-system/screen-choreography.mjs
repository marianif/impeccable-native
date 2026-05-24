#!/usr/bin/env node

/**
 * screen-choreography.mjs
 *
 * The first-class artifact that turns organisms into living things on screens.
 * For each screen, emits a choreography record:
 *   - regions    — top-fixed, top-scrolling, main, bottom-fixed, etc.
 *   - occupants  — which components live in each region
 *   - hierarchy  — (seeded empty) which occupant yields to whom and when
 *   - entries    — how the user arrives (deep links, tab switches, push)
 *   - exits      — where the user goes from here
 *   - moments    — (seeded empty) named time-windows ("first 3s", "post-action")
 *
 * The script seeds what it can statically infer from the screen file:
 *   - regions     from SafeAreaView / ScrollView / FlatList / fixed-position styles
 *   - occupants   from the JSX tree, grouped by region
 *   - entries     from router/navigation references and deep-link configs
 *   - exits       from router.push / navigation.navigate call sites
 *
 * The agent enriches `hierarchy` and `moments` in Act 2 — fields the static
 * scan can't infer. Those keys are present in the output as empty arrays so
 * the schema is stable.
 *
 * Usage:
 *   node screen-choreography.mjs [--dir=path]
 *                                 [--screens-dir=screens,app,src/screens]
 *
 * Output (stdout, JSON):
 *   {
 *     "choreography": [ ScreenChoreography, ... ],
 *     "summary":      { ... }
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
const treePath = flag('tree');
const screensDirs = (flag('screens-dir') ?? 'screens,app,src/screens')
  .split(',').map(s => s.trim()).filter(Boolean);

function loadTree() {
  if (!treePath) return null;
  try { return JSON.parse(fs.readFileSync(path.resolve(treePath), 'utf-8')); }
  catch { return null; }
}

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.expo', '.metro-cache',
  'android', 'ios', '__generated__', 'coverage', '.impeccable', '.next',
]);

// ── filesystem ────────────────────────────────────────────────────────────

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

function screenIdentity(filePath, screenRoot) {
  const rel = path.relative(screenRoot, filePath);
  const base = path.basename(rel, path.extname(rel));
  const dir = path.dirname(rel);
  let name;
  if (base === 'index') {
    const last = (dir === '.' ? path.basename(screenRoot) : path.basename(dir)).replace(/[()_-]/g, '');
    name = `${cap(last)}Screen`;
  } else {
    const cleaned = base.replace(/[\[\]]/g, '').replace(/^\.\.\./, '');
    name = /Screen$/i.test(cleaned) ? cap(cleaned) : `${cap(cleaned)}Screen`;
  }
  return name;
}
function cap(s) {
  return (s ?? '').split(/[-_\s]+/).filter(Boolean)
    .map(p => p[0].toUpperCase() + p.slice(1)).join('');
}

// ── region inference ──────────────────────────────────────────────────────

/**
 * We walk the JSX of a screen file once and bucket every depth-1ish capitalized
 * element into a region. Rules:
 *
 *   - inside <Header>, <NavigationHeader>, "*Header" component, or with style
 *     containing `position: 'absolute'` + top: 0 → "top-fixed"
 *   - inside ScrollView / FlatList / SectionList → "main-scrolling"
 *   - inside SafeAreaView at root → considered the "stage"; classify children further
 *   - elements with style containing `position: 'absolute'` + bottom: 0 → "bottom-fixed"
 *   - elements wrapped in BottomSheet, Modal, Sheet*, *Sheet → "overlay"
 *   - everything else above-fold-ish in the first ~10 elements → "above-fold"
 *   - subsequent → "main"
 *
 * This is structural pattern-matching — good enough for a seed; the agent
 * refines in Act 2.
 */
const REGION_OPENERS = [
  { re: /<\s*(\w*Header|NavigationHeader|StatusBar|TopBar)\b/, region: 'top-fixed' },
  { re: /<\s*(ScrollView|FlatList|SectionList|KeyboardAwareScrollView)\b/, region: 'main-scrolling' },
  { re: /<\s*(TabBar|BottomBar|FooterBar|\w*Footer)\b/, region: 'bottom-fixed' },
  { re: /<\s*(Modal|BottomSheet|\w*Sheet|Overlay|Toast|Snackbar)\b/, region: 'overlay' },
];

function inferRegionsAndOccupants(source) {
  // Find the first return-of-JSX in the file (the screen's root render).
  const retMatches = [
    ...source.matchAll(/return\s*\(\s*</g),
    ...source.matchAll(/return\s*</g),
  ];
  if (retMatches.length === 0) return { regions: [], allOccupants: [] };
  retMatches.sort((a, b) => a.index - b.index);
  const startIdx = source.indexOf('<', retMatches[0].index);
  if (startIdx < 0) return { regions: [], allOccupants: [] };

  // Heuristic walk: tokenize capitalized tags in the rest of the file (within
  // a generous window). Track a stack of active region contexts.
  const window = source.slice(startIdx, startIdx + 20000);
  const tagRe = /<\s*(\/?)([A-Z][A-Za-z0-9_.]*)([^>]*?)(\/?)>/g;

  const regionStack = []; // [{ region, depth }]
  const elementsByRegion = new Map();
  const allOccupants = [];
  let depth = 0;
  let positionInScreen = 0;

  function pushOccupant(region, tag, line, attrs) {
    if (!elementsByRegion.has(region)) elementsByRegion.set(region, []);
    elementsByRegion.get(region).push({ tag, line, position: positionInScreen++ });
    allOccupants.push({ tag, region, line });
  }

  for (const m of window.matchAll(tagRe)) {
    const isClose = m[1] === '/';
    const isSelfClose = m[4] === '/';
    const tag = m[2];
    const attrs = m[3] ?? '';
    const line = source.slice(0, startIdx + m.index).split('\n').length;

    if (isClose) {
      depth--;
      // Pop region context if it owned this depth.
      while (regionStack.length > 0 && regionStack[regionStack.length - 1].depth > depth) {
        regionStack.pop();
      }
      continue;
    }

    // Determine current region (top of stack, or "above-fold" / "main" by position).
    let currentRegion = regionStack.length > 0
      ? regionStack[regionStack.length - 1].region
      : (positionInScreen < 6 ? 'above-fold' : 'main');

    // Detect absolute positioning from attrs (style={{ position: 'absolute', top: 0 }}).
    if (/position\s*:\s*['"]absolute['"]/.test(attrs)) {
      if (/top\s*:\s*0\b/.test(attrs)) currentRegion = 'top-fixed';
      else if (/bottom\s*:\s*0\b/.test(attrs)) currentRegion = 'bottom-fixed';
      else currentRegion = 'overlay-absolute';
    }

    // Skip the wrapping containers themselves from occupants — they ARE the region.
    const matchedOpener = REGION_OPENERS.find(r => r.re.test(`<${tag}`));
    if (matchedOpener) {
      regionStack.push({ region: matchedOpener.region, depth });
    } else if (tag !== 'SafeAreaView' && tag !== 'View' && tag !== 'Fragment') {
      // Real occupant.
      pushOccupant(currentRegion, tag, line, attrs);
    }

    if (!isSelfClose) depth++;
  }

  const regions = [...elementsByRegion.entries()]
    .map(([name, occupants]) => ({
      name,
      occupants: dedupeOccupants(occupants),
      occupantCount: occupants.length,
    }))
    .sort((a, b) => regionOrder(a.name) - regionOrder(b.name));

  return { regions, allOccupants };
}

function dedupeOccupants(occupants) {
  const seen = new Map();
  for (const o of occupants) {
    if (!seen.has(o.tag)) seen.set(o.tag, { tag: o.tag, count: 0, firstLine: o.line });
    seen.get(o.tag).count += 1;
  }
  return [...seen.values()].sort((a, b) => a.firstLine - b.firstLine);
}

function regionOrder(name) {
  const order = ['top-fixed', 'above-fold', 'main', 'main-scrolling', 'bottom-fixed', 'overlay', 'overlay-absolute'];
  const i = order.indexOf(name);
  return i === -1 ? 99 : i;
}

// ── entries & exits ───────────────────────────────────────────────────────

function inferExits(source) {
  const exits = [];
  const navRe = /(?:router|navigation)\.(?:push|navigate|replace)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  for (const m of source.matchAll(navRe)) {
    exits.push({ to: m[1], kind: 'navigation' });
  }
  const linkRe = /<\s*Link\b[^>]*\bhref\s*=\s*['"`]([^'"`]+)['"`]/g;
  for (const m of source.matchAll(linkRe)) {
    exits.push({ to: m[1], kind: 'link' });
  }
  if (/\bnavigation\.goBack\b|\brouter\.back\b/.test(source)) {
    exits.push({ to: '(back)', kind: 'back' });
  }
  // Dedup
  const seen = new Set();
  return exits.filter(e => {
    const k = `${e.kind}:${e.to}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function inferEntries(source, relPath) {
  const entries = [];
  // Expo-router: file path implies entry mechanism (tab, modal, deep link)
  if (/\(tabs\)/.test(relPath)) entries.push({ kind: 'tab', detail: 'tab navigator' });
  if (/\bmodal\b/.test(relPath)) entries.push({ kind: 'modal', detail: 'modal route' });
  if (/\[.*\]/.test(relPath)) entries.push({ kind: 'deep-link', detail: 'dynamic route param' });
  if (/useLocalSearchParams|useGlobalSearchParams|getInitialURL/.test(source)) {
    entries.push({ kind: 'deep-link', detail: 'reads route params' });
  }
  if (/useFocusEffect|useIsFocused/.test(source)) {
    entries.push({ kind: 'focus-event', detail: 'reacts to screen focus' });
  }
  if (entries.length === 0) entries.push({ kind: 'unknown', detail: 'no static entry signal' });
  return entries;
}

// ── per-screen build ──────────────────────────────────────────────────────

function buildScreenChoreography(filePath, screenRoot) {
  let source;
  try { source = fs.readFileSync(filePath, 'utf-8'); } catch { return null; }
  const rel = path.relative(rootDir, filePath);
  const name = screenIdentity(filePath, screenRoot);
  const { regions, allOccupants } = inferRegionsAndOccupants(source);
  const entries = inferEntries(source, rel);
  const exits = inferExits(source);

  return {
    screen: name,
    file: rel,
    regions,
    hierarchy: [], // agent fills in Act 2
    entries,
    exits,
    moments: [],   // agent fills in Act 2
    signals: {
      hasScrollContainer: /<\s*(ScrollView|FlatList|SectionList)\b/.test(source),
      hasOverlay: /<\s*(Modal|BottomSheet|\w*Sheet)\b/.test(source),
      hasSafeArea: /<\s*SafeAreaView\b/.test(source),
      uniqueOccupants: new Set(allOccupants.map(o => o.tag)).size,
    },
  };
}

// ── main ──────────────────────────────────────────────────────────────────

function run() {
  const tree = loadTree();
  const treeScreenRoots = (tree?.roots?.screens ?? []).map(p => path.join(rootDir, p));
  const screenRoots = treeScreenRoots.length > 0 ? treeScreenRoots : existingDirs(screensDirs);
  const choreography = [];

  for (const root of screenRoots) {
    for (const filePath of collectFiles(root)) {
      const base = path.basename(filePath, path.extname(filePath));
      if (base.startsWith('_') || base === '+not-found') continue;
      const c = buildScreenChoreography(filePath, root);
      if (c) choreography.push(c);
    }
  }

  choreography.sort((a, b) => a.screen.localeCompare(b.screen));

  const result = {
    choreography,
    summary: {
      rootDir,
      screenRoots: screenRoots.map(r => path.relative(rootDir, r)),
      screenCount: choreography.length,
      screensWithOverlay: choreography.filter(c => c.signals.hasOverlay).length,
      screensWithScrollContainer: choreography.filter(c => c.signals.hasScrollContainer).length,
      regionsUsed: [...new Set(choreography.flatMap(c => c.regions.map(r => r.name)))].sort(),
      note: 'hierarchy[] and moments[] are deliberately empty — the agent fills these in Act 2 from journey + neighbor analysis.',
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

try { run(); }
catch (err) {
  process.stderr.write(`screen-choreography: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
