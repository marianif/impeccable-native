#!/usr/bin/env node

/**
 * design-system-scan.mjs
 *
 * Orchestrator for /impeccable-native design-system Act 1.
 * Runs the forensics pipeline:
 *
 *   1. component-inventory.mjs    — every component: props, composition, usage, kind
 *   2. duplication-report.mjs     — clusters of likely-duplicate components
 *   3. dead-code-report.mjs       — directly + transitively dead, test-only
 *   4. composition-patterns.mjs   — implicit organisms (repeated JSX shapes in screens)
 *   5. app-anatomy.mjs            — screens, journeys, goals, personas (PRODUCT.md)
 *   6. screen-choreography.mjs    — per-screen regions, occupants, entries, exits
 *
 * Writes per-script artifacts to .impeccable/ and a unified
 * .impeccable/design-system-forensics.json plus a terminal summary that
 * mirrors rebrand-scan's style.
 *
 * Brownfield-aware: if no `components/` dir is found, skips scripts 1–4 and
 * runs only 5–6 (projecting choreography from PRODUCT.md instead of observing
 * it from code). Scope marker `mode: greenfield | brownfield` records which.
 *
 * Usage:
 *   node design-system-scan.mjs [--dir=path]
 *                                [--components-dir=components,src/components,app/components]
 *                                [--screens-dir=screens,app,src/screens]
 *                                [--product=PRODUCT.md]
 *                                [--brief=.impeccable/brand-brief.json]
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
const componentsDirs = flag('components-dir') ?? 'components,src/components,app/components';
const screensDirs = flag('screens-dir') ?? 'screens,app,src/screens';
const productPath = flag('product') ?? 'PRODUCT.md';
const briefPath = flag('brief') ?? '.impeccable/brand-brief.json';

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
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 }
  );
  return JSON.parse(out);
}

function write(filename, data) {
  ensureDir(impeccableDir);
  const dest = path.join(impeccableDir, filename);
  fs.writeFileSync(dest, JSON.stringify(data, null, 2) + '\n');
  return dest;
}

function existsAnyComponentsDir() {
  for (const dir of componentsDirs.split(',').map(s => s.trim()).filter(Boolean)) {
    const full = path.join(rootDir, dir);
    try { if (fs.statSync(full).isDirectory()) return true; } catch {}
  }
  return false;
}

function hasComponentsByTree(tree) {
  return (tree?.roots?.components?.length ?? 0) > 0;
}

function loadBriefIfPresent() {
  const full = path.isAbsolute(briefPath) ? briefPath : path.join(rootDir, briefPath);
  try {
    if (fs.statSync(full).isFile()) {
      return { path: path.relative(rootDir, full), data: JSON.parse(fs.readFileSync(full, 'utf-8')) };
    }
  } catch {}
  return null;
}

// ── readiness verdict ─────────────────────────────────────────────────────

function computeReadiness({ directoryTree, inventory, duplication, deadCode, patterns, anatomy, choreography, brief, mode }) {
  const flags = [];

  if (!brief) {
    flags.push({
      kind: 'no-brand-brief',
      message: `No brand-brief.json found at ${briefPath}. design-system needs the brief to anchor every component to a vibe trait. Run /impeccable-native rebrand first, or hand-author a minimal brief.`,
    });
  }

  if (mode === 'brownfield') {
    // Directory-tree gaps: folders the agent should ask the user about, and
    // folders that look component-shaped but the parser couldn't find a
    // component in (re-exports, wrapper chains).
    const clarifyCount = directoryTree?.needsClarification?.length ?? 0;
    if (clarifyCount > 0) {
      flags.push({
        kind: 'unknown-folders',
        message: `${clarifyCount} folder(s) under a components root that don't match a known pattern (atoms/molecules/organisms). Act 2 should ask the user once what each represents.`,
      });
    }
    const missingFolders = inventory?.summary?.missingComponentFolders ?? 0;
    if (missingFolders > 0) {
      flags.push({
        kind: 'parser-misses',
        message: `${missingFolders} component folder(s) found by the directory scan yielded zero detected components. Likely re-export patterns or unsupported wrapper chains — Act 2 should investigate before proposing cleanup.`,
      });
    }
    const conflicts = inventory?.summary?.kindConflicts ?? 0;
    if (conflicts > 0) {
      flags.push({
        kind: 'kind-conflicts',
        message: `${conflicts} component(s) sit in a folder that disagrees with their structural signature (e.g. a file in organisms/ whose code looks atomic). Either misfiled, under-implemented, or a thin wrapper that delegates — worth a look in Act 2.`,
      });
    }

    const componentCount = inventory?.summary?.componentCount ?? 0;
    const deadTotal = deadCode?.summary?.totalDeadOrTestOnly ?? 0;
    if (componentCount > 0 && deadTotal / componentCount >= 0.2) {
      flags.push({
        kind: 'dead-weight',
        message: `${deadTotal} / ${componentCount} components are dead or test-only (${Math.round((deadTotal / componentCount) * 100)}%). Cleanup should land before new organisms.`,
      });
    }
    if ((duplication?.summary?.clusterCount ?? 0) >= 3) {
      flags.push({
        kind: 'duplication-sprawl',
        message: `${duplication.summary.clusterCount} duplication cluster(s) detected. Merge analysis is the first job of Act 2.`,
      });
    }
    if ((patterns?.summary?.crossScreenCandidates ?? 0) >= 3) {
      flags.push({
        kind: 'implicit-organisms',
        message: `${patterns.summary.crossScreenCandidates} cross-screen organism candidate(s) found — Act 2 should evaluate each against the five-question gate.`,
      });
    }
  }

  const anatomyOk = (anatomy?.summary?.journeyCount ?? 0) > 0 && (anatomy?.summary?.goalCount ?? 0) > 0;
  if (!anatomyOk) {
    flags.push({
      kind: 'thin-product-doc',
      message: 'PRODUCT.md is missing journeys or goals. Strategy-driven organism proposals (Pass B) will be weak without them.',
    });
  }

  let verdict;
  if (flags.some(f => f.kind === 'no-brand-brief')) verdict = 'blocked';
  else if (flags.length === 0) verdict = 'ready';
  else if (flags.length >= 3) verdict = 'cleanup-first';
  else verdict = 'proceed-with-care';

  return { verdict, flags };
}

// ── terminal summary ──────────────────────────────────────────────────────

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

function verdictColor(v) {
  if (v === 'ready') return GREEN;
  if (v === 'proceed-with-care') return YELLOW;
  return RED;
}

function printSummary(forensics) {
  const { mode, directoryTree, inventory, duplication, deadCode, patterns, anatomy, choreography, brief, summary } = forensics;

  process.stdout.write('\n');
  process.stdout.write(`${BOLD}design-system scan complete${RESET}  ·  mode: ${mode}\n\n`);

  if (mode === 'brownfield') {
    const conv = directoryTree?.conventions ?? {};
    const conventionsSummary = [
      conv.atomicDesign ? 'atomic-design' : null,
      conv.componentPerFolder ? 'component-per-folder' : null,
      conv.barrelExports ? 'barrels' : null,
      conv.testColocation ? 'tests-colocated' : null,
      conv.namingConvention && conv.namingConvention !== 'mixed' ? conv.namingConvention : null,
    ].filter(Boolean).join(', ') || 'no recognized conventions';
    const treeSummary = `${directoryTree?.summary?.componentFolderCount ?? 0} component folder(s)  ·  ${conventionsSummary}`;
    const rows = [
      ['tree', treeSummary],
      ['components', `${inventory.summary.componentCount} total  ·  ${JSON.stringify(inventory.summary.byKindGuess).replace(/[{}"]/g, '').replace(/,/g, ', ')}${summary.kindConflicts > 0 ? `  ·  ${summary.kindConflicts} kind-conflict(s)` : ''}${summary.missingComponentFolders > 0 ? `  ·  ${summary.missingComponentFolders} missing` : ''}`],
      ['duplication', `${duplication.summary.clusterCount} cluster(s), ${duplication.summary.duplicatedComponentCount} component(s) implicated`],
      ['dead code', `${deadCode.summary.deadCount} dead  ·  ${deadCode.summary.transitivelyDeadCount} transitively dead  ·  ${deadCode.summary.testOnlyCount} test-only`],
      ['candidates', `${patterns.summary.candidateCount} organism candidate(s)  ·  ${patterns.summary.crossScreenCandidates} cross-screen  ·  ${patterns.summary.rawPatternCount} raw patterns considered`],
      ['screens', `${anatomy.summary.screenCount} screen(s), ${anatomy.summary.routedScreens} routed`],
      ['journeys', `${anatomy.summary.journeyCount} journey(s), ${anatomy.summary.goalCount} goal(s)`],
      ['choreography', `${choreography.summary.screenCount} screen(s) mapped  ·  regions: ${choreography.summary.regionsUsed.join(', ') || '(none detected)'}`],
    ];
    for (const [label, value] of rows) {
      process.stdout.write(`  ${DIM}${label.padEnd(14)}${RESET}${value}\n`);
    }
  } else {
    const rows = [
      ['mode', 'greenfield — no components dir found'],
      ['screens', `${anatomy.summary.screenCount} screen(s) (projected from filesystem)`],
      ['journeys', `${anatomy.summary.journeyCount} journey(s), ${anatomy.summary.goalCount} goal(s) from ${anatomy.summary.productDoc ?? 'PRODUCT.md (missing)'}`],
    ];
    for (const [label, value] of rows) {
      process.stdout.write(`  ${DIM}${label.padEnd(14)}${RESET}${value}\n`);
    }
  }

  process.stdout.write('\n');
  process.stdout.write(`  ${DIM}brand brief    ${RESET}${brief ? brief.path : `${RED}MISSING${RESET} (${briefPath})`}\n`);
  process.stdout.write(`  ${DIM}verdict        ${RESET}${verdictColor(summary.verdict)}${BOLD}${summary.verdict.toUpperCase()}${RESET}\n`);

  if (summary.flags.length > 0) {
    process.stdout.write('\n');
    process.stdout.write(`${YELLOW}signals:${RESET}\n`);
    for (const f of summary.flags) {
      const color = f.kind === 'no-brand-brief' ? RED : YELLOW;
      process.stdout.write(`  ${color}!${RESET}  ${f.message}\n`);
    }
  }

  if (mode === 'brownfield' && duplication.clusters?.length > 0) {
    process.stdout.write('\n');
    process.stdout.write(`${BOLD}top duplication clusters:${RESET}\n`);
    for (const c of duplication.clusters.slice(0, 5)) {
      process.stdout.write(`  ${c.members.map(m => m.name).join(' / ')}  ${DIM}(${c.memberCount} members, ${c.totalUsage} total uses)${RESET}\n`);
      process.stdout.write(`    ${DIM}shared job guess: ${c.jobGuess}${RESET}\n`);
    }
  }

  if (mode === 'brownfield' && patterns.candidates?.length > 0) {
    process.stdout.write('\n');
    process.stdout.write(`${BOLD}top organism candidates:${RESET}\n`);
    for (const c of patterns.candidates.slice(0, 5)) {
      process.stdout.write(`  ${c.label}  ${DIM}(${c.occurrenceCount}× across ${c.screenSpread} screen${c.screenSpread === 1 ? '' : 's'})${RESET}\n`);
      process.stdout.write(`    ${DIM}signals: ${c.interactionSignals.join(', ') || 'none'}  ·  job guess: ${c.jobGuess}${RESET}\n`);
    }
  }

  process.stdout.write('\n');
  process.stdout.write(`  ${DIM}scope written to${RESET}  .impeccable/design-system-forensics.json\n`);
  process.stdout.write(`  ${DIM}continue with   ${RESET}  /impeccable-native design-system plan\n`);
  process.stdout.write('\n');
}

// ── main ──────────────────────────────────────────────────────────────────

async function run() {
  const brief = loadBriefIfPresent();

  // First: map the codebase shape. Every other script reads this.
  process.stderr.write('design-system-scan: mapping directory tree...\n');
  const directoryTree = runScript('design-system/directory-tree.mjs');
  const directoryTreePath = write('ds-directory-tree.json', directoryTree);

  // Brownfield = tree found actual component roots. Fall back to the legacy
  // path-existence check only if the tree somehow returned nothing useful.
  const hasComponents = hasComponentsByTree(directoryTree) || existsAnyComponentsDir();
  const mode = hasComponents ? 'brownfield' : 'greenfield';

  let inventory = null, duplication = null, deadCode = null, patterns = null;

  if (mode === 'brownfield') {
    process.stderr.write('design-system-scan: cataloguing components...\n');
    inventory = runScript('design-system/component-inventory.mjs', [
      `--tree=${directoryTreePath}`,
      `--components-dir=${componentsDirs}`, `--screens-dir=${screensDirs}`,
    ]);
    const inventoryPath = write('ds-component-inventory.json', inventory);

    process.stderr.write('design-system-scan: clustering duplications...\n');
    duplication = runScript('design-system/duplication-report.mjs', [`--inventory=${inventoryPath}`]);
    write('ds-duplication.json', duplication);

    process.stderr.write('design-system-scan: finding dead code...\n');
    deadCode = runScript('design-system/dead-code-report.mjs', [`--inventory=${inventoryPath}`]);
    write('ds-dead-code.json', deadCode);

    process.stderr.write('design-system-scan: harvesting implicit organisms...\n');
    patterns = runScript('design-system/composition-patterns.mjs', [
      `--tree=${directoryTreePath}`, `--screens-dir=${screensDirs}`,
    ]);
    write('ds-composition-patterns.json', patterns);
  } else {
    process.stderr.write('design-system-scan: greenfield mode — skipping component inventory.\n');
  }

  process.stderr.write('design-system-scan: reading app anatomy...\n');
  const anatomy = runScript('design-system/app-anatomy.mjs', [
    `--tree=${directoryTreePath}`, `--product=${productPath}`, `--screens-dir=${screensDirs}`,
  ]);
  write('ds-app-anatomy.json', anatomy);

  process.stderr.write('design-system-scan: mapping screen choreography...\n');
  const choreography = runScript('design-system/screen-choreography.mjs', [
    `--tree=${directoryTreePath}`, `--screens-dir=${screensDirs}`,
  ]);
  write('ds-screen-choreography.json', choreography);

  const readiness = computeReadiness({
    directoryTree, inventory, duplication, deadCode, patterns, anatomy, choreography, brief, mode,
  });

  const forensics = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    mode,
    rootDir,
    brief: brief ? { path: brief.path, position: brief.data?.position ?? null } : null,
    directoryTree,
    inventory: inventory ?? null,
    duplication: duplication ?? null,
    deadCode: deadCode ?? null,
    patterns: patterns ?? null,
    anatomy,
    choreography,
    summary: {
      mode,
      ...readiness,
      componentCount: inventory?.summary?.componentCount ?? 0,
      kindConflicts: inventory?.summary?.kindConflicts ?? 0,
      missingComponentFolders: inventory?.summary?.missingComponentFolders ?? 0,
      unknownFolders: directoryTree?.needsClarification?.length ?? 0,
      atomicDesign: directoryTree?.conventions?.atomicDesign ?? false,
      duplicationClusters: duplication?.summary?.clusterCount ?? 0,
      deadOrTestOnly: deadCode?.summary?.totalDeadOrTestOnly ?? 0,
      implicitOrganisms: patterns?.summary?.crossScreenCandidates ?? 0,
      screenCount: anatomy.summary.screenCount,
      journeyCount: anatomy.summary.journeyCount,
      goalCount: anatomy.summary.goalCount,
      briefPresent: !!brief,
    },
  };

  write('design-system-forensics.json', forensics);
  printSummary(forensics);
  process.exit(0);
}

try { await run(); }
catch (err) {
  process.stderr.write(`design-system-scan: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
