#!/usr/bin/env node

/**
 * style-inventory.mjs
 *
 * Builds a perceptual inventory of the app's current style surface.
 * Where token-graph cares about names and co-occurrence, this script cares
 * about *what the user actually sees*: groups colors by perceptual distance
 * (CIEDE2000 ΔE), font sizes by visual proximity, spacings and radii by
 * rhythm. The output answers "how many distinct visual decisions does this
 * app actually express, regardless of how many tokens claim to exist."
 *
 * No external dependency: hex→Lab conversion + ΔE2000 is implemented inline
 * to keep the skill install-free.
 *
 * Usage:
 *   node style-inventory.mjs [--dir=path] [--de=3.5]
 *
 *   --dir=path  Project root (default: cwd)
 *   --de=3.5    ΔE2000 threshold below which two colors are "the same"
 *
 * Output (stdout, JSON):
 *   {
 *     "colors":   { raw, clusters, perceptuallyDuplicate },
 *     "fontSizes":{ raw, clusters },
 *     "spacings": { raw, clusters, rhythmBase, rhythmFit },
 *     "radii":    { raw, clusters, language },
 *     "fontFamilies": [ ... ],
 *     "summary":  { ... }
 *   }
 */

import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
function flag(name) {
  const f = args.find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
}
const rootDir = path.resolve(flag('dir') ?? process.cwd());
const deThreshold = parseFloat(flag('de') ?? '3.5');

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.expo', '.metro-cache',
  'android', 'ios', '__generated__', 'coverage', '.impeccable',
]);

function collectFiles(dir, results = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, results);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) results.push(full);
  }
  return results;
}

// ── color science (sRGB → Lab → ΔE2000) ───────────────────────────────────

function expandHex(hex) {
  const h = hex.replace('#', '');
  if (h.length === 3) return h.split('').map(c => c + c).join('');
  if (h.length === 4) return h.slice(0, 3).split('').map(c => c + c).join(''); // drop alpha
  if (h.length === 8) return h.slice(0, 6);
  return h.length === 6 ? h : null;
}

function hexToRgb(hex) {
  const h = expandHex(hex);
  if (!h) return null;
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function rgbToXyz({ r, g, b }) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  return {
    x: (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) * 100,
    y: (R * 0.2126729 + G * 0.7151522 + B * 0.0721750) * 100,
    z: (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) * 100,
  };
}

