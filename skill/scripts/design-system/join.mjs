#!/usr/bin/env node

/**
 * join.mjs
 *
 * Reads DESIGN-SYSTEM.md (charter) + inventory.json (components) and emits
 * a single markdown document — `join.md` — with two tables side by side:
 *
 *   1. Slots table        (what we need, with stable slot IDs)
 *   2. Components table   (what we have, with stable component IDs)
 *
 * No judgment is computed here. The output is the *substrate* the model
 * reads in Act 3 to write verdicts. Stable IDs let the model reference
 * rows precisely in its judgment.
 *
 * Usage:
 *   node join.mjs --charter=DESIGN-SYSTEM.md --inventory=.impeccable/design-system/inventory.json --out=.impeccable/design-system/join.md
 */

import fs from 'node:fs';
import path from 'node:path';

function flag(name) {
  const f = process.argv.slice(2).find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
}

const charterPath = path.resolve(flag('charter') ?? 'DESIGN-SYSTEM.md');
const inventoryPath = path.resolve(flag('inventory') ?? '.impeccable/design-system/inventory.json');
const outPath = path.resolve(flag('out') ?? '.impeccable/design-system/join.md');

if (!fs.existsSync(charterPath)) {
  process.stderr.write(`join.mjs: charter not found at ${charterPath}\n`);
  process.exit(2);
}

const charterRaw = fs.readFileSync(charterPath, 'utf8');
const slots = parseSlots(charterRaw);

let inventory = { components: [], roots: [] };
if (fs.existsSync(inventoryPath)) {
  try {
    inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  } catch (err) {
    process.stderr.write(`join.mjs: could not parse inventory.json: ${err.message}\n`);
  }
}

const isGreenfield = (inventory.components ?? []).length === 0;

const lines = [];
lines.push('# Design System — Slots × Components Join');
lines.push('');
lines.push(`Generated at ${new Date().toISOString()}.`);
lines.push('');
lines.push('This document is the substrate for Act 3 judgment. It does *not* contain verdicts — only facts.');
lines.push('');

lines.push('## Slots');
lines.push('');
if (slots.length === 0) {
  lines.push('_No slots are defined in the charter yet. Co-author the charter (Act 1) before requesting a judgment._');
} else {
  lines.push('| slot_id | interaction_kind | journey_phase | purpose | success_criteria |');
  lines.push('|---|---|---|---|---|');
  for (const s of slots) {
    lines.push(`| \`${s.id}\` | ${s.interaction_kind} | ${s.journey_phase} | ${escapeCell(s.purpose)} | ${escapeCell(s.success_criteria)} |`);
  }
}
lines.push('');

lines.push('## Components');
lines.push('');
if (isGreenfield) {
  lines.push('_Greenfield repo — no components in inventory. The judgment in Act 3 should propose new components for unfilled slots._');
} else {
  lines.push('| component_id | file | kind_guess | exports | prop_count | imports | imported_by |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const c of inventory.components) {
    const exports = c.exports.map(e => `${e.name}${e.kind === 'default' ? ' (default)' : ''}`).join(', ');
    lines.push(
      `| \`${c.id}\` | \`${c.file}\` | ${c.kind_guess} | ${escapeCell(exports)} | ${c.props.length} | ${c.imports_components.length} | ${c.imported_by_count} |`,
    );
  }
}
lines.push('');

lines.push('## How to read this');
lines.push('');
lines.push('- Each `slot_id` is a row the system must answer for. A slot can be: **filled** by one component, **over-served** by multiple, **partially** served (component exists but is inadequate), or **unfilled**.');
lines.push('- Each `component_id` is a row that must justify its existence. A component can: **earn-place** (cleanly serves a slot), be **mis-purposed**, **redundant** with another, an **orphan** (serves no slot), or a **merge-candidate**.');
lines.push('- The model writes verdicts into `judgment.md` / `judgment.json`, referencing these IDs.');

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join('\n') + '\n');

process.stdout.write(JSON.stringify({
  status: 'written',
  path: path.relative(process.cwd(), outPath),
  slot_count: slots.length,
  component_count: (inventory.components ?? []).length,
  greenfield: isGreenfield,
}));

// -----------------------------------------------------------------------------

function parseSlots(md) {
  // Find the "Slots" section, then the first markdown table inside it.
  const sectionMatch = md.match(/##\s+Slots\s*\n([\s\S]*?)(?:\n##\s|\n*$)/);
  if (!sectionMatch) return [];
  const section = sectionMatch[1];

  const tableLines = [];
  let inTable = false;
  for (const line of section.split('\n')) {
    if (line.startsWith('|')) {
      tableLines.push(line);
      inTable = true;
    } else if (inTable && line.trim() === '') {
      break;
    }
  }
  if (tableLines.length < 3) return []; // header + separator + at least one row

  const headers = tableLines[0].split('|').map(s => s.trim()).filter(Boolean);
  const rows = tableLines.slice(2);
  const slots = [];
  for (const row of rows) {
    const cells = row.split('|').map(s => s.trim());
    // Leading/trailing empty cells from outer pipes
    if (cells[0] === '') cells.shift();
    if (cells[cells.length - 1] === '') cells.pop();
    if (cells.length < headers.length) continue;
    const obj = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = cells[i] ?? '';
    // Skip example/placeholder rows (italicized id like _example-foo_)
    if (/^_.*_$/.test(obj.id ?? '')) continue;
    if (!obj.id) continue;
    slots.push({
      id: stripBackticks(obj.id),
      interaction_kind: obj.interaction_kind ?? '',
      journey_phase: obj.journey_phase ?? '',
      purpose: obj.purpose ?? '',
      success_criteria: obj.success_criteria ?? '',
      notes: obj.notes ?? '',
    });
  }
  return slots;
}

function stripBackticks(s) {
  return s.replace(/^`(.*)`$/, '$1');
}

function escapeCell(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
