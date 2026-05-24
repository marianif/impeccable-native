#!/usr/bin/env node

/**
 * directory-tree.mjs
 *
 * Maps the codebase's directory shape. Emits the single source of truth that
 * every other design-system script reads to know:
 *
 *   - where components live (atomic-design folders, feature folders, flat dirs)
 *   - where screens live (expo-router `app/`, React Navigation `screens/`)
 *   - what each folder MEANS (atoms-folder / molecules-folder / organisms-folder /
 *     templates-folder / pages-folder / screens-folder / feature-folder / unknown-folder)
 *   - which conventions are in use (component-per-folder, barrel exports, test/story
 *     colocation, naming convention)
 *
 * Convention recognition is STRICT: only well-known patterns become typed kinds.
 * Unknown top-level component folders (`shared`, `ui`, `primitives`, etc.) stay
 * as `unknown-folder` and are surfaced in `needsClarification` so the agent can
 * ask the user once rather than guessing.
 *
 * This is the FIRST script in the design-system Act 1 pipeline. Its output is
 * consumed by component-inventory (for path-based kindGuess), duplication-report
 * (sibling weighting), composition-patterns (precise screen scoping), and
 * app-anatomy (screen list).
 *
 * Usage:
 *   node directory-tree.mjs [--dir=path]
 *
 * Output (stdout, JSON):
 *   {
 *     "roots":             { "components": [...], "screens": [...], "features": [...] },
 *     "tree":              [ FolderNode, ... ],
 *     "componentFolders":  [ { path, kind, componentCount } ],   // flat index by path
 *     "screenFolders":     [ { path, kind, screenCount } ],
 *     "conventions":       { ... },
 *     "needsClarification":[ { path, reason } ],
 *     "summary":           { ... }
 *   }
 *
 * FolderNode shape:
 *   {
 *     "path":     "components/atoms",
 *     "kind":     "atoms-folder",
 *     "depth":    1,
 *     "files":    ["Button.tsx", "Text.tsx"],     // source files at this level
 *     "children": [FolderNode, ...]               // sub-folders
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

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.expo', '.metro-cache',
  'android', 'ios', '__generated__', 'coverage', '.impeccable', '.next',
  '.turbo', '.cache', '.vercel', '.idea', '.vscode',
]);

// ── folder-kind recognition (STRICT) ──────────────────────────────────────

// Atomic design — exact folder names only (case-insensitive).
const ATOMIC_NAMES = {
  atoms:     'atoms-folder',
  molecules: 'molecules-folder',
  organisms: 'organisms-folder',
  templates: 'templates-folder',
  pages:     'pages-folder',
};

// Screen homes. Expo-router uses `app/`; React Navigation conventions use
// `screens/`. Also accept `src/screens` and `src/app`.
const SCREEN_NAMES = new Set(['screens', 'app']);

// Component-root names (anything named one of these at top-level or under src/
// is treated as a components root and gets walked deeply).
const COMPONENT_ROOT_NAMES = new Set(['components']);

// Feature-folder roots — directories whose direct children are domain features.
const FEATURE_ROOT_NAMES = new Set(['features', 'modules']);

// Top-level directories we walk into when looking for component/screen roots.
const SRC_LIKE_NAMES = new Set(['src', 'app', 'packages']);

function recogniseFolderKind(name, parentKind, depth) {
  const lower = name.toLowerCase();
  // Atomic-design folders are ONLY valid when they sit directly under a
  // components root or at the project root. Otherwise `.specify/templates`,
  // `docs/pages`, vendor dirs, etc. would all spuriously match.
  if (ATOMIC_NAMES[lower]) {
    const isUnderComponentsRoot = parentKind === 'components-folder';
    const isTopLevel = depth === 1;
    if (isUnderComponentsRoot || isTopLevel) return ATOMIC_NAMES[lower];
  }
  if (SCREEN_NAMES.has(lower) && depth <= 2) return 'screens-folder';
  if (COMPONENT_ROOT_NAMES.has(lower) && depth <= 2) return 'components-folder';
  if (FEATURE_ROOT_NAMES.has(lower) && depth <= 2) return 'features-folder';

  // Inside a features-folder, every direct child is a feature-folder.
  if (parentKind === 'features-folder') return 'feature-folder';

  // Inside a components-folder (the flat layout), a sub-dir named after a
  // component (PascalCase) with sources is a component-folder.
  if (parentKind === 'components-folder' && /^[A-Z][A-Za-z0-9]*$/.test(name)) {
    return 'component-folder';
  }

  // Inside an atomic-design folder (atoms/molecules/organisms), each PascalCase
  // sub-dir is a component-folder.
  if (
    (parentKind === 'atoms-folder' || parentKind === 'molecules-folder' ||
     parentKind === 'organisms-folder' || parentKind === 'templates-folder' ||
     parentKind === 'pages-folder') &&
    /^[A-Z][A-Za-z0-9]*$/.test(name)
  ) {
    return 'component-folder';
  }

  // Inside a feature-folder, common sub-folders.
  if (parentKind === 'feature-folder') {
    if (lower === 'components') return 'components-folder';
    if (lower === 'screens') return 'screens-folder';
    if (lower === 'hooks') return 'hooks-folder';
    if (lower === 'utils' || lower === 'lib') return 'utils-folder';
  }

  // Anything else at the upper depths under a components root is unknown —
  // surfaced for clarification.
  if (
    (parentKind === 'components-folder' || parentKind === 'src-folder') &&
    depth <= 3
  ) {
    return 'unknown-folder';
  }

  // SRC-like roots that are not yet typed.
  if (SRC_LIKE_NAMES.has(lower) && depth === 0) return 'src-folder';

  return 'other-folder';
}

// ── file conventions ──────────────────────────────────────────────────────

const SOURCE_RE = /\.(tsx?|jsx?)$/;
const TEST_RE   = /\.(test|spec)\.(tsx?|jsx?)$/;
const STORY_RE  = /\.stories\.(tsx?|jsx?)$/;
const BARREL_NAMES = new Set(['index.ts', 'index.tsx', 'index.js', 'index.jsx']);

function classifyFile(name) {
  if (TEST_RE.test(name)) return 'test';
  if (STORY_RE.test(name)) return 'story';
  if (BARREL_NAMES.has(name)) return 'barrel';
  if (/\.(d\.ts)$/.test(name)) return 'declaration';
  if (SOURCE_RE.test(name)) return 'source';
  return 'other';
}

// ── walk ──────────────────────────────────────────────────────────────────

function buildTree(absPath, name, depth, parentKind) {
  let entries;
  try { entries = fs.readdirSync(absPath, { withFileTypes: true }); } catch { return null; }
  if (IGNORE_DIRS.has(name)) return null;

  const kind = recogniseFolderKind(name, parentKind, depth);
  const files = [];
  const filesByClass = { source: [], test: [], story: [], barrel: [], declaration: [], other: [] };
  const childDirs = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      childDirs.push(entry);
    } else if (entry.isFile()) {
      const cls = classifyFile(entry.name);
      filesByClass[cls].push(entry.name);
      if (cls !== 'other') files.push(entry.name);
    }
  }

  const children = childDirs
    .map(d => buildTree(path.join(absPath, d.name), d.name, depth + 1, kind))
    .filter(Boolean);

  return {
    path: path.relative(rootDir, absPath) || '.',
    name,
    kind,
    depth,
    files,
    filesByClass,
    children,
  };
}

// ── flatten for downstream consumers ──────────────────────────────────────

const COMPONENT_BEARING_KINDS = new Set([
  'atoms-folder', 'molecules-folder', 'organisms-folder', 'templates-folder',
  'pages-folder', 'components-folder', 'component-folder', 'features-folder',
  'feature-folder', 'unknown-folder',
]);

function flattenComponentFolders(tree, out = []) {
  if (!tree) return out;
  if (COMPONENT_BEARING_KINDS.has(tree.kind)) {
    // Leaf = a component-folder, OR a folder that holds source files directly
    // (no further component-kind children). The latter catches flat layouts
    // like `components/Button.tsx` where there's no per-component folder.
    const hasComponentBearingChildren = tree.children.some(c => COMPONENT_BEARING_KINDS.has(c.kind));
    const isLeaf = tree.kind === 'component-folder' || !hasComponentBearingChildren;
    out.push({
      path: tree.path,
      kind: tree.kind,
      isLeaf,
      sourceFileCount: tree.filesByClass.source.length,
      barrelFileCount: tree.filesByClass.barrel.length,
      testFileCount: tree.filesByClass.test.length,
      storyFileCount: tree.filesByClass.story.length,
    });
  }
  for (const child of tree.children) flattenComponentFolders(child, out);
  return out;
}

function flattenScreenFolders(tree, out = []) {
  if (!tree) return out;
  if (tree.kind === 'screens-folder') {
    out.push({
      path: tree.path,
      kind: tree.kind,
      // Count source files recursively under this screens root.
      screenFileCount: countSourceFilesUnder(tree),
    });
  }
  for (const child of tree.children) flattenScreenFolders(child, out);
  return out;
}

function countSourceFilesUnder(node) {
  let n = node.filesByClass.source.length;
  for (const c of node.children) n += countSourceFilesUnder(c);
  return n;
}

// ── conventions inference ─────────────────────────────────────────────────

function inferConventions(rootNode, componentFolders) {
  const hasAtomic =
    componentFolders.some(f => f.kind === 'atoms-folder') ||
    componentFolders.some(f => f.kind === 'molecules-folder') ||
    componentFolders.some(f => f.kind === 'organisms-folder');

  const componentDirs = componentFolders.filter(f => f.kind === 'component-folder');
  const componentPerFolder = componentDirs.length >= 3
    && componentDirs.filter(f => f.barrelFileCount > 0 || f.sourceFileCount > 0).length / componentDirs.length >= 0.7;

  const barrelExports = componentFolders.some(f => f.barrelFileCount > 0);
  const testColocation = componentFolders.some(f => f.testFileCount > 0);
  const storyColocation = componentFolders.some(f => f.storyFileCount > 0);

  // Naming convention: sample 10 component source files.
  let pascal = 0, kebab = 0, camel = 0, sample = 0;
  function sampleFiles(node) {
    if (sample >= 20) return;
    for (const f of node.filesByClass.source) {
      if (sample >= 20) return;
      const base = f.replace(/\.(tsx?|jsx?)$/, '');
      if (/^[A-Z][A-Za-z0-9]*$/.test(base)) pascal++;
      else if (/^[a-z]+(?:-[a-z0-9]+)+$/.test(base)) kebab++;
      else if (/^[a-z][A-Za-z0-9]*$/.test(base)) camel++;
      sample++;
    }
    for (const c of node.children) sampleFiles(c);
  }
  sampleFiles(rootNode);
  let namingConvention = 'mixed';
  const max = Math.max(pascal, kebab, camel);
  if (max > 0 && max / sample >= 0.7) {
    namingConvention = pascal === max ? 'PascalCase' : kebab === max ? 'kebab-case' : 'camelCase';
  }

  return {
    atomicDesign: hasAtomic,
    componentPerFolder,
    barrelExports,
    testColocation,
    storyColocation,
    namingConvention,
  };
}

// ── clarification surfacing ───────────────────────────────────────────────

function gatherNeedsClarification(componentFolders) {
  return componentFolders
    .filter(f => f.kind === 'unknown-folder')
    .map(f => ({
      path: f.path,
      reason: `Folder under a components root with non-atomic name; agent should ask the user once what this folder represents (shared primitives, vendor wrappers, deprecated sandbox, etc.).`,
      sourceFileCount: f.sourceFileCount,
    }));
}

// ── summary ───────────────────────────────────────────────────────────────

function buildSummary(componentFolders, screenFolders, conventions) {
  const byKind = {};
  for (const f of componentFolders) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
  return {
    rootDir,
    componentFolderCount: componentFolders.length,
    screenFolderCount: screenFolders.length,
    byKind,
    atomicDesign: conventions.atomicDesign,
    componentPerFolder: conventions.componentPerFolder,
    barrelExports: conventions.barrelExports,
    testColocation: conventions.testColocation,
    storyColocation: conventions.storyColocation,
    namingConvention: conventions.namingConvention,
  };
}

// ── roots ─────────────────────────────────────────────────────────────────

function pickRoots(componentFolders, screenFolders) {
  // Component roots: any `components-folder` at depth ≤ 2.
  // Atomic-design folders that are NOT under a `components-folder` parent are
  // also considered roots (top-level `atoms/`, `molecules/`, `organisms/`).
  const components = componentFolders
    .filter(f => f.kind === 'components-folder')
    .map(f => f.path);
  const atomicRoots = componentFolders
    .filter(f => f.kind === 'atoms-folder' || f.kind === 'molecules-folder' || f.kind === 'organisms-folder')
    .map(f => f.path);
  // Deduplicate; if `components/atoms` exists, `components` is the root, not `components/atoms`.
  const componentsSet = new Set(components);
  const independentAtomic = atomicRoots.filter(p => !componentsSet.has(path.dirname(p)));

  return {
    components: [...componentsSet, ...independentAtomic],
    screens: screenFolders.map(f => f.path),
    features: componentFolders.filter(f => f.kind === 'features-folder').map(f => f.path),
  };
}

// ── main ──────────────────────────────────────────────────────────────────

function run() {
  const root = buildTree(rootDir, path.basename(rootDir) || '.', 0, null);
  if (!root) {
    process.stdout.write(JSON.stringify({
      roots: { components: [], screens: [], features: [] },
      tree: [],
      componentFolders: [],
      screenFolders: [],
      conventions: {
        atomicDesign: false, componentPerFolder: false, barrelExports: false,
        testColocation: false, storyColocation: false, namingConvention: 'unknown',
      },
      needsClarification: [],
      summary: { rootDir, error: 'Cannot read root directory.' },
    }, null, 2) + '\n');
    return;
  }

  const componentFolders = flattenComponentFolders(root);
  const screenFolders = flattenScreenFolders(root);
  const conventions = inferConventions(root, componentFolders);
  const needsClarification = gatherNeedsClarification(componentFolders);
  const roots = pickRoots(componentFolders, screenFolders);
  const summary = buildSummary(componentFolders, screenFolders, conventions);

  // The top-level "tree" we emit is the list of typed roots, not the entire
  // project tree — keeps the output focused on what design-system cares about.
  const typedRoots = [];
  function collectTyped(node) {
    if (!node) return;
    if (node.kind && node.kind !== 'other-folder' && node.kind !== 'src-folder') {
      typedRoots.push(stripForOutput(node));
      return; // don't recurse into a typed subtree — its children are already in it
    }
    for (const c of node.children) collectTyped(c);
  }
  collectTyped(root);

  process.stdout.write(JSON.stringify({
    roots,
    tree: typedRoots,
    componentFolders,
    screenFolders,
    conventions,
    needsClarification,
    summary,
  }, null, 2) + '\n');
}

function stripForOutput(node) {
  return {
    path: node.path,
    kind: node.kind,
    depth: node.depth,
    files: node.files,
    children: node.children.map(stripForOutput),
  };
}

try { run(); }
catch (err) {
  process.stderr.write(`directory-tree: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
