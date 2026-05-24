#!/usr/bin/env node

/**
 * duplication-report.mjs
 *
 * Clusters components that appear to do the same job. Reads the output of
 * component-inventory.mjs and emits clusters of likely-duplicate components
 * based on three signals:
 *
 *   1. Name similarity   — token overlap on the component name (PrimaryButton,
 *                          MainButton, CTAButton all share "Button").
 *   2. Prop-surface overlap — ≥70% of prop names match (Jaccard).
 *   3. JSX root-shape overlap — same root element + similar children topology
 *                               (read directly from the source file).
 *
 * A pair must hit ≥2 of the 3 signals to be considered duplicates. Clusters
 * are formed by transitive closure of those pairs.
 *
 * The agent does NOT pick the winner here — duplication-report only surfaces
 * candidates with evidence. Act 2 decides which cluster member wins, after
 * comparing the job each member is actually doing.
 *
 * Usage:
 *   node duplication-report.mjs [--dir=path] [--inventory=path.json]
 *                                [--name-threshold=0.5] [--prop-threshold=0.7]
 *
 * Output (stdout, JSON):
 *   {
 *     "clusters": [ { id, members, signals, jobGuess, suggestedWinner }, ... ],
 *     "summary": { ... }
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
const nameThreshold = parseFloat(flag('name-threshold') ?? '0.5');
const propThreshold = parseFloat(flag('prop-threshold') ?? '0.7');

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

// ── signals ───────────────────────────────────────────────────────────────

/**
 * Tokenize a PascalCase / camelCase / snake_case name into lowercase tokens.
 *   "PrimaryCTAButton" → ["primary", "cta", "button"]
 *   "main_btn"          → ["main", "btn"]
 */
function tokenizeName(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_\-]+/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

const NAME_STOPWORDS = new Set([
  'the', 'a', 'an', 'component', 'view', 'wrapper', 'container', 'inner', 'outer',
]);

