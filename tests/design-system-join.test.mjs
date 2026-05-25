/**
 * Tests for skill/scripts/design-system/join.mjs — verifies the slot parser
 * handles a real-shaped charter and that the emitted join.md contains both
 * tables with stable IDs.
 *
 * Run: node --test tests/design-system-join.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JOIN = path.resolve(__dirname, '../skill/scripts/design-system/join.mjs');

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'join-'));
}

function runJoin(dir, args) {
  const out = execFileSync(process.execPath, [JOIN, ...args], { encoding: 'utf8', cwd: dir });
  return JSON.parse(out);
}

const CHARTER_WITH_TWO_SLOTS = `---
derived_from_product_md_hash: deadbeef
---

# Design System Charter

Some prose.

## Slots

| id | interaction_kind | journey_phase | purpose | success_criteria | notes |
|---|---|---|---|---|---|
| _example-foo_ | confirm | commit | _example placeholder_ | _ignore me_ | _example row_ |
| commit-confirm | confirm | commit | Make user pause before irreversible action | One-tap dismiss; visible until acknowledged | Used in checkout |
| browse-empty | inform | browse | Communicate when a list has no items | Reads in <2s; offers next action | |

## Vocabulary

Some other section.
`;

const INVENTORY_TWO_COMPONENTS = {
  generated_at: '2026-05-25T00:00:00Z',
  roots: ['src/components'],
  tree_hashes: { 'src/components': { hash: 'abc', source: 'git', entry_count: 2 } },
  components: [
    {
      id: 'src/components/Button',
      file: 'src/components/Button.tsx',
      root: 'src/components',
      rel: 'Button.tsx',
      exports: [{ name: 'Button', kind: 'named' }],
      props: [{ name: 'label', optional: false, type_text: 'string' }],
      kind_guess: 'atom',
      last_touched: '2026-05-20T00:00:00Z',
      imports_components: [],
      imported_by_count: 3,
    },
    {
      id: 'src/components/EmptyState',
      file: 'src/components/EmptyState.tsx',
      root: 'src/components',
      rel: 'EmptyState.tsx',
      exports: [{ name: 'EmptyState', kind: 'named' }],
      props: [],
      kind_guess: 'molecule',
      last_touched: '2026-05-19T00:00:00Z',
      imports_components: ['src/components/Button'],
      imported_by_count: 0,
    },
  ],
};

describe('join.mjs — slot parsing', () => {
  it('parses real slot rows and skips italicized example rows', () => {
    const dir = mkTmp();
    fs.writeFileSync(path.join(dir, 'DESIGN-SYSTEM.md'), CHARTER_WITH_TWO_SLOTS);
    fs.mkdirSync(path.join(dir, '.impeccable/design-system'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, '.impeccable/design-system/inventory.json'),
      JSON.stringify(INVENTORY_TWO_COMPONENTS),
    );

    const result = runJoin(dir, [
      `--charter=${path.join(dir, 'DESIGN-SYSTEM.md')}`,
      `--inventory=${path.join(dir, '.impeccable/design-system/inventory.json')}`,
      `--out=${path.join(dir, '.impeccable/design-system/join.md')}`,
    ]);
    assert.equal(result.status, 'written');
    assert.equal(result.slot_count, 2, 'example row should be skipped');
    assert.equal(result.component_count, 2);
    assert.equal(result.greenfield, false);
  });

  it('emits both tables with stable IDs', () => {
    const dir = mkTmp();
    fs.writeFileSync(path.join(dir, 'DESIGN-SYSTEM.md'), CHARTER_WITH_TWO_SLOTS);
    fs.mkdirSync(path.join(dir, '.impeccable/design-system'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, '.impeccable/design-system/inventory.json'),
      JSON.stringify(INVENTORY_TWO_COMPONENTS),
    );

    runJoin(dir, [
      `--charter=${path.join(dir, 'DESIGN-SYSTEM.md')}`,
      `--inventory=${path.join(dir, '.impeccable/design-system/inventory.json')}`,
      `--out=${path.join(dir, '.impeccable/design-system/join.md')}`,
    ]);

    const joinMd = fs.readFileSync(path.join(dir, '.impeccable/design-system/join.md'), 'utf8');
    assert.match(joinMd, /## Slots/);
    assert.match(joinMd, /## Components/);
    assert.match(joinMd, /`commit-confirm`/);
    assert.match(joinMd, /`browse-empty`/);
    assert.match(joinMd, /`src\/components\/Button`/);
    assert.match(joinMd, /`src\/components\/EmptyState`/);
    assert.doesNotMatch(joinMd, /example-foo/);
  });
});

describe('join.mjs — greenfield handling', () => {
  it('marks the output as greenfield when inventory has no components', () => {
    const dir = mkTmp();
    fs.writeFileSync(path.join(dir, 'DESIGN-SYSTEM.md'), CHARTER_WITH_TWO_SLOTS);
    fs.mkdirSync(path.join(dir, '.impeccable/design-system'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, '.impeccable/design-system/inventory.json'),
      JSON.stringify({ ...INVENTORY_TWO_COMPONENTS, components: [] }),
    );

    const result = runJoin(dir, [
      `--charter=${path.join(dir, 'DESIGN-SYSTEM.md')}`,
      `--inventory=${path.join(dir, '.impeccable/design-system/inventory.json')}`,
      `--out=${path.join(dir, '.impeccable/design-system/join.md')}`,
    ]);
    assert.equal(result.greenfield, true);
    const joinMd = fs.readFileSync(path.join(dir, '.impeccable/design-system/join.md'), 'utf8');
    assert.match(joinMd, /Greenfield repo/);
  });

  it('handles missing inventory.json as greenfield', () => {
    const dir = mkTmp();
    fs.writeFileSync(path.join(dir, 'DESIGN-SYSTEM.md'), CHARTER_WITH_TWO_SLOTS);

    const result = runJoin(dir, [
      `--charter=${path.join(dir, 'DESIGN-SYSTEM.md')}`,
      `--inventory=${path.join(dir, '.impeccable/design-system/inventory.json')}`,
      `--out=${path.join(dir, '.impeccable/design-system/join.md')}`,
    ]);
    assert.equal(result.greenfield, true);
    assert.equal(result.component_count, 0);
  });
});
