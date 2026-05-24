#!/usr/bin/env node

/**
 * component-inventory.mjs
 *
 * Walks a React Native codebase and maps every component file: name, path,
 * exported props surface, internal composition (which other components it
 * renders), usage count across the project, last-touched date, and a rough
 * kind heuristic (atom / molecule / organism / screen-fragment / unknown).
 *
 * This is the foundation of /design-system Act 1. Everything downstream
 * (duplication clustering, dead-code detection, composition-pattern harvest)
 * reads this output to avoid re-walking the tree.
 *
 * No external deps: a small regex-driven parser is sufficient for the
 * shapes we care about (function components, forwardRef, memo wrappers,
 * default & named exports, JSX root elements). Anything we can't parse
 * is reported as `parseConfidence: "low"` rather than dropped.
 *
 * Usage:
 *   node component-inventory.mjs [--dir=path] [--components-dir=components]
 *                                 [--screens-dir=screens,app]
 *
 *   --dir              Project root (default: cwd).
 *   --components-dir   Comma-separated dirs to treat as component homes
 *                      (default: components,src/components,app/components).
 *   --screens-dir      Comma-separated dirs to treat as screen homes for
 *                      usage counting (default: screens,app,src/screens).
 *
 * Output (stdout, JSON):
 *   {
 *     "components": [ ComponentEntry, ... ],
 *     "summary": { ... }
 *   }
 *
 * ComponentEntry shape — see TYPES block below.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

// ── args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function flag(name) {
  const f = args.find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
}
const rootDir = path.resolve(flag('dir') ?? process.cwd());
const treePath = flag('tree'); // path to directory-tree.json (auto-generated if absent)
const componentsDirs = (flag('components-dir') ?? 'components,src/components,app/components')
  .split(',').map(s => s.trim()).filter(Boolean);
const screensDirs = (flag('screens-dir') ?? 'screens,app,src/screens')
  .split(',').map(s => s.trim()).filter(Boolean);

// ── directory-tree loader ─────────────────────────────────────────────────

function loadDirectoryTree() {
  if (treePath) {
    try { return JSON.parse(fs.readFileSync(path.resolve(treePath), 'utf-8')); }
    catch (err) {
      process.stderr.write(`component-inventory: failed to load --tree=${treePath}: ${err.message}\n`);
      // fall through to auto-generate
    }
  }
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const treeScript = path.join(scriptDir, 'directory-tree.mjs');
  try {
    const out = execFileSync('node', [treeScript, `--dir=${rootDir}`], {
      stdio: ['ignore', 'pipe', 'inherit'],
      maxBuffer: 64 * 1024 * 1024,
    }).toString();
    return JSON.parse(out);
  } catch (err) {
    process.stderr.write(`component-inventory: directory-tree generation failed: ${err.message}\n`);
    return null;
  }
}

// Map a component-folder kind to the component-kind it implies.
const FOLDER_KIND_TO_COMPONENT_KIND = {
  'atoms-folder':     'atom',
  'molecules-folder': 'molecule',
  'organisms-folder': 'organism',
  'templates-folder': 'template',
  'pages-folder':     'page',
};

/**
 * Given a file's relative path and the directory tree, find the most-specific
 * folder kind that contains it, then map that to a component kind.
 * Returns null if no path-based kind can be derived (e.g. flat layout, no
 * atomic-design folders).
 */
function kindFromTree(relFile, tree) {
  if (!tree?.componentFolders?.length) return null;
  // Find the deepest folder whose path is a prefix of relFile.
  let bestMatch = null;
  for (const folder of tree.componentFolders) {
    const folderPath = folder.path;
    if (relFile === folderPath || relFile.startsWith(folderPath + '/') || relFile.startsWith(folderPath + path.sep)) {
      if (!bestMatch || folder.path.length > bestMatch.path.length) bestMatch = folder;
    }
  }
  if (!bestMatch) return null;
  // Walk up: if the leaf is a `component-folder`, look at its parent for the
  // atomic-design kind.
  if (bestMatch.kind === 'component-folder') {
    const parentPath = path.dirname(bestMatch.path);
    const parent = tree.componentFolders.find(f => f.path === parentPath);
    if (parent && FOLDER_KIND_TO_COMPONENT_KIND[parent.kind]) {
      return { kind: FOLDER_KIND_TO_COMPONENT_KIND[parent.kind], source: 'path', folder: bestMatch.path };
    }
  }
  if (FOLDER_KIND_TO_COMPONENT_KIND[bestMatch.kind]) {
    return { kind: FOLDER_KIND_TO_COMPONENT_KIND[bestMatch.kind], source: 'path', folder: bestMatch.path };
  }
  return null;
}

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.expo', '.metro-cache',
  'android', 'ios', '__generated__', 'coverage', '.impeccable', '.next',
]);

