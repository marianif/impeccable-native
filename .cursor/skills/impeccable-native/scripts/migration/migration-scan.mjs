#!/usr/bin/env node

/**
 * migration-scan.mjs
 *
 * Orchestrator for the /impeccable-native migration command.
 * Runs the 4 core scripts in dependency order and writes a unified
 * .impeccable/migration-brief.json.
 *
 * Usage:
 *   node migration-scan.mjs --scope=<scope> [--dir=path] [--tau=0.5]
 *
 * Script pipeline:
 *   1. migration-scope  → resolves scope to file list
 *   2. token-graph      → clusters tokens by co-occurrence
 *   3. dependency-order → Tarjan SCC + topo sort → phase plan
 *   4. hardcoded-violations → finds inline colors, magic numbers
 *
 * Output:
 *   Writes .impeccable/migration-brief.json
 *   Prints human-readable summary to stdout
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

// ── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function flag(name) {
  const f = args.find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
}

const rootDir = path.resolve(flag('dir') ?? process.cwd());
const scopeRaw = flag('scope');
const tau = flag('tau') ?? '0.5';

if (!scopeRaw) {
  process.stderr.write(
    'migration-scan: --scope is required.\n' +
    '  Examples:\n' +
    '    node migration-scan.mjs --scope=app\n' +
    '    node migration-scan.mjs --scope=flow:onboarding\n' +
    '    node migration-scan.mjs --scope=routes:settings/**\n'
  );
  process.exit(1);
}

const ownDir = path.dirname(new URL(import.meta.url).pathname);
const scriptsDir = path.resolve(ownDir, '..');
const impeccableDir = path.join(rootDir, '.impeccable');

// ── helpers ────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function runScript(scriptName, extraArgs = []) {
  const scriptPath = path.join(scriptsDir, scriptName);
  const result = execFileSync(
    process.execPath,
    [scriptPath, `--dir=${rootDir}`, ...extraArgs],
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'] }
  );
  return JSON.parse(result);
}

function write(filename, data) {
  ensureDir(impeccableDir);
  const dest = path.join(impeccableDir, filename);
  fs.writeFileSync(dest, JSON.stringify(data, null, 2) + '\n');
  return dest;
}

// ── readiness verdict ──────────────────────────────────────────────────────

function computeReadiness(scopeData, tokenData, depData, violationsData) {
  const blockers = [];

  if (violationsData.verdict === 'severe') {
    blockers.push({
      kind: 'violations-first',
      message: `${violationsData.totalCount} hardcoded values will not respond to the new token system. Fix them first.`,
    });
  }

  if (depData.summary.blockingCycles > 0) {
    blockers.push({
      kind: 'cycles-first',
      message: `${depData.summary.blockingCycles} genuine circular dependency cycle(s) block phase ordering. Resolve them before migrating.`,
    });
  }

  if (blockers.length > 0) {
    const kinds = blockers.map(b => b.kind);
    if (kinds.includes('violations-first') && kinds.includes('cycles-first')) {
      return { verdict: 'blockers', blockers };
    }
    return { verdict: blockers[0].kind, blockers };
  }

  return { verdict: 'ready', blockers: [] };
}

// ── complexity estimate ────────────────────────────────────────────────────

function estimateComplexity(scopeData, tokenData, depData) {
  const files = scopeData.summary.screenCount + scopeData.summary.componentCount;
  const tokens = tokenData.summary.tokenCount;
  const cycles = depData.summary.cycleCount;
  const phases = depData.summary.phaseCount;

  if (files > 30 || tokens > 50 || cycles > 3) return 'high';
  if (files > 10 || tokens > 20 || phases > 4) return 'moderate';
  return 'low';
}

// ── terminal summary ───────────────────────────────────────────────────────

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function verdictColor(verdict) {
  if (verdict === 'ready') return GREEN;
  if (verdict === 'moderate') return YELLOW;
  return RED;
}

function printSummary(brief) {
  const { scope, tokenGraph, dependencyOrder, violations, summary } = brief;
  const v = summary.readinessVerdict;

  process.stdout.write('\n');
  process.stdout.write(`${BOLD}migration scan complete${RESET}  ·  `);
  process.stdout.write(`${scope.summary.screenCount} screens  ·  `);
  process.stdout.write(`${scope.summary.componentCount} components  ·  `);
  process.stdout.write(`${tokenGraph.summary.tokenCount} tokens  ·  `);
  process.stdout.write(`${tokenGraph.summary.clusterCount} clusters\n\n`);

  const rows = [
    ['scope', scope.scope.raw],
    ['tokens', `${tokenGraph.summary.tokenCount} tokens in ${tokenGraph.summary.clusterCount} clusters`],
    ['violations', `${violations.totalCount} hardcoded values  ${DIM}←  ${violations.verdict}${RESET}`],
    ['cycles', `${dependencyOrder.summary.cycleCount} detected, ${dependencyOrder.summary.blockingCycles} blocking`],
    ['phases', `${dependencyOrder.summary.phaseCount} migration phases`],
    ['complexity', summary.estimatedComplexity],
  ];

  for (const [label, value] of rows) {
    process.stdout.write(`  ${DIM}${label.padEnd(14)}${RESET}${value}\n`);
  }

  process.stdout.write('\n');
  process.stdout.write(`  ${DIM}verdict        ${RESET}${verdictColor(v)}${BOLD}${v.toUpperCase()}${RESET}\n`);

  if (summary.blockers.length > 0) {
    process.stdout.write('\n');
    process.stdout.write(`${YELLOW}blockers:${RESET}\n`);
    for (const b of summary.blockers) {
      process.stdout.write(`  ${RED}✗${RESET}  ${b.message}\n`);
    }
  }

  if (dependencyOrder.phases?.length > 0) {
    process.stdout.write('\n');
    process.stdout.write(`${BOLD}phase plan:${RESET}\n`);
    for (const phase of dependencyOrder.phases) {
      const fileList = phase.files?.length > 0
        ? phase.files.map(f => path.basename(f)).join(', ')
        : phase.actions?.join('; ') ?? '';
      const fileSummary = fileList.length > 60 ? fileList.slice(0, 57) + '...' : fileList;
      const tokenInfo = phase.tokenClusters?.length > 0 ? `  ${DIM}·  ${phase.tokenClusters.join(', ')}${RESET}` : '';
      process.stdout.write(
        `  ${CYAN}phase ${String(phase.phase).padEnd(2)}${RESET}  ${phase.kind.padEnd(22)}  ${DIM}${fileSummary}${RESET}${tokenInfo}\n`
      );
    }
  }

  process.stdout.write('\n');
  process.stdout.write(`  ${DIM}brief written to${RESET}  .impeccable/migration-brief.json\n`);
  process.stdout.write(`  ${DIM}resume with     ${RESET}  /impeccable-native migration --resume\n`);
  process.stdout.write('\n');
}

// ── cross-join: assign token clusters to phases ───────────────────────────

function assignTokenClustersToPhasePlan(phases, tokenGraph, scopeData) {
  // For each phase, find which token clusters are consumed by its files.
  // A cluster migrates in the earliest phase containing any of its consumers.
  const clusterEarliestPhase = new Map();

  for (const phase of phases) {
    for (const file of (phase.files ?? [])) {
      const tokens = tokenGraph.tokens ?? {};
      for (const [tok, data] of Object.entries(tokens)) {
        if ((data.consumersInScope ?? []).includes(file)) {
          const cluster = data.cluster;
          if (cluster && (!clusterEarliestPhase.has(cluster) || clusterEarliestPhase.get(cluster) > phase.phase)) {
            clusterEarliestPhase.set(cluster, phase.phase);
          }
        }
      }
    }
  }

  // Annotate each phase
  for (const phase of phases) {
    const clusters = [...clusterEarliestPhase.entries()]
      .filter(([, p]) => p === phase.phase)
      .map(([c]) => c);
    if (clusters.length > 0) phase.tokenClusters = clusters;
  }

  return phases;
}

// ── main ───────────────────────────────────────────────────────────────────

async function run() {
  process.stderr.write('migration-scan: resolving scope...\n');
  const scopeData = runScript('migration/migration-scope.mjs', [`--scope=${scopeRaw}`]);
  write('migration-scope.json', scopeData);

  process.stderr.write('migration-scan: building token graph...\n');
  const tokenGraph = runScript('shared/token-graph.mjs', [`--tau=${tau}`]);
  write('migration-token-graph.json', tokenGraph);

  process.stderr.write('migration-scan: computing dependency order...\n');
  const dependencyOrder = runScript('migration/dependency-order.mjs');
  write('migration-dependency-order.json', dependencyOrder);

  process.stderr.write('migration-scan: scanning for hardcoded violations...\n');
  const violations = runScript('shared/hardcoded-violations.mjs');
  write('migration-violations.json', violations);

  // Annotate phases with token cluster assignments
  dependencyOrder.phases = assignTokenClustersToPhasePlan(
    dependencyOrder.phases ?? [],
    tokenGraph,
    scopeData
  );

  const readiness = computeReadiness(scopeData, tokenGraph, dependencyOrder, violations);

  const brief = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    scope: scopeData,
    tokenGraph,
    dependencyOrder,
    violations,
    summary: {
      screensInScope: scopeData.summary.screenCount,
      componentsInScope: scopeData.summary.componentCount,
      tokenCount: tokenGraph.summary.tokenCount,
      clusterCount: tokenGraph.summary.clusterCount,
      violationCount: violations.totalCount,
      cycleCount: dependencyOrder.summary.cycleCount,
      blockingCycles: dependencyOrder.summary.blockingCycles,
      phaseCount: dependencyOrder.summary.phaseCount,
      estimatedComplexity: estimateComplexity(scopeData, tokenGraph, dependencyOrder),
      readinessVerdict: readiness.verdict,
      blockers: readiness.blockers,
    },
  };

  const briefPath = write('migration-brief.json', brief);
  printSummary(brief);

  process.exit(0);
}

try {
  await run();
} catch (err) {
  process.stderr.write(`migration-scan: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
