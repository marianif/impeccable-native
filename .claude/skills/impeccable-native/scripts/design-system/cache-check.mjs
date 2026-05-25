#!/usr/bin/env node

/**
 * cache-check.mjs
 *
 * Compares the tree-hashes stored in an inventory.json against the current
 * tree-hashes of those roots, and reports whether the cached inventory is
 * still fresh.
 *
 * Usage:
 *   node cache-check.mjs [--inventory=.impeccable/design-system/inventory.json] [--dir=.]
 *
 * Output (stdout, JSON):
 *   { fresh: boolean, stale_roots: [...], inventory_exists: boolean, reason: string }
 *
 * Exit code is always 0 — staleness is a fact, not an error.
 */

import fs from 'node:fs';
import path from 'node:path';
import { treeHash } from './tree-hash.mjs';

function flag(name) {
  const f = process.argv.slice(2).find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
}

const rootDir = path.resolve(flag('dir') ?? process.cwd());
const inventoryPath = path.resolve(
  rootDir,
  flag('inventory') ?? '.impeccable/design-system/inventory.json',
);

function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
}

if (!fs.existsSync(inventoryPath)) {
  emit({ fresh: false, stale_roots: [], inventory_exists: false, reason: 'No inventory.json on disk.' });
  process.exit(0);
}

let inventory;
try {
  inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
} catch (err) {
  emit({
    fresh: false,
    stale_roots: [],
    inventory_exists: true,
    reason: `Could not parse inventory.json: ${err.message}`,
  });
  process.exit(0);
}

const cached = inventory.tree_hashes ?? {};
const roots = Object.keys(cached);

if (roots.length === 0) {
  emit({
    fresh: false,
    stale_roots: [],
    inventory_exists: true,
    reason: 'Inventory has no tree_hashes — re-run inventory.mjs.',
  });
  process.exit(0);
}

const staleRoots = [];
for (const root of roots) {
  const current = treeHash(root, { cwd: rootDir });
  if (current.hash !== cached[root]?.hash) {
    staleRoots.push(root);
  }
}

emit({
  fresh: staleRoots.length === 0,
  stale_roots: staleRoots,
  inventory_exists: true,
  reason:
    staleRoots.length === 0
      ? 'All tree-hashes match.'
      : `Tree-hash mismatch in ${staleRoots.length} root(s): ${staleRoots.join(', ')}.`,
});
