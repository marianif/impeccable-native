/**
 * Tests for skill/scripts/design-system/inventory.mjs — verifies regex-based
 * extraction produces the expected facts (exports, props, kind_guess, import
 * graph) on a small synthetic fixture.
 *
 * Run: node --test tests/design-system-inventory.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INVENTORY = path.resolve(__dirname, '../skill/scripts/design-system/inventory.mjs');

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-'));
}

function writeTree(root, files) {
  for (const [rel, contents] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, contents);
  }
}

function runInventory(dir, extraArgs = []) {
  const out = execFileSync(process.execPath, [INVENTORY, `--dir=${dir}`, ...extraArgs], {
    encoding: 'utf8',
    cwd: dir,
  });
  return JSON.parse(out);
}

function readInventory(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.impeccable/design-system/inventory.json'), 'utf8'));
}

describe('inventory.mjs — basic extraction', () => {
  it('finds exported components with named + default exports', () => {
    const dir = mkTmp();
    writeTree(dir, {
      'src/components/Button.tsx': `
import React from 'react';
type ButtonProps = { label: string; onPress?: () => void };
export function Button({ label, onPress }: ButtonProps) {
  return <button onClick={onPress}>{label}</button>;
}
export default Button;
`,
      'src/components/Card.tsx': `
import React from 'react';
type CardProps = { title: string; subtitle?: string; elevated?: boolean };
export const Card = (props: CardProps) => <div>{props.title}</div>;
`,
    });

    const result = runInventory(dir, ['--roots=src/components']);
    assert.equal(result.status, 'written');
    assert.equal(result.component_count, 2);

    const inv = readInventory(dir);
    const ids = inv.components.map(c => c.id).sort();
    assert.deepEqual(ids, ['src/components/Button', 'src/components/Card']);

    const button = inv.components.find(c => c.rel === 'Button.tsx');
    assert.ok(button.exports.some(e => e.name === 'Button' && e.kind === 'named'));
    assert.ok(button.exports.some(e => e.name === 'Button' && e.kind === 'default') || button.exports.some(e => e.kind === 'default'));

    const buttonProps = button.props.map(p => p.name).sort();
    assert.deepEqual(buttonProps, ['label', 'onPress']);
    const onPress = button.props.find(p => p.name === 'onPress');
    assert.equal(onPress.optional, true);
  });

  it('skips test, story, and .d.ts files', () => {
    const dir = mkTmp();
    writeTree(dir, {
      'src/components/Real.tsx': `import React from 'react'; export function Real(){ return <div/>; }`,
      'src/components/Real.test.tsx': `it('does nothing', () => {});`,
      'src/components/Real.stories.tsx': `export default {}; export const Default = () => null;`,
      'src/components/types.d.ts': `export type X = string;`,
    });
    runInventory(dir, ['--roots=src/components']);
    const inv = readInventory(dir);
    assert.equal(inv.components.length, 1);
    assert.equal(inv.components[0].rel, 'Real.tsx');
  });

  it('detects atom/molecule/organism by folder convention', () => {
    const dir = mkTmp();
    writeTree(dir, {
      'src/components/atoms/Spacer.tsx': `import React from 'react'; export const Spacer = () => <div/>;`,
      'src/components/molecules/Field.tsx': `import React from 'react'; export const Field = () => <div><label/><input/></div>;`,
      'src/components/organisms/Header.tsx': `import React from 'react';
export const Header = () => (
  <header><Logo/><Nav/><Search/><User/></header>
);`,
    });
    runInventory(dir, ['--roots=src/components']);
    const inv = readInventory(dir);
    const byRel = Object.fromEntries(inv.components.map(c => [c.rel, c.kind_guess]));
    assert.equal(byRel['atoms/Spacer.tsx'], 'atom');
    assert.equal(byRel['molecules/Field.tsx'], 'molecule');
    assert.equal(byRel['organisms/Header.tsx'], 'organism');
  });

  it('resolves relative imports between inventoried components and counts importers', () => {
    const dir = mkTmp();
    writeTree(dir, {
      'src/components/Button.tsx': `import React from 'react'; export const Button = () => <button/>;`,
      'src/components/Card.tsx': `import React from 'react';
import { Button } from './Button';
export const Card = () => <div><Button/></div>;`,
    });
    runInventory(dir, ['--roots=src/components']);
    const inv = readInventory(dir);

    const button = inv.components.find(c => c.rel === 'Button.tsx');
    const card = inv.components.find(c => c.rel === 'Card.tsx');
    assert.deepEqual(card.imports_components, [button.id]);
    assert.equal(button.imported_by_count, 1);
    assert.equal(card.imported_by_count, 0);
  });

  it('stamps tree-hashes per root and short-circuits when cache is fresh', () => {
    const dir = mkTmp();
    writeTree(dir, {
      'src/components/Button.tsx': `import React from 'react'; export const Button = () => <button/>;`,
    });
    const first = runInventory(dir, ['--roots=src/components']);
    assert.equal(first.status, 'written');

    const second = runInventory(dir, ['--roots=src/components']);
    assert.equal(second.status, 'cache-fresh');
  });

  it('re-runs when --force is passed even if the tree is unchanged', () => {
    const dir = mkTmp();
    writeTree(dir, {
      'src/components/Button.tsx': `import React from 'react'; export const Button = () => <button/>;`,
    });
    runInventory(dir, ['--roots=src/components']);
    const second = runInventory(dir, ['--roots=src/components', '--force']);
    assert.equal(second.status, 'written');
  });

  it('ignores non-React .ts utility files', () => {
    const dir = mkTmp();
    writeTree(dir, {
      'src/components/Button.tsx': `import React from 'react'; export const Button = () => <button/>;`,
      'src/components/utils.ts': `export function add(a: number, b: number) { return a + b; }`,
    });
    runInventory(dir, ['--roots=src/components']);
    const inv = readInventory(dir);
    assert.equal(inv.components.length, 1);
  });
});