// RN built-ins and common library components — these don't count as "internal
// composition" because they're not part of this app's design system.
const RN_BUILTINS = new Set([
  'View', 'Text', 'ScrollView', 'FlatList', 'SectionList', 'VirtualizedList',
  'Image', 'ImageBackground', 'TextInput', 'TouchableOpacity', 'TouchableHighlight',
  'TouchableWithoutFeedback', 'Pressable', 'Button', 'Switch', 'Modal',
  'ActivityIndicator', 'RefreshControl', 'SafeAreaView', 'KeyboardAvoidingView',
  'StatusBar', 'Animated', 'Fragment', 'Suspense',
  // Common 3rd-party but not design-system-internal
  'LinearGradient', 'BlurView', 'SvgXml', 'Svg', 'Path', 'Circle', 'Rect',
  'GestureDetector', 'GestureHandlerRootView', 'BottomSheet',
]);

// ── filesystem walk ───────────────────────────────────────────────────────

function collectFiles(dir, predicate, results = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, predicate, results);
    else if (predicate(full)) results.push(full);
  }
  return results;
}

const isSourceFile = f => /\.(tsx?|jsx?)$/.test(f) && !/\.d\.ts$/.test(f);
const isTestFile = f => /\.(test|spec)\.(tsx?|jsx?)$/.test(f) || /__tests__/.test(f);
const isStoryFile = f => /\.stories\.(tsx?|jsx?)$/.test(f);

function existingDirs(roots) {
  return roots
    .map(r => path.join(rootDir, r))
    .filter(p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } });
}

// ── component detection ───────────────────────────────────────────────────

/**
 * Find component declarations in a source file. A "component" is:
 *  - a function/const that is exported (default or named)
 *  - whose name starts with an uppercase letter
 *  - whose body returns JSX (heuristic: contains `<Capitalized` or `<>`)
 *
 * We also detect `React.forwardRef(...)` and `React.memo(...)` wrappers.
 *
 * Returns an array of { name, kind: 'function'|'forwardRef'|'memo'|'class',
 * exportKind: 'default'|'named', startIndex, endIndex (approx) }.
 */
