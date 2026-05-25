/**
 * Shared utilities for scenario detectors.
 *
 * A scenario is a tiny pure-node function that answers: "given this repo
 * root, does my expected layout exist, and if so where are the component
 * roots?" Scenarios are not gates — they are hints. The synthesized
 * state.mjs uses the best match as a starting point, but the RAG synthesis
 * pass can override it.
 */

import fs from 'node:fs';
import path from 'node:path';

/** Returns true if `p` exists and is a directory. */
export function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Quick "does this dir contain React component files?" check. Looks for any
 * .tsx / .jsx / .ts / .js file at any depth that imports react. Bails after
 * the first hit to stay cheap on large trees.
 */
export function dirHasReactFiles(dir, { maxDepth = 4 } = {}) {
  return walkUntilReact(dir, dir, 0, maxDepth);
}

function walkUntilReact(rootDir, currentDir, depth, maxDepth) {
  if (depth > maxDepth) return false;
  let entries;
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name.startsWith('.')) continue;
    const full = path.join(currentDir, e.name);
    if (e.isDirectory()) {
      if (walkUntilReact(rootDir, full, depth + 1, maxDepth)) return true;
    } else if (e.isFile() && /\.(tsx|jsx|ts|js)$/.test(e.name)) {
      try {
        const head = fs.readFileSync(full, 'utf8').slice(0, 2048);
        if (/from\s+['"]react(-native)?['"]/.test(head)) return true;
      } catch {
        /* ignore */
      }
    }
  }
  return false;
}

/**
 * Build a {matched, roots, confidence} result.
 *
 * confidence:
 *   high   — directory exists AND it contains React files
 *   medium — directory exists, no React imports found within scan depth
 *   low    — used by callers that match on partial heuristics
 */
export function resultFor(absRoots, rootDir, { confidence } = {}) {
  const existing = absRoots.filter(r => isDir(r));
  if (existing.length === 0) return { matched: false, roots: [], confidence: 'low' };
  const hasReact = existing.some(r => dirHasReactFiles(r));
  return {
    matched: true,
    roots: existing.map(r => path.relative(rootDir, r) || '.'),
    confidence: confidence ?? (hasReact ? 'high' : 'medium'),
  };
}
