#!/usr/bin/env node

/**
 * rebrand-scan.mjs
 *
 * Orchestrator for the /impeccable-native rebrand scan sub-mode.
 * Runs the forensics pipeline (style-inventory → vibe-fingerprint →
 * incoherence-report → hardcoded-violations) and produces a unified
 * .impeccable/forensics.json + human-readable summary.
 *
 * This is Act 1 of the rebrand skill. Output is consumable on its own as a
 * standalone diagnostic ("how messy is my app actually") or used as input
 * to `rebrand direction` (Act 2: generative).
 *
 * Usage:
 *   node rebrand-scan.mjs [--dir=path] [--de=3.5]
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const args = process.argv.slice(2);
function flag(name) {
  const f = args.find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
}
const rootDir = path.resolve(flag('dir') ?? process.cwd());
const de = flag('de') ?? '3.5';

const ownDir = path.dirname(new URL(import.meta.url).pathname);
const scriptsDir = path.resolve(ownDir, '..');
const impeccableDir = path.join(rootDir, '.impeccable');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function runScript(rel, extra = []) {
  const scriptPath = path.join(scriptsDir, rel);
  const out = execFileSync(
    process.execPath,
    [scriptPath, `--dir=${rootDir}`, ...extra],
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'] }
  );
  return JSON.parse(out);
}

function write(filename, data) {
  ensureDir(impeccableDir);
  const dest = path.join(impeccableDir, filename);
  fs.writeFileSync(dest, JSON.stringify(data, null, 2) + '\n');
  return dest;
}

// ── readiness verdict ─────────────────────────────────────────────────────

function computeReadiness(inventory, fingerprint, incoherence, violations) {
  const flags = [];
  if (incoherence.summary.verdict === 'incoherent') {
    flags.push({
      kind: 'high-incoherence',
      message: `${incoherence.summary.severeCount} severe contradiction(s) in the current system. Rebrand is recommended — the existing surface is incoherent.`,
    });
  }
  if (inventory.summary.perceivedColors >= 20) {
    flags.push({
      kind: 'palette-sprawl',
      message: `${inventory.summary.perceivedColors} perceptually-distinct colors. Palette has lost shape.`,
    });
  }
  if (violations.verdict === 'severe') {
    flags.push({
      kind: 'hardcoded-violations',
      message: `${violations.totalCount} hardcoded values bypass the token system. These won't respond to rebrand unless fixed.`,
    });
  }
  if (flags.length === 0) {
    return { verdict: 'coherent-enough', flags: [], recommendation: 'The current system is more coherent than typical. Rebrand is a creative choice, not a forced one.' };
  }
  return { verdict: flags.length >= 2 ? 'rebrand-recommended' : 'consider-rebrand', flags, recommendation: 'Forensics found real signal that a rebrand would resolve.' };
}

// ── terminal summary ──────────────────────────────────────────────────────

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function verdictColor(v) {
  if (v === 'coherent-enough') return GREEN;
  if (v === 'consider-rebrand') return YELLOW;
  return RED;
}

function printSummary(forensics) {
  const { inventory, fingerprint, incoherence, violations, summary } = forensics;
  process.stdout.write('\n');
  process.stdout.write(`${BOLD}rebrand scan complete${RESET}  ·  `);
  process.stdout.write(`${inventory.summary.filesScanned} files  ·  `);
  process.stdout.write(`${inventory.summary.perceivedColors} perceived colors  ·  `);
  process.stdout.write(`${inventory.summary.perceivedFontSizes} type steps\n\n`);

  const rows = [
    ['palette', `${inventory.summary.rawColors} raw → ${inventory.summary.perceivedColors} perceived (${inventory.colors.perceptuallyDuplicateClusters} duplicate cluster${inventory.colors.perceptuallyDuplicateClusters === 1 ? '' : 's'})`],
    ['rhythm', inventory.spacings.rhythm.base ? `${inventory.spacings.rhythm.base}pt-based (${Math.round(inventory.spacings.rhythm.fit * 100)}% fit)` : 'undetectable'],
    ['radii', inventory.radii.language.dominant ?? 'no signal'],
    ['type', `${inventory.summary.perceivedFontSizes} sizes, ${inventory.summary.fontFamilyCount} famil${inventory.summary.fontFamilyCount === 1 ? 'y' : 'ies'}`],
    ['incoherence', `${incoherence.summary.findingCount} finding(s), ${incoherence.summary.severeCount} severe  ${DIM}←  ${incoherence.summary.verdict}${RESET}`],
    ['violations', `${violations.totalCount} hardcoded values  ${DIM}←  ${violations.verdict}${RESET}`],
  ];
  for (const [label, value] of rows) {
    process.stdout.write(`  ${DIM}${label.padEnd(14)}${RESET}${value}\n`);
  }

  process.stdout.write('\n');
  process.stdout.write(`  ${DIM}verdict        ${RESET}${verdictColor(summary.readinessVerdict)}${BOLD}${summary.readinessVerdict.toUpperCase()}${RESET}\n`);

  process.stdout.write('\n');
  process.stdout.write(`${BOLD}current vibe (derived):${RESET}\n`);
  for (const line of wrap(fingerprint.paragraph, 76)) {
    process.stdout.write(`  ${line}\n`);
  }

  if (summary.flags.length > 0) {
    process.stdout.write('\n');
    process.stdout.write(`${YELLOW}signals:${RESET}\n`);
    for (const f of summary.flags) process.stdout.write(`  ${RED}!${RESET}  ${f.message}\n`);
  }

  if (incoherence.findings.length > 0) {
    process.stdout.write('\n');
    process.stdout.write(`${BOLD}top contradictions:${RESET}\n`);
    for (const f of incoherence.findings.slice(0, 5)) {
      const sev = f.severity === 'severe' ? RED : YELLOW;
      process.stdout.write(`  ${sev}${f.severity.padEnd(8)}${RESET}  ${f.kind}\n`);
      process.stdout.write(`            ${DIM}${f.message}${RESET}\n`);
    }
  }

  process.stdout.write('\n');
  process.stdout.write(`  ${DIM}brief written to${RESET}  .impeccable/forensics.json\n`);
  process.stdout.write(`  ${DIM}continue with   ${RESET}  /impeccable-native rebrand direction\n`);
  process.stdout.write('\n');
}

function wrap(s, width) {
  const out = [];
  let line = '';
  for (const word of s.split(/\s+/)) {
    if ((line + ' ' + word).trim().length > width) {
      out.push(line.trim());
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) out.push(line);
  return out;
}

// ── main ──────────────────────────────────────────────────────────────────

async function run() {
  process.stderr.write('rebrand-scan: building style inventory...\n');
  const inventory = runScript('rebrand/style-inventory.mjs', [`--de=${de}`]);
  write('rebrand-style-inventory.json', inventory);

  process.stderr.write('rebrand-scan: deriving vibe fingerprint...\n');
  const fingerprint = runScript('rebrand/vibe-fingerprint.mjs');
  write('rebrand-vibe-fingerprint.json', fingerprint);

  process.stderr.write('rebrand-scan: hunting contradictions...\n');
  const incoherence = runScript('rebrand/incoherence-report.mjs');
  write('rebrand-incoherence.json', incoherence);

  // hardcoded-violations needs a scope file. Build a minimal one from
  // every source file scanned by the inventory so the violations script
  // has a target.
  process.stderr.write('rebrand-scan: scanning for hardcoded violations...\n');
  const pseudoScope = buildPseudoScope(rootDir);
  const scopePath = write('rebrand-pseudo-scope.json', pseudoScope);
  const violations = runScript('shared/hardcoded-violations.mjs', [`--scope-file=${scopePath}`]);
  write('rebrand-violations.json', violations);

  const readiness = computeReadiness(inventory, fingerprint, incoherence, violations);

  const forensics = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    inventory,
    fingerprint,
    incoherence,
    violations,
    summary: {
      filesScanned: inventory.summary.filesScanned,
      perceivedColors: inventory.summary.perceivedColors,
      perceivedFontSizes: inventory.summary.perceivedFontSizes,
      fontFamilyCount: inventory.summary.fontFamilyCount,
      dominantHueFamily: fingerprint.summary.dominantHueFamily,
      temperature: fingerprint.summary.temperature,
      density: fingerprint.summary.density,
      posture: fingerprint.summary.posture,
      era: fingerprint.summary.era,
      convention: fingerprint.summary.convention,
      incoherenceFindings: incoherence.summary.findingCount,
      severeContradictions: incoherence.summary.severeCount,
      hardcodedViolations: violations.totalCount,
      readinessVerdict: readiness.verdict,
      flags: readiness.flags,
      recommendation: readiness.recommendation,
    },
  };

  write('forensics.json', forensics);
  printSummary(forensics);
  process.exit(0);
}

// Build a pseudo-scope file that covers every source file in the project.
// hardcoded-violations expects a migration-scope.json shape with screens/components arrays.
function buildPseudoScope(root) {
  const IGNORE = new Set([
    'node_modules', '.git', 'dist', 'build', '.expo', '.metro-cache',
    'android', 'ios', '__generated__', 'coverage', '.impeccable',
  ]);
  const files = [];
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (IGNORE.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|jsx?)$/.test(entry.name)) files.push(path.relative(root, full));
    }
  };
  walk(root);
  return {
    scope: { raw: 'app (rebrand pseudo-scope)', kind: 'app' },
    screens: files.map(f => ({ file: f })),
    components: [],
    summary: { screenCount: files.length, componentCount: 0 },
  };
}

try { await run(); }
catch (err) {
  process.stderr.write(`rebrand-scan: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