function detectComponents(source) {
  const components = [];
  const seenNames = new Set();

  // const Name = (...) => ... | function Name(...) { ... } | class Name extends ...
  // We collect candidates then filter by JSX-return heuristic.
  const candidateRe = /(?:export\s+(default\s+)?)?(?:const|let|var|function|class)\s+([A-Z][A-Za-z0-9_]*)/g;
  const exportNamedRe = /export\s*\{\s*([^}]+)\s*\}/g;
  const exportedNames = new Set();
  for (const m of source.matchAll(exportNamedRe)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (/^[A-Z]/.test(name)) exportedNames.add(name);
    }
  }

  // Track which names are exported via `export default <Name>` at end of file
  const defaultExportRe = /export\s+default\s+([A-Z][A-Za-z0-9_]*)\s*;?\s*$/m;
  const defaultExportMatch = source.match(defaultExportRe);
  const defaultExportedName = defaultExportMatch ? defaultExportMatch[1] : null;

  for (const m of source.matchAll(candidateRe)) {
    const isInlineExport = !!m[0].match(/^export\s/);
    const isDefault = !!m[1];
    const name = m[2];
    if (seenNames.has(name)) continue;
    seenNames.add(name);

    const startIndex = m.index;
    // Look at the next ~1500 chars to decide if it returns JSX
    const window = source.slice(startIndex, startIndex + 1500);

    let kind = 'function';
    if (/=\s*(?:React\.)?forwardRef\s*[<(]/.test(window)) kind = 'forwardRef';
    else if (/=\s*(?:React\.)?memo\s*[<(]/.test(window)) kind = 'memo';
    else if (/^class\s/.test(m[0])) kind = 'class';

    const returnsJsx =
      /return\s*\(\s*</.test(window) ||
      /return\s*</.test(window) ||
      /=>\s*</.test(window) ||
      /=>\s*\(\s*</.test(window);

    if (!returnsJsx && kind !== 'class') continue;

    const exported = isInlineExport || exportedNames.has(name) || defaultExportedName === name;
    if (!exported) continue;

    const exportKind = (isInlineExport && isDefault) || defaultExportedName === name
      ? 'default'
      : 'named';

    components.push({ name, kind, exportKind, startIndex });
  }

  return components;
}

/**
 * Extract the props surface for a component, given its starting index in source.
 * Handles:
 *   - inline destructured: ({ foo, bar = 1, baz }: Props) => ...
 *   - typed param:         (props: ButtonProps) => ...    (then look up ButtonProps)
 *   - forwardRef<Ref, Props>: pull from generic args
 *
 * Returns { props: [{name, hasDefault, optional}], propsTypeName: string|null,
 * parseConfidence: 'high'|'medium'|'low' }.
 */
function extractProps(source, comp) {
  const slice = source.slice(comp.startIndex, comp.startIndex + 2000);

  // 1. forwardRef<Ref, Props>
  const forwardRefGeneric = slice.match(/forwardRef\s*<\s*[^,>]+,\s*([A-Za-z_][A-Za-z0-9_]*)\s*>/);

  // 2. Inline destructured params
  //    Matches things like:  function Foo({ a, b = 1, c }: FooProps)
  //                          const Foo = ({ a, b }: FooProps) =>
  //                          const Foo = memo(({ a }: FooProps) =>
  const destructuredRe = /\(\s*\{([^}]+)\}\s*(?::\s*([A-Za-z_][A-Za-z0-9_]*))?\s*\)/;
  const dm = slice.match(destructuredRe);

  // 3. Typed single param:  (props: FooProps)
  const typedParamRe = /\(\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/;
  const tm = slice.match(typedParamRe);

  let propsTypeName = forwardRefGeneric?.[1] ?? dm?.[2] ?? tm?.[1] ?? null;
  let props = [];
  let parseConfidence = 'low';

  if (dm) {
    parseConfidence = 'medium';
    const inside = dm[1];
    // Naive split on commas at depth 0
    const parts = splitTopLevel(inside, ',');
    for (const rawPart of parts) {
      const part = rawPart.trim();
      if (!part) continue;
      // Skip rest (...rest) — represent as a single "rest" marker
      if (part.startsWith('...')) {
        props.push({ name: part.replace(/^\.\.\./, '').trim() || '_rest', rest: true });
        continue;
      }
      // foo: renamed = default
      const eqIdx = indexOfTopLevel(part, '=');
      let lhs = eqIdx >= 0 ? part.slice(0, eqIdx).trim() : part;
      const hasDefault = eqIdx >= 0;
      // strip "foo: renamed" → name is foo (the property key, not the local alias)
      const colonIdx = indexOfTopLevel(lhs, ':');
      const name = (colonIdx >= 0 ? lhs.slice(0, colonIdx) : lhs).trim();
      if (!name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;
      props.push({ name, hasDefault });
    }
  }

  // If we have a propsTypeName, try to enrich from the type definition in this file.
  if (propsTypeName) {
    const typeBody = findTypeBody(source, propsTypeName);
    if (typeBody) {
      const fromType = parseTypeBody(typeBody);
      if (fromType.length) {
        parseConfidence = props.length ? 'high' : 'medium';
        // Merge: prefer destructured names for hasDefault truth, take optional from type.
        const byName = new Map(props.map(p => [p.name, p]));
        for (const t of fromType) {
          const existing = byName.get(t.name);
          if (existing) {
            existing.optional = t.optional;
          } else {
            byName.set(t.name, { name: t.name, optional: t.optional });
          }
        }
        props = [...byName.values()];
      }
    }
  }

  return { props, propsTypeName, parseConfidence };
}

function splitTopLevel(s, sep) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '{' || c === '(' || c === '[' || c === '<') depth++;
    else if (c === '}' || c === ')' || c === ']' || c === '>') depth--;
    else if (c === sep && depth === 0) { out.push(s.slice(start, i)); start = i + 1; }
  }
  out.push(s.slice(start));
  return out;
}

function indexOfTopLevel(s, ch) {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '{' || c === '(' || c === '[' || c === '<') depth++;
    else if (c === '}' || c === ')' || c === ']' || c === '>') depth--;
    else if (c === ch && depth === 0) return i;
  }
  return -1;
}

