#!/usr/bin/env node
/**
 * release.mjs
 *
 * One-shot release: bump version, build, commit, tag, push, GitHub release.
 *
 * Usage:
 *   node scripts/release.mjs <patch|minor|major|x.y.z> [--dry-run]
 *
 * What it does:
 *   1. Computes the new version
 *   2. Bumps package.json, .claude-plugin/plugin.json, .claude-plugin/marketplace.json
 *   3. Runs node scripts/build.js
 *   4. Stages all changes and creates a commit: "chore: release vX.Y.Z"
 *   5. Creates an annotated git tag vX.Y.Z
 *   6. Pushes commit + tag to origin
 *   7. Creates a GitHub release via `gh`
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const bumpArg = args.find(a => !a.startsWith('--'));

if (!bumpArg) {
  console.error('usage: node scripts/release.mjs <patch|minor|major|x.y.z> [--dry-run]');
  process.exit(1);
}

// ── helpers ────────────────────────────────────────────────────────────────

function fail(msg) { console.error(`✗  ${msg}`); process.exit(1); }
function ok(msg)   { console.log(`✓  ${msg}`); }
function step(msg) { console.log(`\n→  ${msg}`); }

function run(cmd) {
  return execSync(cmd, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function exec(cmd) {
  if (dryRun) { console.log(`   [dry-run] ${cmd}`); return; }
  execSync(cmd, { cwd: repoRoot, stdio: 'inherit' });
}

function readJson(rel) {
  return JSON.parse(readFileSync(path.join(repoRoot, rel), 'utf-8'));
}

function writeJson(rel, data) {
  if (dryRun) { console.log(`   [dry-run] write ${rel}`); return; }
  writeFileSync(path.join(repoRoot, rel), JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// ── version bump ───────────────────────────────────────────────────────────

function bumpVersion(current, bump) {
  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump;
  const [major, minor, patch] = current.split('.').map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`;
  fail(`Unknown bump type "${bump}". Use patch, minor, major, or x.y.z`);
}

// ── pre-flight ─────────────────────────────────────────────────────────────

step('Checking working tree');
const dirty = run('git status --porcelain');
if (dirty) fail(`Working tree is dirty. Commit or stash first:\n${dirty}`);
ok('clean');

step('Checking gh is available');
try { run('gh --version'); ok('gh found'); }
catch { fail('GitHub CLI (gh) not found. Install it: https://cli.github.com'); }

// ── compute new version ────────────────────────────────────────────────────

step('Computing version');
const pkg = readJson('package.json');
const currentVersion = pkg.version;
const newVersion = bumpVersion(currentVersion, bumpArg);
ok(`${currentVersion} → ${newVersion}`);
const tag = `v${newVersion}`;

step(`Verifying tag ${tag} is free`);
const remoteTags = run('git ls-remote --tags origin');
if (remoteTags.split('\n').some(l => l.endsWith(`refs/tags/${tag}`))) {
  fail(`Tag ${tag} already exists on origin.`);
}
try { run(`git rev-parse -q --verify "refs/tags/${tag}"`); fail(`Tag ${tag} already exists locally.`); }
catch (e) { if (e.status === 0) fail(`Tag ${tag} already exists locally.`); }
ok('tag is free');

// ── bump manifests ─────────────────────────────────────────────────────────

step('Bumping version in manifests');

pkg.version = newVersion;
writeJson('package.json', pkg);
ok('package.json');

const pluginJson = readJson('.claude-plugin/plugin.json');
pluginJson.version = newVersion;
writeJson('.claude-plugin/plugin.json', pluginJson);
ok('.claude-plugin/plugin.json');

const marketplaceJson = readJson('.claude-plugin/marketplace.json');
if (marketplaceJson.plugins?.[0]?.version !== undefined) {
  marketplaceJson.plugins[0].version = newVersion;
}
writeJson('.claude-plugin/marketplace.json', marketplaceJson);
ok('.claude-plugin/marketplace.json');

// ── build ──────────────────────────────────────────────────────────────────

step('Building');
exec('node scripts/build.js');
ok('build complete');

// ── commit ─────────────────────────────────────────────────────────────────

step('Committing');
exec('git add package.json .claude-plugin/plugin.json .claude-plugin/marketplace.json .claude/ .cursor/');
exec(`git commit -m "chore: release ${tag}"`);
ok(`committed: chore: release ${tag}`);

// ── tag ────────────────────────────────────────────────────────────────────

step(`Tagging ${tag}`);
exec(`git tag -a ${tag} -m "Release ${tag}"`);
ok(tag);

// ── push ───────────────────────────────────────────────────────────────────

step('Pushing to origin');
const branch = run('git rev-parse --abbrev-ref HEAD');
exec(`git push origin ${branch} ${tag}`);
ok(`pushed ${branch} + ${tag}`);

// ── github release ─────────────────────────────────────────────────────────

step('Creating GitHub release');
exec(`gh release create ${tag} --title "Release ${tag}" --generate-notes`);
ok(`GitHub release ${tag} created`);

console.log(`\n✓  impeccable-native ${newVersion} shipped`);
if (dryRun) console.log('\n   (dry-run: no files changed, no git operations performed)');
