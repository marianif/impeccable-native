#!/usr/bin/env node

/**
 * composition-patterns.mjs
 *
 * The implicit-organism CANDIDATE harvester. Walks screen files and finds
 * repeated JSX sub-trees that look like they *might* be organisms hiding in
 * inline code. The output is a short shortlist, not an exhaustive dump —
 * Act 2 then applies the five-question gate (job / lives in / states /
 * reacts to / neighbors) to decide which candidates actually qualify.
 *
 * Bar for being a candidate (ALL must hold):
 *   - ≥ minElements total elements in the sub-tree (default 6)
 *   - ≥ minUniqueElementTypes distinct element types (default 4) — filters
 *     out `View>[Text,Text]` and other structural noise
 *   - root tag is not a bare `View` UNLESS the root carries a `style=` ref
 *     (bare wrappers are not organisms)
 *   - contains at least one interaction or data signal: onPress, onChange*,
 *     a list container (FlatList / SectionList / ScrollView), or a
 *     navigation call inside (router.push, navigation.navigate)
 *   - after near-duplicate clustering (shared root + ≥80% child Jaccard),
 *     the merged candidate appears in ≥ minScreenSpread distinct screen
 *     files (default 2)
 *
 * Near-duplicate clustering: two raw patterns merge into one candidate if
 * they share the same root tag and their depth-1 children sets overlap by
 * ≥ jaccardMerge (default 0.8) on a multiset basis. The merged candidate
 * keeps the union of children, the union of occurrences, and the strictest
 * (most specific) signature as its label.
 *
 * Usage:
 *   node composition-patterns.mjs [--dir=path]
 *                                  [--screens-dir=screens,app,src/screens]
 *                                  [--min-occurrences=3] [--min-elements=6]
 *                                  [--min-unique-element-types=4]
 *                                  [--min-screen-spread=2]
 *                                  [--jaccard-merge=0.8]
 *
 * Output (stdout, JSON):
 *   {
 *     "candidates": [ Candidate, ... ],
 *     "rejected":   { tooSmall, tooFlat, bareWrapper, noInteraction, lowSpread },
 *     "summary":    { ... }
 *   }
 *
 * Candidate shape:
 *   {
 *     "id":              "candidate-1",
 *     "label":           "View(styled)>[Image,Headline,ProgressBar,Pressable,Text]",
 *     "rootTag":         "View",
 *     "rootHasStyle":    true,
 *     "children":        ["Image", "Headline", "ProgressBar", "Pressable", "Text"],
 *     "elementCount":    9,
 *     "uniqueChildTypes":5,
 *     "occurrenceCount": 4,
 *     "screenSpread":    3,
 *     "occurrences":     [{ file, line }, ...],
 *     "mergedFromSignatures": [...],
 *     "interactionSignals":   ["onPress", "router.push"],
 *     "tokenSignals":    { ... },
 *     "jobGuess":        "..."
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
const minOccurrences = parseInt(flag('min-occurrences') ?? '3', 10);
const minElements = parseInt(flag('min-elements') ?? '6', 10);
const minUniqueElementTypes = parseInt(flag('min-unique-element-types') ?? '4', 10);
const minScreenSpread = parseInt(flag('min-screen-spread') ?? '2', 10);
const jaccardMerge = parseFloat(flag('jaccard-merge') ?? '0.8');

// Load the directory tree (if a path was given) for precise screen-root scoping.
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

// ── JSX micro-parser (regex + bracket counter) ────────────────────────────

/**
 * Tokenize JSX-ish content in a string. Returns a list of tokens of the form:
 *   { kind: 'open'|'close'|'selfclose', tag, attrs, line, start, end }
 *
 * `attrs` is the raw attribute string (everything between tag name and `>` /
 * `/>`), useful for signal extraction (e.g. style references, onPress).
 *
 * We deliberately keep this loose: we want shape, not semantic accuracy.
 */