/**
 * Find the body of `type Name = { ... }` or `interface Name { ... }` and
 * return the inside-braces text, or null.
 */
function findTypeBody(source, typeName) {
  const typeAlias = new RegExp(`\\btype\\s+${typeName}\\s*=\\s*\\{`);
  const iface = new RegExp(`\\binterface\\s+${typeName}\\b[^{]*\\{`);
  const m = source.match(typeAlias) ?? source.match(iface);
  if (!m) return null;
  const openIdx = source.indexOf('{', m.index);
  if (openIdx < 0) return null;
  let depth = 1;
  for (let i = openIdx + 1; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(openIdx + 1, i);
    }
  }
  return null;
}

/**
 * Parse a type body into [{name, optional}, ...]. Splits on top-level
 * semicolons or newlines (not commas — those are common inside type unions).
 */
function parseTypeBody(body) {
  const props = [];
  // Normalize: turn line-terminating commas into semicolons
  const normalized = body.replace(/,\s*$/gm, ';');
  // Split on top-level semicolons
  const parts = splitTopLevel(normalized, ';');
  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part || part.startsWith('//') || part.startsWith('/*')) continue;
    // Match:  name?: type      readonly name: type      'string-key': type
    const m = part.match(/^(?:readonly\s+)?(?:'([^']+)'|"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))\s*(\?)?\s*:/);
    if (!m) continue;
    const name = m[1] ?? m[2] ?? m[3];
    const optional = !!m[4];
    props.push({ name, optional });
  }
  return props;
}

// ── internal composition (which other components are rendered) ────────────

/**
 * Find capitalized JSX tags in a source file. Excludes RN built-ins and
 * common library tags. Returns Set<string> of component names referenced.
 */
function extractRenderedComponents(source) {
  const tagRe = /<([A-Z][A-Za-z0-9_]*)\b/g;
  const seen = new Set();
  for (const m of source.matchAll(tagRe)) {
    const name = m[1];
    if (RN_BUILTINS.has(name)) continue;
    seen.add(name);
  }
  return seen;
}

/**
 * Find local import names that resolve into the project (relative paths or
 * configured aliases like @/components/...). Returns Map<localName, sourceSpec>.
 */
function extractLocalImports(source) {
  const importRe = /import\s+(?:type\s+)?(?:(\*\s+as\s+[A-Za-z_$][\w$]*)|(\{[^}]+\})|([A-Za-z_$][\w$]*))?(?:\s*,\s*(\{[^}]+\}))?\s+from\s+['"]([^'"]+)['"]/g;
  const out = new Map();
  for (const m of source.matchAll(importRe)) {
    const spec = m[5];
    const isLocal = spec.startsWith('.') || spec.startsWith('@/') || spec.startsWith('~/') || spec.startsWith('src/');
    if (!isLocal) continue;
    const def = m[3];
    const named1 = m[2];
    const named2 = m[4];
    if (def) out.set(def, spec);
    for (const group of [named1, named2]) {
      if (!group) continue;
      const inside = group.slice(1, -1);
      for (const part of inside.split(',')) {
        const piece = part.trim();
        if (!piece) continue;
        const asMatch = piece.match(/^(?:type\s+)?([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
        if (asMatch) out.set(asMatch[2] ?? asMatch[1], spec);
      }
    }
  }
  return out;
}

// ── git last-touched ──────────────────────────────────────────────────────

function gitLastTouched(filePath) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', filePath], {
      cwd: rootDir, stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
    return out || null;
  } catch { return null; }
}

// ── kind heuristic ────────────────────────────────────────────────────────

/**
 * Structural kind heuristic. Fallback only — when the directory tree gives
 * us a path-based kind, that wins, because folder placement is stated intent.
 *
 *   atom            — no internal composition, ≤6 props, single root tag
 *                     (raised from 4 — typed wrappers like Text commonly carry
 *                     5–6 style-shaping props and are still atoms)
 *   molecule        — composes 1–3 internal components, OR ≥7 props
 *   organism        — composes ≥4 internal components OR has state hooks + composition
 *   screen-fragment — file lives under a screens dir
 *   unknown         — couldn't decide
 */
