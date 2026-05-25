#!/usr/bin/env node

/**
 * detect-layout.mjs
 *
 * Runs every shipped scenario detector against a repo root and returns the
 * best match. This is a *hint* for the synthesized state.mjs / mapper.mjs —
 * not a gate. If no scenario matches, the skill turn synthesizes a mapper.
 *
 * Usage:
 *   node detect-layout.mjs [--dir=.]
 *
 * Output (stdout, single line of JSON):
 *   {
 *     matched_scenario: "src-components" | null,
 *     roots: ["src/components"],
 *     confidence: "high" | "medium" | "low",
 *     all_matches: [{ scenario, roots, confidence }, ...]
 *   }
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function flag(name) {
  const f = process.argv.slice(2).find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
}

const rootDir = path.resolve(flag('dir') ?? process.cwd());

const scenariosDir = path.join(__dirname, 'scenarios');
const files = fs
  .readdirSync(scenariosDir)
  .filter(f => f.endsWith('.mjs') && !f.startsWith('_'));

const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 };

const allMatches = [];
for (const f of files) {
  const mod = await import(path.join(scenariosDir, f));
  if (typeof mod.detect !== 'function') continue;
  const res = mod.detect(rootDir);
  if (res?.matched) {
    allMatches.push({ scenario: mod.id ?? path.basename(f, '.mjs'), ...res });
  }
}

allMatches.sort((a, b) => (CONFIDENCE_RANK[b.confidence] ?? 0) - (CONFIDENCE_RANK[a.confidence] ?? 0));

const best = allMatches[0];

const output = best
  ? {
      matched_scenario: best.scenario,
      roots: best.roots,
      confidence: best.confidence,
      all_matches: allMatches,
    }
  : {
      matched_scenario: null,
      roots: [],
      confidence: 'low',
      all_matches: [],
    };

process.stdout.write(JSON.stringify(output));