function tokenizeJsx(source) {
  const tokens = [];
  const tagRe = /<\s*(\/?)([A-Z][A-Za-z0-9_.]*|>)([^>]*?)(\/?)>/g;
  // ^ Capitalized tags only (and `<>` fragment, captured as `>`).
  // We restrict to Capitalized to skip lowercase HTML-ish (RN doesn't use those)
  // and to keep noise down. Fragments are skipped.
  for (const m of source.matchAll(tagRe)) {
    if (m[2] === '>') continue; // fragment
    const isClose = m[1] === '/';
    const isSelfClose = m[4] === '/';
    const tag = m[2];
    const attrs = m[3] ?? '';
    const start = m.index;
    const line = source.slice(0, start).split('\n').length;
    tokens.push({
      kind: isClose ? 'close' : (isSelfClose ? 'selfclose' : 'open'),
      tag, attrs, line, start, end: start + m[0].length,
    });
  }
  return tokens;
}

/**
 * From a token stream, build a list of sub-trees. Each sub-tree is rooted at
 * an `open` token, ends at the matching `close`, and exposes its depth-1
 * children. We emit a sub-tree for every `open` token (so every node becomes
 * a potential pattern root).
 *
 * Self-closing tokens are leaves; they don't form sub-trees but do count as
 * children of their parent.
 */
function buildSubtrees(tokens) {
  const subtrees = [];
  const stack = []; // entries: { tag, line, start, depth1Children: [], elementCount }

  for (const t of tokens) {
    if (t.kind === 'open') {
      // Record this as a child of the current top, if any.
      if (stack.length > 0) {
        const top = stack[stack.length - 1];
        top.depth1Children.push(t.tag);
        top.elementCount += 1;
      }
      stack.push({
        tag: t.tag,
        line: t.line,
        start: t.start,
        attrs: t.attrs,
        depth1Children: [],
        elementCount: 1, // include self
        depthOnEnter: stack.length,
      });
    } else if (t.kind === 'selfclose') {
      if (stack.length > 0) {
        const top = stack[stack.length - 1];
        top.depth1Children.push(t.tag);
        top.elementCount += 1;
      }
    } else if (t.kind === 'close') {
      // Pop until we find the matching open. JSX-in-the-wild may have
      // mismatched closes (e.g. inside template strings); skip gracefully.
      while (stack.length > 0) {
        const popped = stack.pop();
        // Propagate child count to parent (so parent.elementCount reflects subtree size).
        if (stack.length > 0) {
          stack[stack.length - 1].elementCount += popped.elementCount - 1;
        }
        // The popped subtree becomes a candidate pattern.
        subtrees.push({
          rootTag: popped.tag,
          children: popped.depth1Children.slice(),
          elementCount: popped.elementCount,
          line: popped.line,
          start: popped.start,
          attrs: popped.attrs,
        });
        if (popped.tag === t.tag) break;
      }
    }
  }
  // Anything left on the stack (unbalanced) — flush as best-effort.
  while (stack.length > 0) {
    const popped = stack.pop();
    subtrees.push({
      rootTag: popped.tag,
      children: popped.depth1Children.slice(),
      elementCount: popped.elementCount,
      line: popped.line,
      start: popped.start,
      attrs: popped.attrs,
    });
  }
  return subtrees;
}

// ── signature + signals ───────────────────────────────────────────────────

function signatureOf(subtree) {
  // Children order matters for visual rhythm — keep order.
  return `${subtree.rootTag}>[${subtree.children.join(',')}]`;
}

const STYLE_TOKEN_RE = /styles\.([A-Za-z_][A-Za-z0-9_]*)/g;
const HANDLER_RE = /\bon[A-Z][A-Za-z0-9]*\s*=/g;