function guessKindStructural({ internalComponentCount, propsCount, hasStateHook, isUnderScreensDir, rendersOnlyBuiltins }) {
  if (isUnderScreensDir) return 'screen-fragment';
  if (internalComponentCount === 0 && propsCount <= 6) return 'atom';
  // Wrapper-around-a-single-primitive escape: if a component renders only RN
  // built-ins (no internal composition) it's an atom regardless of prop count.
  if (internalComponentCount === 0 && rendersOnlyBuiltins) return 'atom';
  if (internalComponentCount >= 4) return 'organism';
  if (hasStateHook && internalComponentCount >= 2) return 'organism';
  if (internalComponentCount >= 1 || propsCount >= 7) return 'molecule';
  return 'unknown';
}

// ── usage counting ────────────────────────────────────────────────────────

/**
 * Build a map componentName → array of { file, line } where it appears as
 * a JSX tag, scanned across all non-test source files in the project.
 * Definitions in the component's own file are excluded.
 */
function buildUsageIndex(allFiles, componentNames) {
  const index = new Map();
  for (const name of componentNames) index.set(name, []);
  const tagRe = new RegExp(`<(${[...componentNames].join('|')})\\b`, 'g');
  if (componentNames.size === 0) return index;

  for (const filePath of allFiles) {
    if (isTestFile(filePath) || isStoryFile(filePath)) continue;
    let source;
    try { source = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }
    if (!source.includes('<')) continue;
    const rel = path.relative(rootDir, filePath);
    tagRe.lastIndex = 0;
    for (const m of source.matchAll(tagRe)) {
      const name = m[1];
      const line = source.slice(0, m.index).split('\n').length;
      index.get(name).push({ file: rel, line });
    }
  }
  return index;
}

// ── main ──────────────────────────────────────────────────────────────────

