#!/usr/bin/env node

/**
 * incoherence-report.mjs
 *
 * Hunts contradictions in the current design surface. Reads style-inventory's
 * output (or recomputes it) and flags places where the codebase contradicts
 * itself: perceptually-identical colors used as if they were different,
 * mixed spacing rhythms in the same flow, sharp and pill radii used together
 * without intent, multiple font families for no semantic reason.
 *
 * The point isn't a complete list — it's the evidence the developer needs
 * to *feel* the mess before being asked to redesign.
 *
 * Usage:
 *   node incoherence-report.mjs [--dir=path] [--inventory-file=path]
 *
 * Output (stdout, JSON):
 *   {
 *     "findings": [ { kind, severity, message, evidence: [...] }, ... ],
 *     "byKind": { ... },
 *     "summary": { findingCount, severeCount, verdict }
 *   }
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
const inventoryFile = flag('inventory-file');

function loadInventory() {
  if (inventoryFile) return JSON.parse(fs.readFileSync(path.resolve(inventoryFile), 'utf-8'));
  const cached = path.join(rootDir, '.impeccable', 'rebrand-style-inventory.json');
  if (fs.existsSync(cached)) return JSON.parse(fs.readFileSync(cached, 'utf-8'));
  // Run inline as a fallback
  const scriptPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'style-inventory.mjs');
  const out = execFileSync(process.execPath, [scriptPath, `--dir=${rootDir}`], { encoding: 'utf-8' });
  return JSON.parse(out);
}

// ── findings ──────────────────────────────────────────────────────────────

function findPerceptualColorDuplicates(inventory) {
  const findings = [];
  for (const cluster of inventory.colors.clusters) {
    if (!cluster.perceptuallyDuplicate) continue;
    if (cluster.members.length < 2) continue;
    findings.push({
      kind: 'perceptual-color-duplicate',
      severity: cluster.members.length >= 4 ? 'severe' : 'moderate',
      message: `${cluster.members.length} colors are visually indistinguishable (ΔE ≤ ${inventory.colors.perceptualThresholdDeltaE}) but used as if distinct.`,
      evidence: {
        leader: cluster.leader,
        members: cluster.members.map(m => `${m.hex} (used ${m.usageCount}×, ΔE ${m.deltaE})`),
        recommendation: `Collapse to a single token. The leader (${cluster.leader}) is the most-used variant.`,
      },
    });
  }
  return findings;
}

function findSpacingIncoherence(inventory) {
  const findings = [];
  const rhythm = inventory.spacings.rhythm;
  if (!rhythm.base) return findings;
  if (rhythm.fit < 0.8) {
    // Find the off-rhythm spacings
    const base = rhythm.base;
    const offBeat = inventory.spacings.clusters
      .filter(c => c.leader % base !== 0 && c.leader !== 0 && c.leader !== 1)
      .map(c => ({ value: c.leader, usages: c.totalUsage }));
    if (offBeat.length > 0) {
      findings.push({
        kind: 'mixed-spacing-rhythm',
        severity: rhythm.fit < 0.6 ? 'severe' : 'moderate',
        message: `Dominant rhythm is ${base}pt-based (${Math.round(rhythm.fit * 100)}% fit) but ${offBeat.length} off-beat spacing value(s) coexist.`,
        evidence: {
          rhythmBase: base,
          rhythmFit: rhythm.fit,
          offBeatValues: offBeat,
          recommendation: `Pick one rhythm. The off-beat values (${offBeat.map(o => o.value).join(', ')}) are probably accidental.`,
        },
      });
    }
  }
  return findings;
}

function findRadiusIncoherence(inventory) {
  const findings = [];
  const lang = inventory.radii.language;
  if (!lang.dominant) return findings;
  const dist = lang.distribution;
  // Mixed sharp + pill in significant volume = no radius language
  const sharp = dist.sharp ?? 0;
  const soft = dist.soft ?? 0;
  const pill = dist.pill ?? 0;
  const large = dist.large ?? 0;
  const distinctVoices = [sharp, soft, large, pill].filter(v => v >= 0.15).length;
  if (distinctVoices >= 3) {
    findings.push({
      kind: 'mixed-radius-language',
      severity: 'severe',
      message: `${distinctVoices} distinct radius languages in use without semantic separation: sharp ${Math.round(sharp * 100)}%, soft ${Math.round(soft * 100)}%, large ${Math.round(large * 100)}%, pill ${Math.round(pill * 100)}%.`,
      evidence: {
        distribution: dist,
        recommendation: `Pick one corner language. Mixing sharp and pill without intent reads as accidental.`,
      },
    });
  } else if (sharp >= 0.15 && pill >= 0.15) {
    findings.push({
      kind: 'sharp-and-pill-coexist',
      severity: 'moderate',
      message: `Both sharp (${Math.round(sharp * 100)}%) and pill (${Math.round(pill * 100)}%) radii in use. These send opposite signals.`,
      evidence: {
        distribution: dist,
        recommendation: `Confirm this contrast is intentional (e.g., pill for chips, sharp for cards). If not, unify.`,
      },
    });
  }
  return findings;
}

function findFontFamilyIncoherence(inventory) {
  const findings = [];
  const families = inventory.fontFamilies ?? [];
  // Filter out system defaults — they're typically platform-native fallbacks
  const customFamilies = families.filter(f =>
    !/^system$|^-apple-system$|^Roboto$|^Helvetica/i.test(f.family)
  );
  if (customFamilies.length >= 3) {
    findings.push({
      kind: 'too-many-font-families',
      severity: customFamilies.length >= 5 ? 'severe' : 'moderate',
      message: `${customFamilies.length} custom font families in use. A coherent app usually has 1–2.`,
      evidence: {
        families: customFamilies.map(f => `${f.family} (${f.usageCount}×)`),
        recommendation: `Pick a primary + optional accent. Retire the rest.`,
      },
    });
  }
  return findings;
}

function findFontSizeRedundancy(inventory) {
  const findings = [];
  // If we have >10 perceived font sizes, the type scale is undisciplined
  if (inventory.summary.perceivedFontSizes >= 10) {
    const top = inventory.fontSizes.clusters
      .sort((a, b) => b.totalUsage - a.totalUsage)
      .slice(0, 15)
      .map(c => `${c.leader}px (×${c.totalUsage})`);
    findings.push({
      kind: 'undisciplined-type-scale',
      severity: inventory.summary.perceivedFontSizes >= 15 ? 'severe' : 'moderate',
      message: `${inventory.summary.perceivedFontSizes} distinct font sizes in use. A coherent scale usually has 5–8 steps.`,
      evidence: {
        topSizes: top,
        recommendation: `Define a 6-step scale with a clean ratio (e.g., 12/14/16/20/24/32). Map every usage onto the scale.`,
      },
    });
  }
  return findings;
}

function findColorOverpopulation(inventory) {
  const findings = [];
  // After perceptual collapse, >12 distinct colors is a sign of no discipline
  if (inventory.summary.perceivedColors >= 12) {
    const top = inventory.colors.clusters
      .slice(0, 10)
      .map(c => `${c.leader} (×${c.totalUsage})`);
    findings.push({
      kind: 'palette-overpopulated',
      severity: inventory.summary.perceivedColors >= 20 ? 'severe' : 'moderate',
      message: `${inventory.summary.perceivedColors} perceptually-distinct colors in the palette. Coherent apps usually live within 8.`,
      evidence: {
        topColors: top,
        rawColorCount: inventory.summary.rawColors,
        recommendation: `Restructure into roles (brand, surface, text, feedback) with one swatch each, optional accents.`,
      },
    });
  }
  return findings;
}

// ── main ──────────────────────────────────────────────────────────────────

function run() {
  const inventory = loadInventory();
  const findings = [
    ...findPerceptualColorDuplicates(inventory),
    ...findColorOverpopulation(inventory),
    ...findSpacingIncoherence(inventory),
    ...findRadiusIncoherence(inventory),
    ...findFontFamilyIncoherence(inventory),
    ...findFontSizeRedundancy(inventory),
  ];

  const byKind = {};
  let severeCount = 0;
  for (const f of findings) {
    byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
    if (f.severity === 'severe') severeCount++;
  }

  let verdict = 'coherent';
  if (severeCount >= 3) verdict = 'incoherent';
  else if (findings.length >= 4 || severeCount >= 1) verdict = 'mixed';
  else if (findings.length > 0) verdict = 'mostly-coherent';

  const result = {
    findings,
    byKind,
    summary: {
      findingCount: findings.length,
      severeCount,
      verdict,
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

try { run(); }
catch (err) {
  process.stderr.write(`incoherence-report: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