function extractTokenSignals(subtreeOccurrences, sourceByFile) {
  // Across all occurrences of a pattern, what styles.* keys and on* handlers
  // do they consistently use? This is the "tokens it consistently uses"
  // promised by the reference doc.
  const styleCounts = new Map();
  const handlerCounts = new Map();
  let totalAttrLength = 0;

  for (const occ of subtreeOccurrences) {
    // Re-extract attrs across the *entire* subtree, not just the root.
    const source = sourceByFile.get(occ.file);
    if (!source) continue;
    // Grab the slice from the root line to a generous downstream offset.
    // We already have the root start; widen to next ~2000 chars to cover most subtrees.
    const slice = source.slice(occ.start, occ.start + 2000);
    totalAttrLength += slice.length;
    for (const m of slice.matchAll(STYLE_TOKEN_RE)) {
      styleCounts.set(m[1], (styleCounts.get(m[1]) ?? 0) + 1);
    }
    for (const m of slice.matchAll(HANDLER_RE)) {
      const handler = m[0].replace(/\s*=$/, '').trim();
      handlerCounts.set(handler, (handlerCounts.get(handler) ?? 0) + 1);
    }
  }

  const dominantStyles = [...styleCounts.entries()]
    .filter(([, n]) => n >= Math.ceil(subtreeOccurrences.length * 0.5))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k, n]) => ({ key: k, occurrences: n }));

  const dominantHandlers = [...handlerCounts.entries()]
    .filter(([, n]) => n >= Math.ceil(subtreeOccurrences.length * 0.5))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, n]) => ({ handler: k, occurrences: n }));

  return { dominantStyles, dominantHandlers };
}

function guessJob(pattern) {
  // Crude verb-led guess from the dominant handler + root tag.
  const handler = pattern.tokenSignals.dominantHandlers[0]?.handler;
  if (handler === 'onPress') {
    if (pattern.children.includes('Image')) return 'Tap a card-like surface that includes imagery to act on something.';
    if (pattern.children.includes('Text')) return 'Tap a labeled surface to act on something.';
    return 'Tap a surface to act on something.';
  }
  if (handler === 'onChangeText' || handler === 'onChange') {
    return 'Let the user enter or edit a value.';
  }
  if (handler === 'onScroll' || handler === 'onEndReached') {
    return 'Display a list-like collection the user can browse.';
  }
  if (pattern.rootTag.toLowerCase().includes('list')) {
    return 'Display a collection of items.';
  }
  if (pattern.children.includes('Image') && pattern.children.includes('Text')) {
    return 'Show an item with imagery and labeling — no clear interaction (informational).';
  }
  return 'No clear job signal — Act 2 must define this in plain language before promotion.';
}

// ── hard filters + clustering ─────────────────────────────────────────────