function xyzToLab({ x, y, z }) {
  const Xn = 95.047, Yn = 100.000, Zn = 108.883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
  const fx = f(x / Xn), fy = f(y / Yn), fz = f(z / Zn);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function hexToLab(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return xyzToLab(rgbToXyz(rgb));
}

// CIEDE2000 — Sharma et al. 2005
function deltaE2000(lab1, lab2) {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;
  const avgL = (L1 + L2) / 2;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const avgC = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const avgCp = (C1p + C2p) / 2;
  const h1p = Math.atan2(b1, a1p) * 180 / Math.PI + (Math.atan2(b1, a1p) < 0 ? 360 : 0);
  const h2p = Math.atan2(b2, a2p) * 180 / Math.PI + (Math.atan2(b2, a2p) < 0 ? 360 : 0);
  let dHp;
  if (Math.abs(h1p - h2p) <= 180) dHp = h2p - h1p;
  else if (h2p <= h1p) dHp = h2p - h1p + 360;
  else dHp = h2p - h1p - 360;
  const avgHp = (Math.abs(h1p - h2p) > 180) ? (h1p + h2p + 360) / 2 : (h1p + h2p) / 2;
  const T = 1 - 0.17 * Math.cos((avgHp - 30) * Math.PI / 180)
            + 0.24 * Math.cos((2 * avgHp) * Math.PI / 180)
            + 0.32 * Math.cos((3 * avgHp + 6) * Math.PI / 180)
            - 0.20 * Math.cos((4 * avgHp - 63) * Math.PI / 180);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  const dHpFinal = 2 * Math.sqrt(C1p * C2p) * Math.sin((dHp / 2) * Math.PI / 180);
  const SL = 1 + (0.015 * Math.pow(avgL - 50, 2)) / Math.sqrt(20 + Math.pow(avgL - 50, 2));
  const SC = 1 + 0.045 * avgCp;
  const SH = 1 + 0.015 * avgCp * T;
  const dTheta = 30 * Math.exp(-Math.pow((avgHp - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
  const RT = -RC * Math.sin(2 * dTheta * Math.PI / 180);
  return Math.sqrt(
    Math.pow(dLp / SL, 2) +
    Math.pow(dCp / SC, 2) +
    Math.pow(dHpFinal / SH, 2) +
    RT * (dCp / SC) * (dHpFinal / SH)
  );
}

// ── extractors ────────────────────────────────────────────────────────────

const HEX_RE = /#([0-9a-fA-F]{3,8})\b/g;
const RGB_RE = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/g;
const NAMED_BASIC = new Map([
  ['black', '#000000'], ['white', '#ffffff'], ['red', '#ff0000'],
  ['green', '#008000'], ['blue', '#0000ff'], ['yellow', '#ffff00'],
  ['gray', '#808080'], ['grey', '#808080'], ['silver', '#c0c0c0'],
]);

function rgbStrToHex(r, g, b) {
  const h = n => Math.max(0, Math.min(255, parseInt(n, 10))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function extractColors(source, relPath, registry) {
  HEX_RE.lastIndex = 0;
  for (const m of source.matchAll(HEX_RE)) {
    const h = expandHex(m[0]);
    if (!h) continue;
    const hex = `#${h.toLowerCase()}`;
    if (!registry.has(hex)) registry.set(hex, { hex, usages: [] });
    registry.get(hex).usages.push(relPath);
  }
  RGB_RE.lastIndex = 0;
  for (const m of source.matchAll(RGB_RE)) {
    const hex = rgbStrToHex(m[1], m[2], m[3]);
    if (!registry.has(hex)) registry.set(hex, { hex, usages: [] });
    registry.get(hex).usages.push(relPath);
  }
  for (const [name, hex] of NAMED_BASIC) {
    if (new RegExp(`['"]${name}['"]`).test(source)) {
      if (!registry.has(hex)) registry.set(hex, { hex, usages: [] });
      registry.get(hex).usages.push(relPath);
    }
  }
}

const FONT_SIZE_RE = /\bfontSize\s*:\s*(\d+(?:\.\d+)?)/g;
const SPACING_RE = /\b(padding(?:Horizontal|Vertical|Top|Bottom|Left|Right|Start|End)?|margin(?:Horizontal|Vertical|Top|Bottom|Left|Right|Start|End)?|gap|rowGap|columnGap)\s*:\s*(\d+(?:\.\d+)?)/g;
const RADIUS_RE = /\b(borderRadius|borderTopLeftRadius|borderTopRightRadius|borderBottomLeftRadius|borderBottomRightRadius)\s*:\s*(\d+(?:\.\d+)?)/g;
const FONT_FAMILY_RE = /\bfontFamily\s*:\s*['"]([^'"]+)['"]/g;

function pushNum(registry, n, relPath) {
  if (!registry.has(n)) registry.set(n, { value: n, usages: [] });
  registry.get(n).usages.push(relPath);
}

function extractNumeric(source, relPath, fontSizes, spacings, radii) {
  for (const m of source.matchAll(FONT_SIZE_RE)) pushNum(fontSizes, parseFloat(m[1]), relPath);
  for (const m of source.matchAll(SPACING_RE)) pushNum(spacings, parseFloat(m[2]), relPath);
  for (const m of source.matchAll(RADIUS_RE)) pushNum(radii, parseFloat(m[2]), relPath);
}

function extractFontFamilies(source, relPath, registry) {
  for (const m of source.matchAll(FONT_FAMILY_RE)) {
    const name = m[1];
    if (!registry.has(name)) registry.set(name, { family: name, usages: [] });
    registry.get(name).usages.push(relPath);
  }
}

// ── clustering ────────────────────────────────────────────────────────────

function clusterColorsPerceptually(colors, threshold) {
  const items = [...colors.values()].map(c => ({ ...c, lab: hexToLab(c.hex) })).filter(c => c.lab);
  // Sort by frequency desc so the "leader" of each cluster is the most-used color
  items.sort((a, b) => b.usages.length - a.usages.length);
  const clusters = [];
  for (const item of items) {
    let placed = false;
    for (const cluster of clusters) {
      const de = deltaE2000(cluster.lab, item.lab);
      if (de <= threshold) {
        cluster.members.push({ hex: item.hex, usageCount: item.usages.length, deltaE: Math.round(de * 10) / 10 });
        cluster.totalUsage += item.usages.length;
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push({
        leader: item.hex,
        lab: item.lab,
        members: [{ hex: item.hex, usageCount: item.usages.length, deltaE: 0 }],
        totalUsage: item.usages.length,
      });
    }
  }
  return clusters
    .map((c, i) => ({
      id: `color-cluster-${i + 1}`,
      leader: c.leader,
      memberCount: c.members.length,
      totalUsage: c.totalUsage,
      members: c.members.sort((a, b) => b.usageCount - a.usageCount),
      perceptuallyDuplicate: c.members.length > 1,
    }))
    .sort((a, b) => b.totalUsage - a.totalUsage);
}

function clusterNumbers(values, tolerance) {
  const items = [...values.values()].sort((a, b) => a.value - b.value);
  const clusters = [];
  for (const item of items) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(item.value - last.leader) <= tolerance) {
      last.members.push({ value: item.value, usageCount: item.usages.length });
      last.totalUsage += item.usages.length;
    } else {
      clusters.push({
        leader: item.value,
        members: [{ value: item.value, usageCount: item.usages.length }],
        totalUsage: item.usages.length,
      });
    }
  }
  return clusters
    .map((c, i) => ({
      id: `cluster-${i + 1}`,
      leader: c.leader,
      memberCount: c.members.length,
      totalUsage: c.totalUsage,
      members: c.members,
      perceptuallyDuplicate: c.members.length > 1,
    }))
    .sort((a, b) => a.leader - b.leader);
}

// Detect dominant rhythm: do spacings fit a clean 4pt or 8pt scale?
function detectRhythm(values) {
  const totals = { 4: 0, 8: 0, 5: 0, 10: 0 };
  let total = 0;
  for (const { value, usages } of values.values()) {
    total += usages.length;
    for (const base of [4, 8, 5, 10]) {
      if (value % base === 0) totals[base] += usages.length;
    }
  }
  if (total === 0) return { base: null, fit: 0, candidates: [] };
  const candidates = Object.entries(totals)
    .map(([base, hits]) => ({ base: Number(base), fit: Math.round((hits / total) * 100) / 100 }))
    .sort((a, b) => b.fit - a.fit);
  return { base: candidates[0].base, fit: candidates[0].fit, candidates };
}

// Detect radius language: sharp (≤4), soft (5–12), large (>12), pill (>=999)
function detectRadiusLanguage(values) {
  let sharp = 0, soft = 0, large = 0, pill = 0, total = 0;
  for (const { value, usages } of values.values()) {
    const w = usages.length;
    total += w;
    if (value >= 999) pill += w;
    else if (value <= 4) sharp += w;
    else if (value <= 12) soft += w;
    else large += w;
  }
  if (total === 0) return { dominant: null, distribution: {} };
  const distribution = {
    sharp: Math.round((sharp / total) * 100) / 100,
    soft: Math.round((soft / total) * 100) / 100,
    large: Math.round((large / total) * 100) / 100,
    pill: Math.round((pill / total) * 100) / 100,
  };
  const dominant = Object.entries(distribution).sort((a, b) => b[1] - a[1])[0][0];
  return { dominant, distribution };
}

// ── main ──────────────────────────────────────────────────────────────────

function run() {
  const files = collectFiles(rootDir);
  const colors = new Map();
  const fontSizes = new Map();
  const spacings = new Map();
  const radii = new Map();
  const fontFamilies = new Map();

  for (const filePath of files) {
    let source;
    try { source = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }
    const rel = path.relative(rootDir, filePath);
    extractColors(source, rel, colors);
    extractNumeric(source, rel, fontSizes, spacings, radii);
    extractFontFamilies(source, rel, fontFamilies);
  }

  const colorClusters = clusterColorsPerceptually(colors, deThreshold);
  const fontSizeClusters = clusterNumbers(fontSizes, 1); // ±1px = same visual step
  const spacingClusters = clusterNumbers(spacings, 2);   // ±2px = same rhythm step
  const radiusClusters = clusterNumbers(radii, 2);

  const rhythm = detectRhythm(spacings);
  const radiusLanguage = detectRadiusLanguage(radii);

  const result = {
    colors: {
      rawCount: colors.size,
      clusters: colorClusters,
      perceptuallyDuplicateClusters: colorClusters.filter(c => c.perceptuallyDuplicate).length,
      perceptualThresholdDeltaE: deThreshold,
    },
    fontSizes: {
      rawCount: fontSizes.size,
      clusters: fontSizeClusters,
      perceptuallyDuplicateClusters: fontSizeClusters.filter(c => c.perceptuallyDuplicate).length,
    },
    spacings: {
      rawCount: spacings.size,
      clusters: spacingClusters,
      perceptuallyDuplicateClusters: spacingClusters.filter(c => c.perceptuallyDuplicate).length,
      rhythm,
    },
    radii: {
      rawCount: radii.size,
      clusters: radiusClusters,
      language: radiusLanguage,
    },
    fontFamilies: [...fontFamilies.values()]
      .map(f => ({ family: f.family, usageCount: f.usages.length }))
      .sort((a, b) => b.usageCount - a.usageCount),
    summary: {
      filesScanned: files.length,
      rawColors: colors.size,
      perceivedColors: colorClusters.length,
      rawFontSizes: fontSizes.size,
      perceivedFontSizes: fontSizeClusters.length,
      rawSpacings: spacings.size,
      perceivedSpacings: spacingClusters.length,
      rawRadii: radii.size,
      perceivedRadii: radiusClusters.length,
      fontFamilyCount: fontFamilies.size,
      dominantRhythm: rhythm.base,
      rhythmFit: rhythm.fit,
      dominantRadiusLanguage: radiusLanguage.dominant,
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

try { run(); }
catch (err) {
  process.stderr.write(`style-inventory: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
