#!/usr/bin/env node

/**
 * dependency-order.mjs
 *
 * Builds an import DAG over the migration scope, detects cycles via Tarjan's
 * SCC algorithm, classifies each cycle (shared-type | barrel | genuine), and
 * emits a topologically-sorted phase plan with deterministic ordering.
 *
 * Usage:
 *   node dependency-order.mjs [--scope-file=path] [--dir=path]
 *
 * Output (stdout, JSON):
 *   {
 *     "graph":   { "<file>": ["dep1", "dep2", ...] },
 *     "cycles":  [ { id, kind, members, evidence, autoFix, blocksPhase } ],
 *     "phases":  [ { phase, kind, files, rationale } ],
 *     "summary": { fileCount, cycleCount, blockingCycles, phaseCount }
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

// ── scope loading ──────────────────────────────────────────────────────────

function loadScope() {
  if (scopeFilePath) return JSON.parse(fs.readFileSync(path.resolve(scopeFilePath), 'utf-8'));
  const cached = path.join(rootDir, '.impeccable', 'migration-scope.json');
  if (fs.existsSync(cached)) return JSON.parse(fs.readFileSync(cached, 'utf-8'));
  return null;
}

// ── hop-distance data (from scope) ────────────────────────────────────────

function buildHopMap(scopeData) {
  const map = new Map();
  for (const s of scopeData.screens ?? []) {
    if (s.hopDistance != null) map.set(s.file, s.hopDistance);
  }
  return map;
}

// ── import extraction ──────────────────────────────────────────────────────

const IMPORT_RE = /import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
const REQUIRE_RE = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const TYPE_IMPORT_RE = /import\s+type\s+/;

function resolveImport(importPath, fromFile) {
  if (!importPath.startsWith('.')) return null;
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

function extractImports(filePath) {
  let source;
  try { source = fs.readFileSync(filePath, 'utf-8'); } catch { return []; }
  const imports = [];
  for (const re of [IMPORT_RE, REQUIRE_RE]) {
    re.lastIndex = 0;
    for (const m of source.matchAll(re)) {
      const resolved = resolveImport(m[1], filePath);
      if (resolved) {
        imports.push({
          target: resolved,
          isTypeOnly: re === IMPORT_RE && TYPE_IMPORT_RE.test(m[0]),
        });
      }
    }
  }
  return imports;
}

// ── Tarjan's SCC ──────────────────────────────────────────────────────────

function tarjanSCC(nodes, adjList) {
  const index = new Map();
  const lowlink = new Map();
  const onStack = new Set();
  const stack = [];
  const sccs = [];
  let counter = 0;

  function strongConnect(v) {
    index.set(v, counter);
    lowlink.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);

    for (const w of (adjList.get(v) ?? [])) {
      if (!index.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v), lowlink.get(w)));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v), index.get(w)));
      }
    }

    if (lowlink.get(v) === index.get(v)) {
      const scc = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  }

  for (const n of nodes) {
    if (!index.has(n)) strongConnect(n);
  }

  return sccs;
}

// ── cycle classification ───────────────────────────────────────────────────

function isBarrelFile(filePath) {
  const base = path.basename(filePath);
  if (!/^index\.(tsx?|jsx?)$/.test(base)) return false;
  let source;
  try { source = fs.readFileSync(filePath, 'utf-8'); } catch { return false; }
  // A barrel is mostly re-exports, not business logic
  const lines = source.split('\n').filter(l => l.trim() && !l.trim().startsWith('//'));
  const reExportLines = lines.filter(l => /^export\s+(?:\*|{)/.test(l.trim()));
  return reExportLines.length / Math.max(lines.length, 1) > 0.6;
}

function allImportsAreTypeOnly(members, adjList, typeOnlyEdges) {
  for (const m of members) {
    for (const dep of (adjList.get(m) ?? [])) {
      if (members.includes(dep)) {
        const key = `${m}→${dep}`;
        if (!typeOnlyEdges.has(key)) return false;
      }
    }
  }
  return true;
}

function classifyCycle(members, adjList, typeOnlyEdges) {
  if (allImportsAreTypeOnly(members, adjList, typeOnlyEdges)) {
    return {
      kind: 'shared-type',
      evidence: 'All imports between members are "import type" — no runtime circular dependency',
      autoFix: `Extract shared types to a dedicated types file (e.g., ${path.basename(members[0], path.extname(members[0]))}.types.ts)`,
      blocksPhase: false,
    };
  }

  const hasBarrel = members.some(m => isBarrelFile(m));
  if (hasBarrel) {
    const barrels = members.filter(isBarrelFile).map(m => path.relative(rootDir, m));
    return {
      kind: 'barrel',
      evidence: `Barrel index file(s) involved: ${barrels.join(', ')} — cycle is likely a re-export trap`,
      autoFix: `Import directly from the source file, not through the barrel index`,
      blocksPhase: false,
    };
  }

  return {
    kind: 'genuine',
    evidence: 'Runtime imports form a true circle — shared logic or mutual dependency',
    autoFix: null,
    humanDecision: 'extract-shared | invert-dep | migrate-together',
    blocksPhase: true,
  };
}

// ── topological sort with tiebreakers ─────────────────────────────────────

function topoSort(nodes, adjList, fanOutMap, hopMap) {
  // Kahn's algorithm
  const inDegree = new Map(nodes.map(n => [n, 0]));
  for (const [, deps] of adjList) {
    for (const d of deps) {
      if (inDegree.has(d)) inDegree.set(d, inDegree.get(d) + 1);
    }
  }

  const queue = nodes.filter(n => inDegree.get(n) === 0);
  // Tiebreaker: fan-out desc, then hot-path last (high hop = migrate first), then alpha
  queue.sort((a, b) => {
    const fanDiff = (fanOutMap.get(b) ?? 0) - (fanOutMap.get(a) ?? 0);
    if (fanDiff !== 0) return fanDiff;
    const hopA = hopMap.get(path.relative(rootDir, a)) ?? 99;
    const hopB = hopMap.get(path.relative(rootDir, b)) ?? 99;
    if (hopA !== hopB) return hopB - hopA; // higher hop → migrate sooner
    return a.localeCompare(b);
  });

  const result = [];
  const levels = new Map(); // node -> level

  while (queue.length) {
    const n = queue.shift();
    result.push(n);
    const level = levels.get(n) ?? 0;
    for (const dep of [...nodes].filter(m => (adjList.get(m) ?? []).includes(n))) {
      const newDegree = inDegree.get(dep) - 1;
      inDegree.set(dep, newDegree);
      levels.set(dep, Math.max(levels.get(dep) ?? 0, level + 1));
      if (newDegree === 0) {
        queue.push(dep);
        queue.sort((a, b) => {
          const fanDiff = (fanOutMap.get(b) ?? 0) - (fanOutMap.get(a) ?? 0);
          if (fanDiff !== 0) return fanDiff;
          const hopA = hopMap.get(path.relative(rootDir, a)) ?? 99;
          const hopB = hopMap.get(path.relative(rootDir, b)) ?? 99;
          if (hopA !== hopB) return hopB - hopA;
          return a.localeCompare(b);
        });
      }
    }
  }

  return { order: result, levels };
}

// ── phase classification ───────────────────────────────────────────────────

const SCREEN_RE = /(?:^|[/\\])(?:screens?|pages?|app)[/\\]/;
const NAV_RE = /[Nn]avigat|[Ll]ayout/;
const COMPONENT_RE = /(?:^|[/\\])components?[/\\]/;

function classifyFile(relPath, hopMap) {
  const hop = hopMap.get(relPath);
  if (NAV_RE.test(relPath)) return 'navigator';
  if (SCREEN_RE.test(relPath)) {
    if (hop == null) return 'screen';
    return hop <= 1 ? 'hot-path-screen' : 'cold-path-screen';
  }
  if (COMPONENT_RE.test(relPath)) return 'component';
  return 'module';
}

function groupIntoPhases(order, levels, hopMap, cycleFiles) {
  // Group by level
  const byLevel = new Map();
  for (const node of order) {
    const rel = path.relative(rootDir, node);
    const level = levels.get(node) ?? 0;
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level).push(rel);
  }

  const phases = [];
  let phaseNum = 1;

  for (const [, files] of [...byLevel.entries()].sort((a, b) => a[0] - b[0])) {
    if (files.length === 0) continue;

    // Further split level by file kind for readability
    const kinds = new Map();
    for (const f of files) {
      const k = classifyFile(f, hopMap);
      if (!kinds.has(k)) kinds.set(k, []);
      kinds.get(k).push(f);
    }

    const kindOrder = ['navigator', 'component', 'module', 'cold-path-screen', 'screen', 'hot-path-screen'];
    for (const kind of kindOrder) {
      const kFiles = kinds.get(kind);
      if (!kFiles || kFiles.length === 0) continue;

      const rationale = {
        'navigator': 'Top-level navigator — migrate last as it composes all screens',
        'component': 'Leaf or composite component — migrate before the screens that use it',
        'module': 'Utility/shared module — no screen dependency',
        'cold-path-screen': 'Cold-path screen (hop distance ≥ 2) — lower regression risk',
        'screen': 'Screen with unknown hop distance',
        'hot-path-screen': 'Hot-path screen (hop distance ≤ 1) — migrate last with extra verification',
      }[kind] ?? '';

      phases.push({ phase: phaseNum++, kind, files: kFiles, rationale });
    }
  }

  // Append genuine-cycle members as their own "migrate-together" phase if needed
  const cyclePhaseFiles = cycleFiles.filter(f => !order.map(n => path.relative(rootDir, n)).includes(f));
  if (cyclePhaseFiles.length > 0) {
    phases.push({
      phase: phaseNum++,
      kind: 'genuine-cycle-unit',
      files: cyclePhaseFiles,
      rationale: 'Genuine circular dependency — must migrate as a single unit after resolution decision',
    });
  }

  return phases;
}

// ── main ───────────────────────────────────────────────────────────────────

function run() {
  const scopeData = loadScope();
  if (!scopeData) {
    process.stderr.write(
      'dependency-order: no scope data found.\n' +
      '  Run migration-scope.mjs first, or pass --scope-file=path.\n'
    );
    process.exit(1);
  }

  const hopMap = buildHopMap(scopeData);

  const allScopeFiles = [
    ...(scopeData.screens?.map(s => path.resolve(rootDir, s.file)) ?? []),
    ...(scopeData.components?.map(c => path.resolve(rootDir, c)) ?? []),
  ].filter(f => fs.existsSync(f));

  const scopeSet = new Set(allScopeFiles);

  // Build adjacency list (only edges within scope)
  const adjList = new Map(); // file -> [dep, ...] (deps that file imports)
  const typeOnlyEdges = new Set(); // "file→dep" keys where import is type-only
  const fanOut = new Map(); // dep -> how many scope files import it

  for (const filePath of allScopeFiles) {
    const imports = extractImports(filePath);
    const scopeImports = imports.filter(i => scopeSet.has(i.target));
    adjList.set(filePath, scopeImports.map(i => i.target));
    for (const imp of scopeImports) {
      if (imp.isTypeOnly) typeOnlyEdges.add(`${filePath}→${imp.target}`);
      fanOut.set(imp.target, (fanOut.get(imp.target) ?? 0) + 1);
    }
  }

  // Tarjan SCC
  const sccs = tarjanSCC(allScopeFiles, adjList);
  const cycles = [];
  let cycleId = 1;
  const genuineCycleFiles = new Set();

  for (const scc of sccs) {
    if (scc.length < 2) continue;
    const relMembers = scc.map(m => path.relative(rootDir, m));
    const classification = classifyCycle(scc, adjList, typeOnlyEdges);
    cycles.push({
      id: `cycle-${cycleId++}`,
      ...classification,
      members: relMembers,
    });
    if (classification.kind === 'genuine') {
      for (const m of relMembers) genuineCycleFiles.add(m);
    }
  }

  // Collapse SCCs for topo sort: treat each SCC as a supernode
  // For simplicity: remove genuine-cycle nodes from topo sort, handle separately
  const sortableNodes = allScopeFiles.filter(f => !genuineCycleFiles.has(path.relative(rootDir, f)));
  const filteredAdj = new Map(
    [...adjList.entries()]
      .filter(([k]) => sortableNodes.includes(k))
      .map(([k, deps]) => [k, deps.filter(d => sortableNodes.includes(d))])
  );

  const { order, levels } = topoSort(sortableNodes, filteredAdj, fanOut, hopMap);
  const phases = groupIntoPhases(order, levels, hopMap, [...genuineCycleFiles]);

  // Prepend phase 0 for auto-fixable cycles
  const autoFixCycles = cycles.filter(c => c.autoFix && !c.blocksPhase);
  if (autoFixCycles.length > 0) {
    phases.unshift({
      phase: 0,
      kind: 'cycle-fixes',
      files: [],
      actions: autoFixCycles.map(c => c.autoFix),
      rationale: 'Resolve auto-fixable cycles before migration begins',
    });
    // Re-number remaining phases
    for (let i = 1; i < phases.length; i++) phases[i].phase = i;
  }

  // Build relative-path graph for output
  const graph = {};
  for (const [node, deps] of adjList) {
    graph[path.relative(rootDir, node)] = deps.map(d => path.relative(rootDir, d));
  }

  const result = {
    graph,
    cycles,
    phases,
    summary: {
      fileCount: allScopeFiles.length,
      cycleCount: cycles.length,
      blockingCycles: cycles.filter(c => c.blocksPhase).length,
      phaseCount: phases.length,
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

try {
  run();
} catch (err) {
  process.stderr.write(`dependency-order: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
