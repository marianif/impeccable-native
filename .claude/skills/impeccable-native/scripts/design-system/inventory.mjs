#!/usr/bin/env node

/**
 * inventory.mjs
 *
 * Walks one or more component roots and produces a deterministic descriptive
 * map of every component file. **No judgment** is written here — judgment is
 * the model's job in Act 3. This script only extracts facts.
 *
 * Extraction is regex-based by design: fast, zero deps, predictable. It
 * accepts the resulting ~80% accuracy in exchange for shipping today; the
 * model can supplement from file contents when verdicts get tricky.
 *
 * Usage:
 *   node inventory.mjs [--dir=.] [--roots=src/components,src/ui] [--out=.impeccable/design-system/inventory.json] [--force]
 *
 * If --roots is omitted, the script reads roots from .impeccable/design-system/state.mjs
 * via a `STATE_ROOTS` export; if that isn't available either, it falls back to
 * running detect-layout.mjs and using the best match.
 *
 * Output schema (inventory.json):
 *   {
 *     generated_at: "...",
 *     tree_hashes: { "src/components": { hash, source, entry_count } },
 *     roots: [...],
 *     components: [
 *       {
 *         id, file, root, rel,
 *         exports: [{ name, kind: "default"|"named" }],
 *         props: [{ name, optional, type_text }],
 *         imports_components: [...],
 *         imported_by_count: number,
 *         kind_guess: "atom" | "molecule" | "organism" | "unknown",
 *         last_touched: "ISO date" | null
 *       }
 *     ]
 *   }
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { treeHash } from './tree-hash.mjs';

function flag(name) {
  const f = process.argv.slice(2).find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
}
function hasFlag(name) {
  return process.argv.slice(2).includes(`--${name}`);
}

const rootDir = path.resolve(flag('dir') ?? process.cwd());
const outPath = path.resolve(rootDir, flag('out') ?? '.impeccable/design-system/inventory.json');
const force = hasFlag('force');

const roots = await resolveRoots();
if (roots.length === 0) {
  process.stderr.write('inventory.mjs: no component roots resolved. Pass --roots=... or ensure detect-layout finds something.\n');
  process.exit(2);
}

// Skip work if cache is fresh and not forced.
if (!force && fs.existsSync(outPath)) {
  const cached = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  let stale = false;
  for (const root of roots) {
    const current = treeHash(root, { cwd: rootDir });
    if (current.hash !== cached.tree_hashes?.[root]?.hash) {
      stale = true;
      break;
    }
  }
  if (!stale) {
    process.stdout.write(JSON.stringify({ status: 'cache-fresh', path: path.relative(rootDir, outPath) }));
    process.exit(0);
  }
}

// 1. Collect candidate files across all roots.
const files = [];
for (const root of roots) {
  const abs = path.resolve(rootDir, root);
  walk(abs, abs, files, root);
}

// 2. First pass: extract per-file facts.
const components = [];
const idByAbsPath = new Map();
for (const f of files) {
  const rec = extractComponent(f, rootDir);
  if (!rec) continue;
  components.push(rec);
  idByAbsPath.set(f.abs, rec.id);
}

// 3. Second pass: resolve imports_components + imported_by_count.
const importedByCount = new Map();
for (const c of components) importedByCount.set(c.id, 0);

for (const c of components) {
  const resolved = [];
  for (const imp of c._raw_imports) {
    const target = resolveImport(imp, c._abs);
    if (target && idByAbsPath.has(target)) {
      const tid = idByAbsPath.get(target);
      if (tid !== c.id) {
        resolved.push(tid);
        importedByCount.set(tid, (importedByCount.get(tid) ?? 0) + 1);
      }
    }
  }
  c.imports_components = unique(resolved);
}
for (const c of components) {
  c.imported_by_count = importedByCount.get(c.id) ?? 0;
  delete c._raw_imports;
  delete c._abs;
}

// 4. Stamp tree-hashes per root and write.
const treeHashes = {};
for (const root of roots) {
  treeHashes[root] = treeHash(root, { cwd: rootDir });
}

const payload = {
  generated_at: new Date().toISOString(),
  roots,
  tree_hashes: treeHashes,
  components,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

process.stdout.write(JSON.stringify({
  status: 'written',
  path: path.relative(rootDir, outPath),
  component_count: components.length,
  roots,
}));

// -----------------------------------------------------------------------------

async function resolveRoots() {
  const flagRoots = flag('roots');
  if (flagRoots) return flagRoots.split(',').map(s => s.trim()).filter(Boolean);

  // Try the synthesized state.mjs (it may export STATE_ROOTS).
  const statePath = path.resolve(rootDir, '.impeccable/design-system/state.mjs');
  if (fs.existsSync(statePath)) {
    try {
      const mod = await import(statePath);
      if (Array.isArray(mod.STATE_ROOTS) && mod.STATE_ROOTS.length > 0) return mod.STATE_ROOTS;
    } catch {
      /* fall through */
    }
  }

  // Fall back to detect-layout.
  try {
    const detectScript = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'detect-layout.mjs');
    const out = execFileSync(process.execPath, [detectScript, `--dir=${rootDir}`], { encoding: 'utf8' });
    const parsed = JSON.parse(out);
    return parsed.roots ?? [];
  } catch {
    return [];
  }
}

