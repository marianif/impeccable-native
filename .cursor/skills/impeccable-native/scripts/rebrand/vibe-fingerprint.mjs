#!/usr/bin/env node

/**
 * vibe-fingerprint.mjs
 *
 * Derives the app's *current implicit vibe* from the data — not what the
 * developer thinks it is, what the pixels actually say. Outputs a short
 * paragraph and a structured fingerprint across the six divergence axes
 * (temperature, density, voice, posture, era, convention).
 *
 * The output is meant to be uncomfortable to read. That's the point — if
 * the developer's intended vibe doesn't match the derived one, the gap is
 * the brief for the rebrand.
 *
 * Usage:
 *   node vibe-fingerprint.mjs [--dir=path] [--inventory-file=path]
 *
 * Output (stdout, JSON):
 *   {
 *     "paragraph": "...",
 *     "axes": { temperature, density, voice, posture, era, convention },
 *     "evidence": { ... },
 *     "summary": { dominantHueFamily, saturationProfile, ... }
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
  const scriptPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'style-inventory.mjs');
  const out = execFileSync(process.execPath, [scriptPath, `--dir=${rootDir}`], { encoding: 'utf-8' });
  return JSON.parse(out);
}

// ── color analysis ────────────────────────────────────────────────────────

function hexToHsl(hex) {
  const h = hex.replace('#', '');
  if (h.length < 6) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const L = (max + min) / 2;
  let H = 0, S = 0;
  if (max !== min) {
    const d = max - min;
    S = L > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: H = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: H = ((b - r) / d + 2); break;
      case b: H = ((r - g) / d + 4); break;
    }
    H *= 60;
  }
  return { h: H, s: S, l: L };
}

function hueFamily(h) {
  if (h < 15 || h >= 345) return 'red';
  if (h < 45) return 'orange';
  if (h < 70) return 'yellow';
  if (h < 165) return 'green';
  if (h < 200) return 'cyan';
  if (h < 255) return 'blue';
  if (h < 290) return 'violet';
  return 'magenta';
}

function analyzePalette(colorClusters) {
  const hsls = [];
  let weightedHueX = 0, weightedHueY = 0, totalWeight = 0;
  let weightedSat = 0, weightedLight = 0;
  const families = {};

  for (const cluster of colorClusters) {
    const hsl = hexToHsl(cluster.leader);
    if (!hsl) continue;
    const w = cluster.totalUsage;
    hsls.push({ hsl, weight: w, hex: cluster.leader });
    // Skip near-neutral colors from hue averaging
    if (hsl.s > 0.1) {
      const rad = hsl.h * Math.PI / 180;
      weightedHueX += Math.cos(rad) * w;
      weightedHueY += Math.sin(rad) * w;
      const fam = hueFamily(hsl.h);
      families[fam] = (families[fam] ?? 0) + w;
    }
    weightedSat += hsl.s * w;
    weightedLight += hsl.l * w;
    totalWeight += w;
  }

  if (totalWeight === 0) return null;
  const avgHue = (Math.atan2(weightedHueY, weightedHueX) * 180 / Math.PI + 360) % 360;
  const avgSat = weightedSat / totalWeight;
  const avgLight = weightedLight / totalWeight;
  const dominantFamily = Object.entries(families).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'neutral';

  return {
    avgHue: Math.round(avgHue),
    avgSaturation: Math.round(avgSat * 100) / 100,
    avgLightness: Math.round(avgLight * 100) / 100,
    dominantHueFamily: dominantFamily,
    hueDistribution: families,
  };
}

// ── axis derivation ───────────────────────────────────────────────────────

function deriveTemperature(palette) {
  if (!palette) return { value: 'unknown', reason: 'no color data' };
  const fam = palette.dominantHueFamily;
  if (['red', 'orange', 'yellow', 'magenta'].includes(fam)) {
    return { value: 'warm', reason: `dominant hue family is ${fam} (avg hue ${palette.avgHue}°)` };
  }
  if (['cyan', 'blue', 'violet'].includes(fam)) {
    return { value: 'cool', reason: `dominant hue family is ${fam} (avg hue ${palette.avgHue}°)` };
  }
  if (palette.avgSaturation < 0.15) {
    return { value: 'neutral', reason: `low average saturation (${palette.avgSaturation}); palette reads as grayscale` };
  }
  return { value: 'neutral', reason: `mixed hue distribution, no dominant temperature` };
}

function deriveDensity(inventory) {
  // Generous = spacings concentrated in 24/32/48; Efficient = concentrated in 4/8/12
  let generous = 0, efficient = 0, total = 0;
  for (const c of inventory.spacings.clusters) {
    const w = c.totalUsage;
    total += w;
    if (c.leader >= 24) generous += w;
    else if (c.leader <= 12 && c.leader > 0) efficient += w;
  }
  if (total === 0) return { value: 'unknown', reason: 'no spacing data' };
  const genRatio = generous / total;
  const effRatio = efficient / total;
  if (genRatio > 0.4) return { value: 'generous', reason: `${Math.round(genRatio * 100)}% of spacing is ≥24pt` };
  if (effRatio > 0.6) return { value: 'efficient', reason: `${Math.round(effRatio * 100)}% of spacing is ≤12pt` };
  return { value: 'balanced', reason: 'spacing distribution is mixed' };
}

function derivePosture(inventory, palette) {
  // Restrained = low saturation + sharp radii + few colors
  // Confident = mid saturation + soft radii + tight palette
  // Expressive = high saturation OR pill radii OR many colors
  const sat = palette?.avgSaturation ?? 0;
  const radiusLang = inventory.radii.language.dominant;
  const colorCount = inventory.summary.perceivedColors;
  if (sat > 0.6 || radiusLang === 'pill' || colorCount > 14) {
    return {
      value: 'expressive',
      reason: `saturation ${sat}, dominant radius "${radiusLang}", ${colorCount} colors — palette is assertive`,
    };
  }
  if (sat < 0.25 && (radiusLang === 'sharp' || radiusLang === 'soft')) {
    return {
      value: 'restrained',
      reason: `low saturation (${sat}) with ${radiusLang} corners — palette holds back`,
    };
  }
  return {
    value: 'confident',
    reason: `mid-range saturation (${sat}) with ${radiusLang} corners — committed but not loud`,
  };
}

function deriveEra(inventory) {
  // Of-the-moment: pill radii, gradient hints, large radii
  // Timeless: small soft radii, classic spacing rhythm
  const lang = inventory.radii.language.dominant;
  const rhythm = inventory.spacings.rhythm.base;
  if (lang === 'pill' || lang === 'large') {
    return { value: 'of-the-moment', reason: `${lang} radii dominate — reads as current visual language` };
  }
  if (lang === 'sharp' && rhythm === 8) {
    return { value: 'timeless', reason: `sharp corners on an 8pt rhythm — classical mobile language` };
  }
  return { value: 'mixed', reason: 'no consistent era signal' };
}

function deriveConvention(inventory) {
  // Distinct = custom font families, non-standard rhythm
  // Native = system fonts, 4/8pt rhythm
  const customFonts = (inventory.fontFamilies ?? []).filter(f =>
    !/^system$|^-apple-system$|^Roboto$|^Helvetica/i.test(f.family)
  );
  const rhythmFit = inventory.spacings.rhythm.fit;
  if (customFonts.length >= 2 || (rhythmFit < 0.7 && customFonts.length >= 1)) {
    return { value: 'distinct', reason: `${customFonts.length} custom font famil(y/ies) — overrides platform defaults` };
  }
  if (customFonts.length === 0 && rhythmFit > 0.85) {
    return { value: 'inherits-platform', reason: 'system fonts + clean rhythm — defers to platform defaults' };
  }
  return { value: 'mostly-platform', reason: 'partial overrides of platform conventions' };
}

function deriveVoice() {
  // Voice (quiet/direct/warm) requires copy analysis — punt for now.
  return { value: 'undetermined', reason: 'copy analysis not yet implemented — inferred from rebrand interrogation' };
}

// ── prose synthesis ───────────────────────────────────────────────────────

function buildParagraph(palette, axes, inventory) {
  if (!palette) {
    return 'Your app has no extractable color signal — either it has not been styled yet, or all colors live behind unresolved imports.';
  }
  const colorCount = inventory.summary.perceivedColors;
  const dupClusters = inventory.colors.perceptuallyDuplicateClusters;
  const fontFamCount = (inventory.fontFamilies ?? []).length;

  const parts = [];
  parts.push(`Your app currently reads as ${axes.temperature.value} and ${axes.posture.value}, in a ${axes.density.value} density.`);
  parts.push(`The dominant hue family is ${palette.dominantHueFamily} (avg ${palette.avgHue}°, saturation ${palette.avgSaturation}).`);
  const cornerLang = inventory.radii.language.dominant ?? 'undetectable';
  parts.push(`The corner language is "${cornerLang}" and the spacing rhythm is ${inventory.spacings.rhythm.base ? `${inventory.spacings.rhythm.base}pt-based (${Math.round(inventory.spacings.rhythm.fit * 100)}% fit)` : 'undetectable'}.`);
  parts.push(`You have ${colorCount} perceptually-distinct colors${dupClusters > 0 ? ` and ${dupClusters} cluster(s) where multiple colors collapse to the same visual answer` : ''}.`);
  if (fontFamCount > 2) parts.push(`${fontFamCount} font famil(y/ies) are in use, which dilutes the typographic signal.`);
  parts.push(`The era reads as "${axes.era.value}" and the relationship to platform conventions is "${axes.convention.value}".`);
  return parts.join(' ');
}

// ── main ──────────────────────────────────────────────────────────────────

function run() {
  const inventory = loadInventory();
  const palette = analyzePalette(inventory.colors.clusters);

  const axes = {
    temperature: deriveTemperature(palette),
    density: deriveDensity(inventory),
    voice: deriveVoice(),
    posture: derivePosture(inventory, palette),
    era: deriveEra(inventory),
    convention: deriveConvention(inventory),
  };

  const paragraph = buildParagraph(palette, axes, inventory);

  const result = {
    paragraph,
    axes,
    evidence: {
      palette,
      radiusLanguage: inventory.radii.language,
      spacingRhythm: inventory.spacings.rhythm,
      perceivedColors: inventory.summary.perceivedColors,
      perceptuallyDuplicateClusters: inventory.colors.perceptuallyDuplicateClusters,
      fontFamilies: inventory.fontFamilies ?? [],
    },
    summary: {
      dominantHueFamily: palette?.dominantHueFamily ?? null,
      avgSaturation: palette?.avgSaturation ?? null,
      temperature: axes.temperature.value,
      density: axes.density.value,
      posture: axes.posture.value,
      era: axes.era.value,
      convention: axes.convention.value,
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

try { run(); }
catch (err) {
  process.stderr.write(`vibe-fingerprint: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
