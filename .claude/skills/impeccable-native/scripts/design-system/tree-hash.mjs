/**
 * tree-hash.mjs
 *
 * Compute a stable hash for a directory tree, used to cache the component
 * inventory and detect when re-mapping is necessary.
 *
 * Strategy:
 *   1. If the repo is a git working tree → use `git ls-tree -r HEAD <root>`
 *      and hash the output. This is robust, ignores untracked junk, and
 *      matches what's actually committed.
 *   2. Otherwise → walk the tree, collect relative-path + mtime tuples
 *      sorted lexicographically, and hash that. Less robust (mtime is
 *      filesystem-dependent) but deterministic within one machine.
 *
 * Either way, the returned value is a hex SHA-256 string. The `source`
 * field tells callers which strategy was used so they can decide whether
 * to trust cross-machine comparisons.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {string} root           — absolute or repo-relative directory
 * @param {object} [opts]
 * @param {string} [opts.cwd]     — working dir for git invocations / mtime walk root
 * @returns {{ hash: string, source: 'git' | 'mtime', entry_count: number }}
 */
export function treeHash(root, opts = {}) {
  const cwd = path.resolve(opts.cwd ?? process.cwd());
  const absRoot = path.isAbsolute(root) ? root : path.resolve(cwd, root);

  if (!fs.existsSync(absRoot)) {
    return { hash: hashOf('::missing::'), source: 'mtime', entry_count: 0 };
  }

  const gitResult = tryGitTreeHash(absRoot, cwd);
  if (gitResult) return gitResult;

  return mtimeTreeHash(absRoot);
}

function tryGitTreeHash(absRoot, cwd) {
  try {
    // Use git ls-tree to enumerate tracked files under root, scoped to HEAD.
    // We pass the path relative to the git toplevel so ls-tree resolves it.
    const toplevel = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    if (!toplevel) return null;

    // Resolve symlinks on both sides — on macOS, os.tmpdir() returns
    // /var/folders/... but git reports /private/var/folders/..., so a naive
    // path.relative() returns a ../-prefixed path and we'd incorrectly bail.
    const realToplevel = fs.realpathSync(toplevel);
    const realAbsRoot = fs.existsSync(absRoot) ? fs.realpathSync(absRoot) : absRoot;
    const rel = path.relative(realToplevel, realAbsRoot);
    // ls-tree wants a path that does not start with ../ — bail to mtime in that case.
    if (rel.startsWith('..')) return null;

    const out = execFileSync(
      'git',
      ['ls-tree', '-r', 'HEAD', '--', rel || '.'],
      { cwd: realToplevel, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' },
    );

    const lines = out.split('\n').filter(Boolean);
    return {
      hash: hashOf(out),
      source: 'git',
      entry_count: lines.length,
    };
  } catch {
    return null;
  }
}

function mtimeTreeHash(absRoot) {
  const entries = [];
  walk(absRoot, absRoot, entries);
  entries.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  const payload = entries.map(e => `${e.rel}\0${e.mtimeMs}`).join('\n');
  return { hash: hashOf(payload), source: 'mtime', entry_count: entries.length };
}

function walk(absRoot, dir, out) {
  let dirents;
  try {
    dirents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const d of dirents) {
    if (d.name === '.git' || d.name === 'node_modules' || d.name === '.DS_Store') continue;
    const full = path.join(dir, d.name);
    if (d.isDirectory()) {
      walk(absRoot, full, out);
    } else if (d.isFile()) {
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      out.push({ rel: path.relative(absRoot, full), mtimeMs: Math.floor(stat.mtimeMs) });
    }
  }
}

function hashOf(s) {
  return createHash('sha256').update(s).digest('hex');
}