function walk(rootAbs, dir, out, rootRel) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name.startsWith('.')) continue;
    if (e.name === '__tests__' || e.name === '__mocks__' || e.name === 'stories') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(rootAbs, full, out, rootRel);
    } else if (e.isFile() && /\.(tsx|jsx|ts|js)$/.test(e.name)) {
      if (/\.(test|spec|stories)\.[jt]sx?$/.test(e.name)) continue;
      if (/\.d\.ts$/.test(e.name)) continue;
      out.push({ abs: full, root: rootRel, rel: path.relative(rootAbs, full) });
    }
  }
}

function extractComponent(file, rootDir) {
  let src;
  try {
    src = fs.readFileSync(file.abs, 'utf8');
  } catch {
    return null;
  }

  // Quick reject: must mention React or return JSX-looking syntax.
  if (!/from\s+['"]react(-native)?['"]/.test(src) && !/<[A-Z][\w.]*[\s/>]/.test(src)) {
    return null;
  }

  const exports = extractExports(src);
  if (exports.length === 0) return null;

  const props = extractProps(src, exports);
  const rawImports = extractImports(src);
  const lastTouched = gitMtime(file.abs, rootDir);
  const id = makeId(file.root, file.rel);
  const kindGuess = guessKind(file.root, file.rel, src);

  return {
    id,
    file: path.relative(rootDir, file.abs),
    root: file.root,
    rel: file.rel,
    exports,
    props,
    kind_guess: kindGuess,
    last_touched: lastTouched,
    _abs: file.abs,           // used only by the second pass; deleted before write
    _raw_imports: rawImports, // resolved in second pass
    imports_components: [],
    imported_by_count: 0,
  };
}

// -----------------------------------------------------------------------------
// Regex-based extractors. Documented limits live next to each.
// -----------------------------------------------------------------------------

/**
 * Detects exported React components. Matches:
 *   export default function Foo(...) {}
 *   export default Foo                 (if Foo looks like a component name)
 *   export function Foo(...) {}
 *   export const Foo = (...) =>
 *   export const Foo = forwardRef(...)
 *   export const Foo = memo(...)
 *   export { Foo } / export { Foo as Bar }
 *
 * Skips lowercase identifiers (not components by React convention).
 */
function extractExports(src) {
  // A single identifier can be exported BOTH as a named export and as the
  // default — common React idiom (`export function Button(...)` followed by
  // `export default Button`). We track (name, kind) pairs, not name → kind.
  const found = new Set(); // key = `${name}::${kind}`
  const add = (name, kind) => found.add(`${name}::${kind}`);
  const isCompName = n => /^[A-Z][\w$]*$/.test(n);

  let m;
  // export default function Foo
  const reDefaultFn = /export\s+default\s+function\s+([A-Z][\w$]*)/g;
  while ((m = reDefaultFn.exec(src))) add(m[1], 'default');

  // export default ForwardedFoo  (bare identifier)
  const reDefaultIdent = /export\s+default\s+([A-Z][\w$]*)\s*;?\s*$/gm;
  while ((m = reDefaultIdent.exec(src))) add(m[1], 'default');

  // export function Foo
  const reFn = /export\s+function\s+([A-Z][\w$]*)/g;
  while ((m = reFn.exec(src))) add(m[1], 'named');

  // export const Foo = ... / export const Foo: FC<...> = ...
  const reConst = /export\s+(?:const|let|var)\s+([A-Z][\w$]*)\s*(?::[^=]*)?=/g;
  while ((m = reConst.exec(src))) add(m[1], 'named');

  // export { Foo, Bar as Baz }
  const reBrace = /export\s*\{\s*([^}]+)\s*\}/g;
  while ((m = reBrace.exec(src))) {
    for (const part of m[1].split(',')) {
      const seg = part.trim();
      const asMatch = seg.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      const name = asMatch ? asMatch[2] : seg.match(/^[A-Za-z_$][\w$]*$/)?.[0];
      if (name && isCompName(name)) add(name, 'named');
    }
  }

  return [...found].map(key => {
    const [name, kind] = key.split('::');
    return { name, kind };
  });
}

/**
 * Extracts props from TS interfaces/type aliases that look like component
 * props: their name matches /Props$/ and the file declares a component that
 * accepts them, OR the interface/type is named <ComponentName>Props for one
 * of the exported components.
 *
 * Limits: does not resolve `extends`, generics, or imported prop types.
 * Plain JS files yield no props; the model can read source if needed.
 */