function nameSimilarity(a, b) {
  const ta = new Set(tokenizeName(a).filter(t => !NAME_STOPWORDS.has(t)));
  const tb = new Set(tokenizeName(b).filter(t => !NAME_STOPWORDS.has(t)));
  if (ta.size === 0 || tb.size === 0) return 0;
  const inter = [...ta].filter(t => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return inter / union;
}

function propSimilarity(propsA, propsB) {
  const a = new Set(propsA.map(p => p.name).filter(n => n !== 'children'));
  const b = new Set(propsB.map(p => p.name).filter(n => n !== 'children'));
  if (a.size === 0 && b.size === 0) return 0; // both propless ≠ duplicates
  if (a.size === 0 || b.size === 0) return 0;
  const inter = [...a].filter(n => b.has(n)).length;
  const union = new Set([...a, ...b]).size;
  return inter / union;
}

// ── JSX root-shape extraction ─────────────────────────────────────────────

/**
 * Extract a coarse "shape signature" of the component's render output:
 *   - root tag name
 *   - the sequence of child tag names at depth 1
 *
 * We find the body of the component declaration, then the first `return (...)`
 * or `return <...>` after it.
 */
function extractRootShape(filePath, componentName) {
  let source;
  try { source = fs.readFileSync(filePath, 'utf-8'); } catch { return null; }

  // Locate the component declaration start.
  const declRe = new RegExp(
    `(?:function\\s+${componentName}\\b|(?:const|let|var)\\s+${componentName}\\b\\s*=)`
  );
  const m = source.match(declRe);
  if (!m) return null;
  const declStart = m.index;
  const slice = source.slice(declStart, declStart + 5000);

  // Find first return-of-JSX
  const retMatches = [
    ...slice.matchAll(/return\s*\(\s*</g),
    ...slice.matchAll(/return\s*</g),
    ...slice.matchAll(/=>\s*\(\s*</g),
    ...slice.matchAll(/=>\s*</g),
  ];
  if (retMatches.length === 0) return null;
  retMatches.sort((a, b) => a.index - b.index);
  const first = retMatches[0];
  const openIdx = slice.indexOf('<', first.index);
  if (openIdx < 0) return null;

  // Read the root tag name
  const tagMatch = slice.slice(openIdx).match(/^<\s*([A-Za-z_][A-Za-z0-9_.]*)/);
  if (!tagMatch) return null;
  const rootTag = tagMatch[1];

  // Walk depth=1 children: collect top-level child opening tags until matching close.
  // This is a depth-counter on '<' / '</' / '/>' — good enough for shape, not exact.
  const after = slice.slice(openIdx);
  const children = [];
  let depth = 0;
  let i = 0;
  while (i < after.length && i < 4000) {
    if (after[i] === '<') {
      // self-closing? scan to '/>' or '>'
      const close = after.indexOf('>', i);
      if (close < 0) break;
      const tagBody = after.slice(i + 1, close);
      const isClose = tagBody.startsWith('/');
      const isSelfClose = tagBody.endsWith('/');
      const tagNameMatch = tagBody.replace(/^\//, '').match(/^([A-Za-z_][A-Za-z0-9_.]*)/);
      const tagName = tagNameMatch ? tagNameMatch[1] : null;
      if (isClose) {
        depth--;
        if (depth === 0) break; // closed the root
      } else {
        if (depth === 1 && tagName) children.push(tagName);
        if (!isSelfClose) depth++;
      }
      i = close + 1;
    } else {
      i++;
    }
  }

  return { rootTag, children };
}

function shapeSimilarity(shapeA, shapeB) {
  if (!shapeA || !shapeB) return 0;
  if (shapeA.rootTag !== shapeB.rootTag) return 0;
  // Root tags match → score the child sequence overlap (multiset Jaccard).
  const countA = new Map(), countB = new Map();
  for (const c of shapeA.children) countA.set(c, (countA.get(c) ?? 0) + 1);
  for (const c of shapeB.children) countB.set(c, (countB.get(c) ?? 0) + 1);
  let inter = 0, union = 0;
  const allKeys = new Set([...countA.keys(), ...countB.keys()]);
  for (const k of allKeys) {
    inter += Math.min(countA.get(k) ?? 0, countB.get(k) ?? 0);
    union += Math.max(countA.get(k) ?? 0, countB.get(k) ?? 0);
  }
  if (union === 0) return shapeA.rootTag === shapeB.rootTag ? 0.5 : 0;
  return inter / union;
}

// ── cluster formation (union-find on duplicate pairs) ─────────────────────

class UnionFind {
  constructor() { this.parent = new Map(); }
  find(x) {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let r = x;
    while (this.parent.get(r) !== r) r = this.parent.get(r);
    let cur = x;
    while (this.parent.get(cur) !== r) {
      const next = this.parent.get(cur);
      this.parent.set(cur, r);
      cur = next;
    }
    return r;
  }
  union(a, b) { this.parent.set(this.find(a), this.find(b)); }
  groups() {
    const g = new Map();
    for (const x of this.parent.keys()) {
      const r = this.find(x);
      if (!g.has(r)) g.set(r, []);
      g.get(r).push(x);
    }
    return [...g.values()];
  }
}

// ── job-guess + winner suggestion ─────────────────────────────────────────

function guessSharedJob(members) {
  // Job guess = the intersection of name tokens (minus stopwords), joined.
  const tokenSets = members.map(m => new Set(tokenizeName(m.name).filter(t => !NAME_STOPWORDS.has(t))));
  let shared = [...tokenSets[0]];
  for (let i = 1; i < tokenSets.length; i++) {
    shared = shared.filter(t => tokenSets[i].has(t));
  }
  return shared.length ? shared.join(' ') : '(no shared name token — verify they actually share a job)';
}

function suggestWinner(members) {
  // Heuristic: most-used wins; ties broken by most recently touched, then most props.
  const sorted = [...members].sort((a, b) => {
    if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
    const ta = a.lastTouched ?? '';
    const tb = b.lastTouched ?? '';
    if (tb !== ta) return tb.localeCompare(ta);
    return (b.props?.length ?? 0) - (a.props?.length ?? 0);
  });
  return sorted[0].name;
}

// ── main ──────────────────────────────────────────────────────────────────

function run() {
  const inventory = loadInventory();
  const components = inventory.components ?? [];

  // Extract root shapes once per component
  const shapes = new Map();
  for (const c of components) {
    const full = path.join(rootDir, c.file);
    shapes.set(c.name, extractRootShape(full, c.name));
  }

  const uf = new UnionFind();
  const pairs = [];

  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const a = components[i], b = components[j];
      // Don't cluster screen-fragments with components — they live in different worlds.
      if (a.kindGuess === 'screen-fragment' || b.kindGuess === 'screen-fragment') continue;

      const nameSim = nameSimilarity(a.name, b.name);
      const propSim = propSimilarity(a.props ?? [], b.props ?? []);
      const shapeSim = shapeSimilarity(shapes.get(a.name), shapes.get(b.name));

      const signals = {
        name: nameSim >= nameThreshold,
        props: propSim >= propThreshold,
        shape: shapeSim >= 0.6,
      };
      const hits = (signals.name ? 1 : 0) + (signals.props ? 1 : 0) + (signals.shape ? 1 : 0);
      if (hits >= 2) {
        uf.union(a.name, b.name);
        pairs.push({
          a: a.name, b: b.name,
          nameSim: Math.round(nameSim * 100) / 100,
          propSim: Math.round(propSim * 100) / 100,
          shapeSim: Math.round(shapeSim * 100) / 100,
          signals,
        });
      }
    }
  }

  const groups = uf.groups().filter(g => g.length >= 2);
  const byName = new Map(components.map(c => [c.name, c]));

  const clusters = groups.map((names, i) => {
    const members = names.map(n => {
      const c = byName.get(n);
      return {
        name: c.name,
        file: c.file,
        usageCount: c.usageCount,
        propCount: c.props?.length ?? 0,
        kindGuess: c.kindGuess,
        rootTag: shapes.get(c.name)?.rootTag ?? null,
        rootChildren: shapes.get(c.name)?.children ?? [],
        lastTouched: c.lastTouched,
      };
    }).sort((a, b) => b.usageCount - a.usageCount);

    const memberPairs = pairs.filter(p => names.includes(p.a) && names.includes(p.b));

    return {
      id: `dup-cluster-${i + 1}`,
      jobGuess: guessSharedJob(members),
      suggestedWinner: suggestWinner(members),
      winnerJustification: 'Most-used; tie-broken by most recently touched, then most props. Verify in Act 2 by comparing the actual job each member is doing.',
      members,
      pairwiseSignals: memberPairs,
      memberCount: members.length,
      totalUsage: members.reduce((s, m) => s + m.usageCount, 0),
    };
  }).sort((a, b) => b.totalUsage - a.totalUsage);

  const result = {
    clusters,
    summary: {
      rootDir,
      componentCount: components.length,
      clusterCount: clusters.length,
      duplicatedComponentCount: clusters.reduce((s, c) => s + c.memberCount, 0),
      thresholds: { name: nameThreshold, props: propThreshold, shape: 0.6 },
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

try { run(); }
catch (err) {
  process.stderr.write(`duplication-report: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