function rootHasStyle(attrs) {
  // style={...} or style={[...]} or style={styles.foo} all count.
  return /\bstyle\s*=\s*\{/.test(attrs ?? '');
}

const INTERACTION_RES = [
  { name: 'onPress',          re: /\bonPress\s*=/ },
  { name: 'onLongPress',      re: /\bonLongPress\s*=/ },
  { name: 'onChangeText',     re: /\bonChangeText\s*=/ },
  { name: 'onChange',         re: /\bonChange\s*=/ },
  { name: 'onSubmitEditing',  re: /\bonSubmitEditing\s*=/ },
  { name: 'onScroll',         re: /\bonScroll\s*=/ },
  { name: 'onEndReached',     re: /\bonEndReached\s*=/ },
  { name: 'router.push',      re: /\brouter\.(push|navigate|replace)\b/ },
  { name: 'navigation.*',     re: /\bnavigation\.(push|navigate|replace|goBack)\b/ },
];
const LIST_CONTAINER_RE = /\b(FlatList|SectionList|ScrollView|VirtualizedList)\b/;

function interactionSignalsIn(slice) {
  const hits = new Set();
  for (const { name, re } of INTERACTION_RES) if (re.test(slice)) hits.add(name);
  if (LIST_CONTAINER_RE.test(slice)) hits.add('list-container');
  return [...hits];
}

/**
 * Decide whether a raw sub-tree clears the hard "worth Act 2's attention" bar.
 * Returns either { ok: true } or { ok: false, reason: '...' }.
 */
function passesHardFilters(st, slice) {
  if (st.elementCount < minElements) return { ok: false, reason: 'tooSmall' };
  const unique = new Set(st.children).size;
  if (unique < minUniqueElementTypes) return { ok: false, reason: 'tooFlat' };
  if (st.rootTag === 'View' && !rootHasStyle(st.attrs)) {
    return { ok: false, reason: 'bareWrapper' };
  }
  const signals = interactionSignalsIn(slice);
  if (signals.length === 0) return { ok: false, reason: 'noInteraction' };
  return { ok: true, interactionSignals: signals, uniqueChildTypes: unique };
}

function multisetJaccard(a, b) {
  const countA = new Map(), countB = new Map();
  for (const x of a) countA.set(x, (countA.get(x) ?? 0) + 1);
  for (const x of b) countB.set(x, (countB.get(x) ?? 0) + 1);
  let inter = 0, union = 0;
  for (const k of new Set([...countA.keys(), ...countB.keys()])) {
    inter += Math.min(countA.get(k) ?? 0, countB.get(k) ?? 0);
    union += Math.max(countA.get(k) ?? 0, countB.get(k) ?? 0);
  }
  return union === 0 ? 0 : inter / union;
}

/**
 * Cluster near-duplicate raw patterns (same root, ≥jaccardMerge child overlap)
 * via greedy single-link clustering ordered by occurrence count desc.
 */
function clusterPatterns(rawPatterns) {
  const sorted = [...rawPatterns].sort((a, b) => b.occurrences.length - a.occurrences.length);
  const candidates = [];
  for (const p of sorted) {
    let placed = false;
    for (const c of candidates) {
      if (c.rootTag !== p.rootTag) continue;
      if (c.rootHasStyle !== p.rootHasStyle) continue;
      const sim = multisetJaccard(c.children, p.children);
      if (sim >= jaccardMerge) {
        // Merge: keep the union of children (preserving order from the larger seed),
        // union occurrences, union interaction signals, append signature.
        const seen = new Set(c.children);
        for (const ch of p.children) if (!seen.has(ch)) { c.children.push(ch); seen.add(ch); }
        c.occurrences.push(...p.occurrences);
        for (const s of p.interactionSignals) c.interactionSignalsSet.add(s);
        c.mergedFromSignatures.push(p.signature);
        c.elementCount = Math.max(c.elementCount, p.elementCount);
        placed = true;
        break;
      }
    }
    if (!placed) {
      candidates.push({
        rootTag: p.rootTag,
        rootHasStyle: p.rootHasStyle,
        children: [...p.children],
        elementCount: p.elementCount,
        occurrences: [...p.occurrences],
        interactionSignalsSet: new Set(p.interactionSignals),
        mergedFromSignatures: [p.signature],
      });
    }
  }
  return candidates;
}

// ── main ──────────────────────────────────────────────────────────────────

function run() {
  // Prefer screen roots from the directory tree; fall back to --screens-dir.
  const tree = loadTree();
  const treeScreenRoots = (tree?.roots?.screens ?? []).map(p => path.join(rootDir, p));
  const screenRoots = treeScreenRoots.length > 0 ? treeScreenRoots : existingDirs(screensDirs);
  if (screenRoots.length === 0) {
    process.stdout.write(JSON.stringify({
      candidates: [],
      rejected: { tooSmall: 0, tooFlat: 0, bareWrapper: 0, noInteraction: 0, lowSpread: 0 },
      summary: {
        rootDir,
        screenRoots: [],
        screenFilesScanned: 0,
        candidateCount: 0,
        note: 'No screen directories found. Pass --screens-dir or run from project root.',
      },
    }, null, 2) + '\n');
    return;
  }

  const screenFiles = [];
  for (const r of screenRoots) collectFiles(r, screenFiles);

  const sourceByFile = new Map();
  const rejectedCounts = { tooSmall: 0, tooFlat: 0, bareWrapper: 0, noInteraction: 0, lowSpread: 0 };

  // Raw patterns: keyed by signature (root + ordered children), with per-occurrence interaction signals.
  const rawBySig = new Map();

  for (const filePath of screenFiles) {
    let source;
    try { source = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }
    const rel = path.relative(rootDir, filePath);
    sourceByFile.set(rel, source);

    const tokens = tokenizeJsx(source);
    const subtrees = buildSubtrees(tokens);

    for (const st of subtrees) {
      if (st.children.length === 0) { rejectedCounts.tooSmall++; continue; }
      // Slice for interaction-signal detection; reused for token-signal pass later.
      const slice = source.slice(st.start ?? 0, (st.start ?? 0) + 2000);
      const verdict = passesHardFilters(st, slice);
      if (!verdict.ok) { rejectedCounts[verdict.reason]++; continue; }

      const sig = signatureOf(st);
      if (!rawBySig.has(sig)) {
        rawBySig.set(sig, {
          signature: sig,
          rootTag: st.rootTag,
          rootHasStyle: rootHasStyle(st.attrs),
          children: st.children,
          elementCount: st.elementCount,
          occurrences: [],
          interactionSignals: new Set(verdict.interactionSignals),
        });
      }
      const bucket = rawBySig.get(sig);
      bucket.occurrences.push({ file: rel, line: st.line, start: st.start });
      for (const s of verdict.interactionSignals) bucket.interactionSignals.add(s);
    }
  }

  // Convert to array; carry interactionSignals as array for clustering input.
  const rawPatterns = [...rawBySig.values()].map(p => ({
    ...p,
    interactionSignals: [...p.interactionSignals],
  }));

  // Cluster near-duplicates.
  const clustered = clusterPatterns(rawPatterns);

  // Final spread filter + assemble Candidate shape.
  const candidates = [];
  for (const c of clustered) {
    const screenSpread = new Set(c.occurrences.map(o => o.file)).size;
    if (c.occurrences.length < minOccurrences) { rejectedCounts.lowSpread++; continue; }
    if (screenSpread < minScreenSpread) { rejectedCounts.lowSpread++; continue; }

    const tokenSignals = extractTokenSignals(c.occurrences, sourceByFile);
    const candidate = {
      id: '', // assigned after sort
      label: `${c.rootTag}${c.rootHasStyle ? '(styled)' : ''}>[${c.children.join(',')}]`,
      rootTag: c.rootTag,
      rootHasStyle: c.rootHasStyle,
      children: c.children,
      elementCount: c.elementCount,
      uniqueChildTypes: new Set(c.children).size,
      occurrenceCount: c.occurrences.length,
      screenSpread,
      occurrences: c.occurrences.map(o => ({ file: o.file, line: o.line })),
      mergedFromSignatures: c.mergedFromSignatures,
      interactionSignals: [...c.interactionSignalsSet],
      tokenSignals,
    };
    candidate.jobGuess = guessJob(candidate);
    candidates.push(candidate);
  }

  // Rank: screen spread first (cross-flow signal), then occurrence count, then size.
  candidates.sort((a, b) => {
    if (b.screenSpread !== a.screenSpread) return b.screenSpread - a.screenSpread;
    if (b.occurrenceCount !== a.occurrenceCount) return b.occurrenceCount - a.occurrenceCount;
    return b.elementCount - a.elementCount;
  });
  candidates.forEach((c, i) => { c.id = `candidate-${i + 1}`; });

  const result = {
    candidates,
    rejected: rejectedCounts,
    summary: {
      rootDir,
      screenRoots: screenRoots.map(r => path.relative(rootDir, r)),
      screenFilesScanned: screenFiles.length,
      rawPatternCount: rawPatterns.length,
      candidateCount: candidates.length,
      crossScreenCandidates: candidates.filter(c => c.screenSpread >= 2).length,
      thresholds: {
        minOccurrences, minElements, minUniqueElementTypes,
        minScreenSpread, jaccardMerge,
      },
      note: 'Candidates are starting points for Act 2. The five-question gate (job / lives in / states / reacts to / neighbors) decides which ones actually become organisms.',
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

try { run(); }
catch (err) {
  process.stderr.write(`composition-patterns: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
