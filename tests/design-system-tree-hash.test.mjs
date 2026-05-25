/**
 * Tests for skill/scripts/design-system/tree-hash.mjs — determinism and
 * source-selection (git vs mtime fallback).
 *
 * Run: node --test tests/design-system-tree-hash.test.mjs
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { treeHash } from '../skill/scripts/design-system/tree-hash.mjs';

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tree-hash-'));
}

function writeTree(root, files) {
  for (const [rel, contents] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, contents);
  }
}

describe('treeHash — non-git (mtime fallback)', () => {
  it('returns a stable hash + source=mtime for an unversioned directory', () => {
    const dir = mkTmp();
    writeTree(dir, { 'a.tsx': 'export const A = () => null;\n', 'b/c.tsx': 'export const C = () => null;\n' });
    const a = treeHash(dir, { cwd: dir });
    const b = treeHash(dir, { cwd: dir });
    assert.equal(a.source, 'mtime');
    assert.equal(a.hash, b.hash);
    assert.equal(a.entry_count, 2);
  });

  it('returns a different hash when a file is added', () => {
    const dir = mkTmp();
    writeTree(dir, { 'a.tsx': 'export const A = () => null;\n' });
    const before = treeHash(dir, { cwd: dir });
    writeTree(dir, { 'b.tsx': 'export const B = () => null;\n' });
    const after = treeHash(dir, { cwd: dir });
    assert.notEqual(before.hash, after.hash);
    assert.equal(after.entry_count, 2);
  });

  it('returns a hash for a missing directory rather than throwing', () => {
    const dir = mkTmp();
    const r = treeHash(path.join(dir, 'does-not-exist'), { cwd: dir });
    assert.equal(r.entry_count, 0);
    assert.ok(typeof r.hash === 'string' && r.hash.length === 64);
  });
});

describe('treeHash — git path', () => {
  let gitDir;
  let hasGit = true;

  before(() => {
    try {
      execFileSync('git', ['--version'], { stdio: 'ignore' });
    } catch {
      hasGit = false;
    }
    if (!hasGit) return;

    gitDir = mkTmp();
    writeTree(gitDir, { 'a.tsx': 'export const A = () => null;\n' });
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: gitDir });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: gitDir });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: gitDir });
    execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: gitDir });
    execFileSync('git', ['add', '.'], { cwd: gitDir });
    execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: gitDir });
  });

  it('uses git when inside a git working tree', { skip: !hasGit }, () => {
    const r = treeHash(gitDir, { cwd: gitDir });
    assert.equal(r.source, 'git');
    assert.equal(r.entry_count, 1);
  });

  it('hash changes after a commit that adds a file', { skip: !hasGit }, () => {
    const before = treeHash(gitDir, { cwd: gitDir });
    writeTree(gitDir, { 'b.tsx': 'export const B = () => null;\n' });
    execFileSync('git', ['add', '.'], { cwd: gitDir });
    execFileSync('git', ['commit', '-q', '-m', 'add b'], { cwd: gitDir });
    const after = treeHash(gitDir, { cwd: gitDir });
    assert.notEqual(before.hash, after.hash);
    assert.equal(after.entry_count, 2);
  });

  it('returns the same hash for two calls without intervening changes', { skip: !hasGit }, () => {
    const a = treeHash(gitDir, { cwd: gitDir });
    const b = treeHash(gitDir, { cwd: gitDir });
    assert.equal(a.hash, b.hash);
  });
});