function run() {
  // Load the directory tree first — it's the source of truth for which folders
  // hold components and what kind they are.
  const tree = loadDirectoryTree();

  // Derive component roots from the tree if it has any; otherwise fall back
  // to the --components-dir defaults.
  let componentRootsAbs;
  if (tree?.roots?.components?.length > 0) {
    componentRootsAbs = tree.roots.components.map(p => path.join(rootDir, p));
  } else {
    componentRootsAbs = existingDirs(componentsDirs);
  }
  // Screens: prefer the tree too, then fall back.
  const screenRootsAbs = (tree?.roots?.screens?.length > 0)
    ? tree.roots.screens.map(p => path.join(rootDir, p))
    : existingDirs(screensDirs);

  // Component files: anything under componentRootsAbs that defines an exported component.
  const componentFiles = new Set();
  for (const root of componentRootsAbs) {
    for (const f of collectFiles(root, isSourceFile)) {
      if (!isTestFile(f) && !isStoryFile(f)) componentFiles.add(f);
    }
  }

  // All source files: needed for usage counts.
  const allFiles = collectFiles(rootDir, isSourceFile);

  const screenPaths = new Set(screenRootsAbs.map(r => path.relative(rootDir, r)));
  function isUnderScreensDir(rel) {
    for (const s of screenPaths) if (rel === s || rel.startsWith(s + path.sep)) return true;
    return false;
  }

  // Pass 1: detect components, props, internal composition.
  const partials = [];
  const allComponentNames = new Set();
  // Track which leaf component-folders actually yielded components, so we can
  // surface "folder exists but scanner found nothing" gaps later.
  const componentsByFolder = new Map();

  for (const filePath of componentFiles) {
    let source;
    try { source = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }
    const rel = path.relative(rootDir, filePath);
    const detected = detectComponents(source);
    if (detected.length === 0) continue;

    const localImports = extractLocalImports(source);
    const rendered = extractRenderedComponents(source);
    // Only count rendered tags whose name was imported locally (i.e. internal
    // to the design system), to avoid counting random capitalized identifiers.
    const internalRendered = [...rendered].filter(n => localImports.has(n));
    const hasStateHook = /\b(useState|useReducer|useRef|useEffect|useLayoutEffect)\b/.test(source);
    // Did this file render any non-builtin tags at all? Used for the
    // single-primitive-wrapper escape in the structural heuristic.
    const rendersOnlyBuiltins = rendered.size > 0 && internalRendered.length === 0;

    for (const comp of detected) {
      const { props, propsTypeName, parseConfidence } = extractProps(source, comp);

      const kindStructural = guessKindStructural({
        internalComponentCount: internalRendered.length,
        propsCount: props.length,
        hasStateHook,
        isUnderScreensDir: isUnderScreensDir(rel),
        rendersOnlyBuiltins,
      });

      const pathKind = kindFromTree(rel, tree);

      let kindGuess, kindSource;
      if (pathKind) {
        kindGuess = pathKind.kind;
        kindSource = 'path';
      } else {
        kindGuess = kindStructural;
        kindSource = 'structural';
      }
      const kindConflict = pathKind != null && pathKind.kind !== kindStructural && kindStructural !== 'unknown';

      const entry = {
        name: comp.name,
        file: rel,
        exportKind: comp.exportKind,
        wrapper: comp.kind === 'function' ? null : comp.kind,
        props,
        propsTypeName,
        parseConfidence,
        renders: internalRendered,
        rendersOnlyBuiltins,
        hasStateHook,
        kindGuess,
        kindSource,
        kindStructural,
        kindConflict,
        folderKind: pathKind?.folder ?? null,
        lastTouched: gitLastTouched(filePath),
      };
      partials.push(entry);
      allComponentNames.add(comp.name);
      if (pathKind?.folder) {
        if (!componentsByFolder.has(pathKind.folder)) componentsByFolder.set(pathKind.folder, []);
        componentsByFolder.get(pathKind.folder).push(comp.name);
      }
    }
  }

  // Pass 2: usage counts across the project (excluding the file each component
  // is defined in, so a component that's only used by itself counts as 0).
  const usageIndex = buildUsageIndex(allFiles, allComponentNames);
  const components = partials.map(p => {
    const sites = (usageIndex.get(p.name) ?? []).filter(s => s.file !== p.file);
    return {
      ...p,
      usageCount: sites.length,
      usageSites: sites.slice(0, 20), // cap to keep output small; total is usageCount
      usageSitesTruncated: sites.length > 20,
    };
  });

  // Sort: most-used first, then by name.
  components.sort((a, b) => (b.usageCount - a.usageCount) || a.name.localeCompare(b.name));

  const byKind = components.reduce((acc, c) => {
    acc[c.kindGuess] = (acc[c.kindGuess] ?? 0) + 1;
    return acc;
  }, {});
  const bySource = components.reduce((acc, c) => {
    acc[c.kindSource] = (acc[c.kindSource] ?? 0) + 1;
    return acc;
  }, {});

  // Surface folder-vs-scanner gaps. If the tree says a component-folder
  // exists but the scanner found 0 components in it, that's a parser miss
  // (re-export from a barrel, wrapper chain we didn't detect, etc.).
  const missingComponentFolders = [];
  if (tree?.componentFolders) {
    for (const folder of tree.componentFolders) {
      if (!folder.isLeaf) continue;
      if (folder.sourceFileCount === 0 && folder.barrelFileCount === 0) continue;
      const found = componentsByFolder.get(folder.path) ?? [];
      if (found.length === 0) {
        missingComponentFolders.push({
          path: folder.path,
          kind: folder.kind,
          sourceFileCount: folder.sourceFileCount,
          barrelFileCount: folder.barrelFileCount,
          reason: 'Folder contains source/barrel files but no exported component was detected. Likely a re-export pattern, an unsupported wrapper chain (e.g. memo(forwardRef(...))), or a non-component utility module.',
        });
      }
    }
  }

  const result = {
    components,
    missingComponentFolders,
    summary: {
      rootDir,
      treeSource: tree ? 'directory-tree' : 'fallback-components-dir',
      componentRoots: componentRootsAbs.map(r => path.relative(rootDir, r)),
      screenRoots: screenRootsAbs.map(r => path.relative(rootDir, r)),
      componentFilesScanned: componentFiles.size,
      totalSourceFiles: allFiles.length,
      componentCount: components.length,
      byKindGuess: byKind,
      byKindSource: bySource,
      kindConflicts: components.filter(c => c.kindConflict).length,
      missingComponentFolders: missingComponentFolders.length,
      zeroUsage: components.filter(c => c.usageCount === 0).length,
      lowParseConfidence: components.filter(c => c.parseConfidence === 'low').length,
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

try { run(); }
catch (err) {
  process.stderr.write(`component-inventory: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
