#!/usr/bin/env node

/**
 * charter-stamp.mjs
 *
 * Updates the `derived_from_product_md_hash` field in an existing
 * DESIGN-SYSTEM.md's frontmatter. Used after a refresh-charter pass so
 * subsequent state checks no longer flag the charter as stale.
 *
 * Usage:
 *   node charter-stamp.mjs --charter=DESIGN-SYSTEM.md --product-md=PRODUCT.md
 *
 * If the charter has no frontmatter block, one is prepended.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

function flag(name) {
  const f = process.argv.slice(2).find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
}

const charterPath = path.resolve(flag('charter') ?? 'DESIGN-SYSTEM.md');
const productMdPath = path.resolve(flag('product-md') ?? 'PRODUCT.md');

if (!fs.existsSync(charterPath)) {
  process.stderr.write(`charter-stamp.mjs: charter not found at ${charterPath}\n`);
  process.exit(2);
}
if (!fs.existsSync(productMdPath)) {
  process.stderr.write(`charter-stamp.mjs: PRODUCT.md not found at ${productMdPath}\n`);
  process.exit(2);
}

const productContents = fs.readFileSync(productMdPath, 'utf8');
const hash = createHash('sha256').update(productContents).digest('hex');
const stampedAt = new Date().toISOString();

const original = fs.readFileSync(charterPath, 'utf8');
const updated = stampFrontmatter(original, {
  derived_from_product_md_hash: hash,
  derived_from_product_md_path: path.relative(path.dirname(charterPath), productMdPath),
  last_stamped_at: stampedAt,
});

fs.writeFileSync(charterPath, updated);

process.stdout.write(JSON.stringify({
  status: 'stamped',
  path: path.relative(process.cwd(), charterPath),
  product_md_hash: hash,
}));

// -----------------------------------------------------------------------------

function stampFrontmatter(src, kv) {
  const fmMatch = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!fmMatch) {
    const block = `---\n${formatKv(kv)}\n---\n\n`;
    return block + src;
  }
  const body = src.slice(fmMatch[0].length);
  const existing = parseSimpleYaml(fmMatch[1]);
  const merged = { ...existing, ...kv };
  return `---\n${formatKv(merged)}\n---\n${body}`;
}

function parseSimpleYaml(s) {
  const out = {};
  for (const line of s.split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function formatKv(kv) {
  return Object.entries(kv).map(([k, v]) => `${k}: ${v}`).join('\n');
}