function extractProps(src, exports) {
  const propsTypeNames = new Set();
  for (const e of exports) propsTypeNames.add(`${e.name}Props`);

  // Capture every PropsLike type/interface declaration. We use a small
  // balanced-brace scanner instead of a regex because prop types like
  // `onPress: () => void` contain braces that break naive matching, and
  // single-line declarations (`type FooProps = { a: string }`) do not have
  // a trailing newline before the closing brace.
  const declarations = [];

  const headerRe = /(?:export\s+)?(?:interface\s+(\w+Props)\s*(?:extends\s+[^{]+)?|type\s+(\w+Props)\s*=\s*)\{/g;
  let h;
  while ((h = headerRe.exec(src))) {
    const name = h[1] ?? h[2];
    const openIdx = headerRe.lastIndex - 1; // position of the opening `{`
    const closeIdx = findMatchingBrace(src, openIdx);
    if (closeIdx === -1) continue;
    const body = src.slice(openIdx + 1, closeIdx);
    declarations.push({ name, body });
    headerRe.lastIndex = closeIdx + 1;
  }

  // Prefer declarations whose name matches a known exported component; if none, take all.
  const matched = declarations.filter(d => propsTypeNames.has(d.name));
  const pool = matched.length > 0 ? matched : declarations;

  const props = [];
  const seen = new Set();
  for (const d of pool) {
    for (const member of splitMembers(d.body)) {
      // name[?]: type
      const lm = member.match(/^\s*(\w+)(\?)?\s*:\s*([\s\S]+?)\s*(?:\/\/.*)?$/);
      if (!lm) continue;
      const name = lm[1];
      if (seen.has(name)) continue;
      seen.add(name);
      props.push({ name, optional: Boolean(lm[2]), type_text: lm[3].trim() });
    }
  }
  return props;
}

/** Returns the index of the `}` matching the `{` at openIdx, or -1. */
function findMatchingBrace(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Splits a TS object-type body into member segments. Honors brace and angle-
 * bracket depth so `onPress: () => void;` and `data: { a: string; b: number }`
 * survive intact. Members are separated by `;` or `,` at depth zero.
 */
function splitMembers(body) {
  const members = [];
  let buf = '';
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '{' || ch === '(' || ch === '<' || ch === '[') depth++;
    else if (ch === '}' || ch === ')' || ch === '>' || ch === ']') depth--;
    if ((ch === ';' || ch === ',' || ch === '\n') && depth === 0) {
      if (buf.trim()) members.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) members.push(buf);
  return members;
}

function extractImports(src) {
  const imports = [];
  const re = /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) imports.push(m[1]);
  // Bare side-effect imports — `import './foo'`
  const reBare = /import\s+['"]([^'"]+)['"]/g;
  while ((m = reBare.exec(src))) imports.push(m[1]);
  return imports;
}

function resolveImport(spec, fromAbsFile) {
  // Only resolve relative paths — alias resolution is out of scope.
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromAbsFile), spec);
  const exts = ['.tsx', '.ts', '.jsx', '.js'];
  for (const ext of exts) {
    const candidate = base + ext;
    if (fs.existsSync(candidate)) return candidate;
  }
  for (const ext of exts) {
    const candidate = path.join(base, `index${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function makeId(root, rel) {
  const noExt = rel.replace(/\.(tsx|jsx|ts|js)$/, '');
  const slug = `${root}/${noExt}`.replace(/[^a-zA-Z0-9/_.-]/g, '-').replace(/\/+/g, '/');
  return slug;
}

/**
 * Heuristic atom/molecule/organism guess. Cheap, always overridable by the
 * model. Signals (cheap to compute):
 *   - folder name: 'atoms' / 'molecules' / 'organisms' under the root
 *   - element count in returned JSX (rough)
 *   - number of distinct component types referenced
 */
function guessKind(root, rel, src) {
  const lower = rel.toLowerCase();
  if (lower.includes('/atoms/') || lower.startsWith('atoms/')) return 'atom';
  if (lower.includes('/molecules/') || lower.startsWith('molecules/')) return 'molecule';
  if (lower.includes('/organisms/') || lower.startsWith('organisms/')) return 'organism';

  const jsxTags = src.match(/<[A-Z][\w.]*[\s/>]/g) ?? [];
  const distinctTypes = new Set(jsxTags.map(t => t.replace(/[<\s/>]/g, '')));
  const elementCount = (src.match(/<[a-zA-Z]/g) ?? []).length;

  if (elementCount <= 6 && distinctTypes.size <= 2) return 'atom';
  if (elementCount <= 20 && distinctTypes.size <= 5) return 'molecule';
  if (distinctTypes.size >= 4) return 'organism';
  return 'unknown';
}

function gitMtime(absFile, rootDir) {
  try {
    const iso = execFileSync(
      'git',
      ['log', '-1', '--format=%cI', '--', absFile],
      { cwd: rootDir, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' },
    ).trim();
    return iso || null;
  } catch {
    try {
      const stat = fs.statSync(absFile);
      return new Date(stat.mtimeMs).toISOString();
    } catch {
      return null;
    }
  }
}

function unique(arr) {
  return [...new Set(arr)];
}
