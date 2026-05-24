#!/usr/bin/env node

/**
 * token-graph.mjs
 *
 * Builds the token × file co-occurrence graph for the migration scope, then
 * clusters tokens that must migrate together using Jaccard similarity +
 * connected-components.
 *
 * Usage:
 *   node token-graph.mjs --scope=<scope-json> [--dir=path] [--tau=0.5]
 *
 *   --scope-file=path   Path to migration-scope.mjs output JSON
 *   --dir=path          Project root (default: cwd)
 *   --tau=0.5           Similarity threshold for clustering (0–1)
 *
 * Output (stdout, JSON):
 *   {
 *     "tokens":   { "<name>": { definedIn, value, consumerCount, consumersInScope, consumersOutOfScope, cluster } },
 *     "clusters": [ { id, tokens, strength, rationale, mustMigrateTogether } ],
 *     "matrix":   [ [token, file, count], ... ],        // sparse, for debugging
 *     "unreferencedInScope": [ "colors.scrim", ... ],
 *     "summary":  { tokenCount, clusterCount, megacluster, chosenTau }
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
const scopeFilePath = flag('scope-file');
const tauArg = parseFloat(flag('tau') ?? '0.5');

// ── load scope ─────────────────────────────────────────────────────────────

function loadScope() {
  if (scopeFilePath) {
    return JSON.parse(fs.readFileSync(path.resolve(scopeFilePath), 'utf-8'));
  }
  const cached = path.join(rootDir, '.impeccable', 'migration-scope.json');
  if (fs.existsSync(cached)) return JSON.parse(fs.readFileSync(cached, 'utf-8'));
  return null;
}

// ── file collection ────────────────────────────────────────────────────────

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

// ── token definition detection ─────────────────────────────────────────────

const TOKEN_FILE_RE = /(^|[./-])(tokens|theme|themes|colors|palette|design-?system|design-?tokens)\.(tsx?|jsx?)$/i;
const TOKEN_EXPORT_RE = /export\s+(?:const|default|let|var)\s+([A-Za-z_$][\w$]*)\s*[:=]/g;
const TOKEN_VALUE_RE = /:\s*['"]([^'"]+)['"]/;

function findTokenDefinitions(files) {
  const defs = new Map(); // tokenKey -> { definedIn, value }
  for (const filePath of files) {
    if (!TOKEN_FILE_RE.test(path.basename(filePath))) continue;
    let source;
    try { source = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }
    const rel = path.relative(rootDir, filePath);
    const lines = source.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Look for object property patterns: key: 'value' or key: "#hex"
      const propMatch = line.match(/^\s{2,}(\w+)\s*:\s*['"]([^'"]+)['"]/);
      if (propMatch) {
        const [, key, val] = propMatch;
        // Infer the object name from context (look backwards for the export)
        let objectName = 'tokens';
        for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
          const m = lines[j].match(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[=:]/);
          if (m) { objectName = m[1]; break; }
        }
        defs.set(`${objectName}.${key}`, { definedIn: `${rel}:${i + 1}`, value: val });
      }
    }
  }
  return defs;
}

// ── token reference extraction ─────────────────────────────────────────────

// Captures: tokens.color.accent, theme.spacing.lg, colors.primary, t.color.bg
const TOKEN_REF_RE = /\b(tokens?|theme|colors?|palette|t|styles?)\.([\w$]+)/g;

function extractTokenRefs(source) {
  const refs = new Map(); // tokenKey -> count
  TOKEN_REF_RE.lastIndex = 0;
  for (const m of source.matchAll(TOKEN_REF_RE)) {
    const key = `${m[1]}.${m[2]}`;
    refs.set(key, (refs.get(key) ?? 0) + 1);
  }
  return refs;
}

// ── build token × file matrix ──────────────────────────────────────────────

function buildMatrix(scopeFiles, allFiles, tokenDefs) {
  // matrix: tokenKey -> { inScope: Map<relFile, count>, outOfScope: Map<relFile, count> }
  const matrix = new Map();
  const scopeSet = new Set(scopeFiles.map(f => path.resolve(rootDir, f)));

  // Initialise from known token definitions
  for (const key of tokenDefs.keys()) matrix.set(key, { inScope: new Map(), outOfScope: new Map() });

  for (const filePath of allFiles) {
    let source;
    try { source = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }
    const rel = path.relative(rootDir, filePath);
    const refs = extractTokenRefs(source);
    const inScope = scopeSet.has(path.resolve(filePath));

    for (const [key, count] of refs) {
      if (!matrix.has(key)) matrix.set(key, { inScope: new Map(), outOfScope: new Map() });
      const slot = inScope ? matrix.get(key).inScope : matrix.get(key).outOfScope;
      slot.set(rel, (slot.get(rel) ?? 0) + count);
    }
  }
  return matrix;
}

// ── Jaccard similarity ─────────────────────────────────────────────────────

function jaccardSimilarity(filesA, filesB) {
  let intersection = 0;
  for (const f of filesA) if (filesB.has(f)) intersection++;
  const union = new Set([...filesA, ...filesB]).size;
  return union === 0 ? 0 : intersection / union;
}

// Naming-based bonus: onX / primary+onPrimary / same-prefix families
function namingBonus(keyA, keyB) {
  const a = keyA.split('.').pop() ?? '';
  const b = keyB.split('.').pop() ?? '';
  // Exact semantic pair: primary / onPrimary, surface / onSurface
  if (b === 'on' + a[0].toUpperCase() + a.slice(1)) return 0.20;
  if (a === 'on' + b[0].toUpperCase() + b.slice(1)) return 0.20;
  // Same prefix (primaryDark, primaryLight, primaryVariant)
  const prefixLen = Math.min(a.length, b.length);
  for (let i = 4; i <= prefixLen; i++) {
    if (a.slice(0, i) === b.slice(0, i)) return 0.15;
  }
  return 0;
}

// ── connected components (union-find) ─────────────────────────────────────

function connectedComponents(nodes, edgePredicate) {
  const parent = new Map(nodes.map(n => [n, n]));
  function find(x) {
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)));
    return parent.get(x);
  }
  function union(x, y) { parent.set(find(x), find(y)); }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (edgePredicate(nodes[i], nodes[j])) union(nodes[i], nodes[j]);
    }
  }

  const components = new Map();
  for (const n of nodes) {
    const root = find(n);
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(n);
  }
  return [...components.values()];
}

// ── cluster quality ────────────────────────────────────────────────────────

function clusterStrength(tokens, matrix) {
  if (tokens.length < 2) return 1.0;
  let total = 0, count = 0;
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const filesA = new Set([
        ...matrix.get(tokens[i])?.inScope.keys() ?? [],
        ...matrix.get(tokens[i])?.outOfScope.keys() ?? [],
      ]);
      const filesB = new Set([
        ...matrix.get(tokens[j])?.inScope.keys() ?? [],
        ...matrix.get(tokens[j])?.outOfScope.keys() ?? [],
      ]);
      total += jaccardSimilarity(filesA, filesB) + namingBonus(tokens[i], tokens[j]);
      count++;
    }
  }
  return Math.min(1.0, total / count);
}

function clusterTopFiles(tokens, matrix) {
  const fileCounts = new Map();
  for (const tok of tokens) {
    for (const [f] of matrix.get(tok)?.inScope ?? []) fileCounts.set(f, (fileCounts.get(f) ?? 0) + 1);
  }
  return [...fileCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([f]) => f);
}

// ── megacluster detection ──────────────────────────────────────────────────

function computeClusters(tokens, matrix, tau) {
  const filesOf = tok => new Set([
    ...matrix.get(tok)?.inScope.keys() ?? [],
    ...matrix.get(tok)?.outOfScope.keys() ?? [],
  ]);

  const components = connectedComponents(tokens, (a, b) => {
    const raw = jaccardSimilarity(filesOf(a), filesOf(b));
    const score = Math.min(1.0, raw + namingBonus(a, b));
    return score >= tau;
  });

  const largest = Math.max(...components.map(c => c.length));
  if (largest > tokens.length * 0.5 && tau < 0.8) {
    // Megacluster detected — raise tau and recompute
    return { clusters: computeClusters(tokens, matrix, Math.min(tau + 0.1, 0.8)).clusters, chosenTau: tau + 0.1, megacluster: true };
  }

  const clusters = components.map((members, i) => {
    const strength = clusterStrength(members, matrix);
    const topFiles = clusterTopFiles(members, matrix);
    const reasons = [];
    if (topFiles.length > 0) reasons.push(`Co-occur in ${topFiles.length}+ files`);
    const pairs = members.filter((m, idx) =>
      members.some((n, jdx) => jdx !== idx && namingBonus(m, n) >= 0.15)
    );
    if (pairs.length > 0) reasons.push(`naming convention pairs detected`);

    return {
      id: `cluster-${i + 1}`,
      tokens: members.sort(),
      strength: Math.round(strength * 100) / 100,
      rationale: reasons.join('; ') || 'usage pattern similarity',
      topCoOccurringFiles: topFiles,
      mustMigrateTogether: strength >= 0.6 && members.length > 1,
    };
  });

  return { clusters, chosenTau: tau, megacluster: false };
}

// ── main ───────────────────────────────────────────────────────────────────

function run() {
  const scopeData = loadScope();
  if (!scopeData) {
    process.stderr.write(
      'token-graph: no scope data found.\n' +
      '  Run migration-scope.mjs first, or pass --scope-file=path.\n'
    );
    process.exit(1);
  }

  const scopeFiles = [
    ...(scopeData.screens?.map(s => s.file) ?? []),
    ...(scopeData.components ?? []),
  ];

  const allFiles = collectFiles(rootDir);
  const tokenDefs = findTokenDefinitions(allFiles);
  const matrix = buildMatrix(scopeFiles, allFiles, tokenDefs);

  // Identify tokens referenced in scope
  const scopeSet = new Set(scopeFiles.map(f => path.resolve(rootDir, f)));
  const tokensInScope = new Set();
  const tokensOutOfScope = new Set();

  for (const [tok, { inScope, outOfScope }] of matrix) {
    if (inScope.size > 0) tokensInScope.add(tok);
    else if (outOfScope.size > 0) tokensOutOfScope.add(tok);
  }

  const unreferencedInScope = [...tokensOutOfScope].filter(t => !tokensInScope.has(t));
  const activeTokens = [...tokensInScope];

  const { clusters, chosenTau, megacluster } = computeClusters(activeTokens, matrix, tauArg);

  // Build per-token assignment
  const clusterOf = new Map();
  for (const c of clusters) for (const t of c.tokens) clusterOf.set(t, c.id);

  const tokens = {};
  for (const tok of activeTokens) {
    const def = tokenDefs.get(tok);
    const entry = matrix.get(tok);
    const inScopeFiles = [...(entry?.inScope.keys() ?? [])];
    const outOfScopeFiles = [...(entry?.outOfScope.keys() ?? [])];
    tokens[tok] = {
      definedIn: def?.definedIn ?? null,
      value: def?.value ?? null,
      consumerCount: inScopeFiles.length + outOfScopeFiles.length,
      consumersInScope: inScopeFiles,
      consumersOutOfScope: outOfScopeFiles.slice(0, 10),
      outOfScopeTotal: outOfScopeFiles.length,
      cluster: clusterOf.get(tok) ?? null,
    };
  }

  // Sparse matrix for debugging (top 200 entries by count)
  const sparseMatrix = [];
  for (const [tok, { inScope }] of matrix) {
    for (const [file, count] of inScope) sparseMatrix.push([tok, file, count]);
  }
  sparseMatrix.sort((a, b) => b[2] - a[2]);

  const result = {
    tokens,
    clusters,
    sparseMatrix: sparseMatrix.slice(0, 200),
    unreferencedInScope,
    summary: {
      tokenCount: activeTokens.length,
      clusterCount: clusters.length,
      megacluster,
      chosenTau,
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

try {
  run();
} catch (err) {
  process.stderr.write(`token-graph: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
