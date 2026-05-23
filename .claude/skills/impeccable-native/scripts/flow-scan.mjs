#!/usr/bin/env node

/**
 * flow-scan.mjs
 *
 * Reconnaissance for `/impeccable-native flow`. Maps the navigation surface of
 * a React Native / Expo project so both agents and developers can see the
 * shape of the app at a glance: which screens exist, how they connect, and
 * where the entry points are.
 *
 * This is an *information surface*, not an analyzer. It surfaces facts; it
 * does not recommend changes.
 *
 * It branches on the router detected by detect-rn-flavor.mjs:
 *   - expo-router       → walks the `app/` directory (file-system routing)
 *   - react-navigation  → parses createXNavigator calls and <Stack.Screen> JSX
 *   - unknown           → reports what was found and stops
 *
 * Usage:
 *   node flow-scan.mjs [--dir=path]
 *
 * Output (stdout, JSON):
 *   {
 *     "router": "expo-router" | "react-navigation" | "unknown",
 *     "screens":    [ { name, file, route, params, kind } ],
 *     "navigators": [ { name, type, file, line, children: [...] } ],
 *     "transitions":[ { from, to, file, line, kind } ],
 *     "deepLinks":  [ { path, screen, file, line } ],
 *     "entryPoints":[ { file, line, kind } ],
 *     "summary":    { totalScreens, totalNavigators, totalTransitions, note }
 *   }
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const rootDir = (() => {
  const flag = args.find(a => a.startsWith('--dir='));
  return flag ? path.resolve(flag.split('=')[1]) : process.cwd();
})();

// ── helpers ────────────────────────────────────────────────────────────────

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

function detectRouter() {
  // Re-use detect-rn-flavor.mjs so the source of truth is shared.
  const detect = path.join(__dirname, 'detect-rn-flavor.mjs');
  try {
    const out = execFileSync('node', [detect], { cwd: rootDir, encoding: 'utf-8' });
    return JSON.parse(out);
  } catch {
    return { router: 'unknown', flavor: 'unknown' };
  }
}

// ── expo-router: file-system routing ──────────────────────────────────────

function scanExpoRouter() {
  // Conventional location is `app/`, but some projects use `src/app/`.
  const candidates = ['app', 'src/app'];
  let appDir = null;
  for (const c of candidates) {
    const abs = path.join(rootDir, c);
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      appDir = abs;
      break;
    }
  }
  if (!appDir) {
    return { screens: [], navigators: [], transitions: [], deepLinks: [], entryPoints: [] };
  }

  const screens = [];
  const navigators = [];
  const entryPoints = [];

  function walk(dir, segments = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(full, [...segments, entry.name]);
        continue;
      }
      if (!/\.(tsx?|jsx?)$/.test(entry.name)) continue;

      const base = entry.name.replace(/\.(tsx?|jsx?)$/, '');
      const rel = path.relative(rootDir, full);

      // _layout files define navigator nesting in expo-router.
      if (base === '_layout') {
        const source = safeRead(full);
        const type = detectLayoutType(source);
        navigators.push({
          name: segments.length === 0 ? 'root' : segments.join('/'),
          type,
          file: rel,
          line: 1,
          children: [],
        });
        continue;
      }

      // Special files.
      if (base === '+not-found' || base === '+native-intent') continue;

      // Build the route. `index` → parent segment. `(group)` → invisible group.
      // `[param]` → dynamic. `[...rest]` → catch-all.
      const routeSegments = [];
      for (const seg of segments) {
        if (/^\(.+\)$/.test(seg)) continue; // route group
        routeSegments.push(seg);
      }
      const fileSeg = base === 'index' ? '' : base;
      if (fileSeg) routeSegments.push(fileSeg);
      const route = '/' + routeSegments.join('/');

      const params = [];
      for (const seg of [...segments, fileSeg].filter(Boolean)) {
        const m = seg.match(/^\[(\.\.\.)?(.+)\]$/);
        if (m) params.push({ name: m[2], catchAll: !!m[1] });
      }

      screens.push({
        name: base === 'index' ? (segments[segments.length - 1] || 'index') : base,
        file: rel,
        route: route || '/',
        params,
        kind: detectScreenKind(base, segments),
      });
    }
  }

  walk(appDir);

  // Entry points: root _layout and root index.
  for (const nav of navigators) {
    if (nav.name === 'root') entryPoints.push({ file: nav.file, line: 1, kind: 'root-layout' });
  }
  const rootIndex = screens.find(s => s.route === '/');
  if (rootIndex) entryPoints.push({ file: rootIndex.file, line: 1, kind: 'root-index' });

  // Transitions: scan all project files for `router.push/replace/navigate('/path')`
  // and `<Link href="/path">` references.
  const allFiles = collectFiles(rootDir);
  const transitions = scanExpoRouterTransitions(allFiles, screens);

  // Deep links: expo-router routes ARE the deep-link surface. Surface dynamic
  // routes and root-level routes as the public link map.
  const deepLinks = screens
    .filter(s => s.route !== '/')
    .map(s => ({ path: s.route, screen: s.name, file: s.file, line: 1 }));

  return { screens, navigators, transitions, deepLinks, entryPoints };
}

function detectLayoutType(source) {
  if (!source) return 'unknown';
  if (/<Tabs[\s>]/.test(source)) return 'tabs';
  if (/<Drawer[\s>]/.test(source)) return 'drawer';
  if (/<Stack[\s>]/.test(source)) return 'stack';
  if (/<Slot[\s/>]/.test(source)) return 'slot';
  return 'unknown';
}

function detectScreenKind(base, segments) {
  if (base.startsWith('+')) return 'special';
  if (segments.some(s => s === 'modal' || s === '(modal)') || base === 'modal') return 'modal';
  return 'screen';
}

const EXPO_TRANSITION_RE =
  /(?:router|navigation)\.(push|replace|navigate|back)\s*\(\s*['"`]([^'"`]+)['"`]/g;
const EXPO_LINK_RE =
  /<Link[^>]*\shref\s*=\s*(?:['"`]([^'"`]+)['"`]|\{[^}]*['"`]([^'"`]+)['"`])/g;

function scanExpoRouterTransitions(allFiles, screens) {
  const screenByRoute = new Map(screens.map(s => [s.route, s.name]));
  const transitions = [];

  for (const file of allFiles) {
    const source = safeRead(file);
    if (!source) continue;
    const rel = path.relative(rootDir, file);
    const charToLine = charToLineFactory(source);

    for (const m of source.matchAll(EXPO_TRANSITION_RE)) {
      const target = normalizeRoute(m[2]);
      transitions.push({
        from: rel,
        to: screenByRoute.get(target) || target,
        targetRoute: target,
        file: rel,
        line: charToLine(m.index),
        kind: m[1],
      });
    }
    for (const m of source.matchAll(EXPO_LINK_RE)) {
      const target = normalizeRoute(m[1] || m[2]);
      transitions.push({
        from: rel,
        to: screenByRoute.get(target) || target,
        targetRoute: target,
        file: rel,
        line: charToLine(m.index),
        kind: 'link',
      });
    }
  }
  return transitions;
}

function normalizeRoute(r) {
  if (!r) return r;
  // Strip query strings; collapse trailing slash.
  const noQuery = r.split('?')[0];
  if (noQuery.length > 1 && noQuery.endsWith('/')) return noQuery.slice(0, -1);
  return noQuery;
}

// ── react-navigation: imperative configuration ────────────────────────────

const NAVIGATOR_FACTORY_RE =
  /create(NativeStack|Stack|BottomTab|Tab|MaterialTopTab|MaterialBottomTab|Drawer)Navigator\s*(?:<[^>]+>)?\s*\(/g;
const NAVIGATOR_VAR_RE =
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*create(NativeStack|Stack|BottomTab|Tab|MaterialTopTab|MaterialBottomTab|Drawer)Navigator/g;
const SCREEN_JSX_RE =
  /<([A-Za-z_$][\w$]*)\.Screen\s+([^>]*?)\/?>/g;
const ATTR_RE = /([\w-]+)\s*=\s*(?:\{([^}]+)\}|"([^"]*)"|'([^']*)')/g;
const NAV_CALL_RE =
  /(?:navigation|props\.navigation)\.(navigate|push|replace|popTo|reset)\s*\(\s*['"`]([^'"`]+)['"`]/g;
const LINKING_RE =
  /linking\s*[:=]\s*\{[\s\S]*?screens\s*:\s*(\{[\s\S]*?\})/;

function scanReactNavigation() {
  const allFiles = collectFiles(rootDir);
  const screens = [];
  const navigators = [];
  const transitions = [];
  const deepLinks = [];
  const entryPoints = [];

  // navigatorVarName → navigator type
  const navVarTypes = new Map();

  for (const file of allFiles) {
    const source = safeRead(file);
    if (!source) continue;
    const rel = path.relative(rootDir, file);
    const charToLine = charToLineFactory(source);

    for (const m of source.matchAll(NAVIGATOR_VAR_RE)) {
      const varName = m[1];
      const type = m[2].toLowerCase();
      navVarTypes.set(varName, type);
      navigators.push({
        name: varName,
        type,
        file: rel,
        line: charToLine(m.index),
        children: [],
      });
    }

    for (const m of source.matchAll(SCREEN_JSX_RE)) {
      const navVar = m[1];
      if (!navVarTypes.has(navVar)) continue;
      const attrs = parseAttrs(m[2]);
      if (!attrs.name) continue;
      const line = charToLine(m.index);
      screens.push({
        name: stripQuotes(attrs.name),
        file: rel,
        route: stripQuotes(attrs.name),
        params: [],
        kind: 'screen',
        navigator: navVar,
        navigatorType: navVarTypes.get(navVar),
        line,
      });
      const parent = navigators.find(n => n.name === navVar && n.file === rel);
      if (parent) parent.children.push(stripQuotes(attrs.name));
    }

    for (const m of source.matchAll(NAV_CALL_RE)) {
      transitions.push({
        from: rel,
        to: m[2],
        file: rel,
        line: charToLine(m.index),
        kind: m[1],
      });
    }

    // NavigationContainer is the entry point.
    const ncMatch = source.match(/<NavigationContainer[\s>]/);
    if (ncMatch) {
      entryPoints.push({
        file: rel,
        line: charToLine(ncMatch.index),
        kind: 'NavigationContainer',
      });
    }

    // linking.config: parse `screens: { ScreenName: 'path' }`.
    const linkMatch = source.match(LINKING_RE);
    if (linkMatch) {
      const block = linkMatch[1];
      const entryRe = /([A-Za-z_$][\w$]*)\s*:\s*['"`]([^'"`]+)['"`]/g;
      for (const e of block.matchAll(entryRe)) {
        deepLinks.push({
          path: e[2],
          screen: e[1],
          file: rel,
          line: charToLine(linkMatch.index + linkMatch[0].indexOf(e[0])),
        });
      }
    }
  }

  return { screens, navigators, transitions, deepLinks, entryPoints };
}

function parseAttrs(s) {
  const out = {};
  for (const m of s.matchAll(ATTR_RE)) {
    out[m[1]] = m[2] ?? m[3] ?? m[4];
  }
  return out;
}

function stripQuotes(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/^['"`]|['"`]$/g, '');
}

// ── shared ─────────────────────────────────────────────────────────────────

function safeRead(file) {
  try { return fs.readFileSync(file, 'utf-8'); } catch { return null; }
}

function buildNote(router, screens, navigators, transitions) {
  if (router === 'unknown') {
    return 'No supported router detected. The agent should report this and stop — there is no navigation surface to map.';
  }
  const parts = [];
  parts.push(`Router: ${router}.`);
  parts.push(`${screens.length} screen(s), ${navigators.length} navigator(s), ${transitions.length} transition site(s).`);
  if (screens.length === 0) {
    parts.push('No screens detected — the project may use a non-standard layout; verify the router config manually.');
  }
  return parts.join(' ');
}

// ── main ───────────────────────────────────────────────────────────────────

function run() {
  if (!fs.existsSync(rootDir)) {
    process.stderr.write(
      `flow-scan: directory not found: ${rootDir}\n` +
      `  Run from the root of your React Native project, or pass --dir=path.\n`
    );
    process.exit(1);
  }

  const flavor = detectRouter();
  const router = flavor.router || 'unknown';

  let data = { screens: [], navigators: [], transitions: [], deepLinks: [], entryPoints: [] };
  if (router === 'expo-router') {
    data = scanExpoRouter();
  } else if (router === 'react-navigation') {
    data = scanReactNavigation();
  }

  const result = {
    router,
    flavor: flavor.flavor || 'unknown',
    ...data,
    summary: {
      totalScreens: data.screens.length,
      totalNavigators: data.navigators.length,
      totalTransitions: data.transitions.length,
      totalDeepLinks: data.deepLinks.length,
      note: buildNote(router, data.screens, data.navigators, data.transitions),
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(0);
}

try {
  run();
} catch (err) {
  process.stderr.write(`flow-scan: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
