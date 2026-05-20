#!/usr/bin/env node

/**
 * detect-rn-flavor.mjs
 *
 * Detects the React Native / Expo project flavor from package.json (and
 * optionally app.json / app.config.js) in the current working directory.
 *
 * Outputs a JSON object to stdout (pretty-printed) and exits 0 on success.
 * Exits 1 with a message on stderr on failure.
 *
 * Fields returned:
 *   flavor      "expo" | "bare" | "unknown"
 *   router      "expo-router" | "react-navigation" | "unknown"
 *   styling     "nativewind" | "unistyles" | "stylesheet"
 *   newArch     true | false
 *   sdkVersion  string | null
 *   rnVersion   string | null
 */

import fs from 'fs';
import path from 'path';

const cwd = process.cwd();

// ── helpers ────────────────────────────────────────────────────────────────

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Strip leading ^ ~ >= <= = from a semver string so we can compare numerics.
 */
function stripRange(version) {
  if (typeof version !== 'string') return version;
  return version.replace(/^[^0-9]*/, '').trim();
}

/**
 * Return true if versionString resolves to >= major.minor (numeric comparison
 * of the first two components only; ignores pre-release tags).
 */
function versionAtLeast(versionString, major, minor) {
  if (!versionString) return false;
  const clean = stripRange(versionString);
  const parts = clean.split('.').map(p => parseInt(p, 10));
  const [maj = 0, min = 0] = parts;
  if (isNaN(maj) || isNaN(min)) return false;
  if (maj !== major) return maj > major;
  return min >= minor;
}

/**
 * Check whether a string (file contents) contains `newArchEnabled: true` or
 * `"newArchEnabled": true` in any format that would reasonably appear in a
 * JS/JSON/JSON5 config file.
 */
function mentionsNewArch(text) {
  return /newArchEnabled["']?\s*:\s*true/.test(text);
}

// ── main ───────────────────────────────────────────────────────────────────

function detect() {
  const pkgPath = path.join(cwd, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    process.stderr.write(
      `detect-rn-flavor: no package.json found in ${cwd}\n` +
      `  Make sure you run this script from the root of your React Native project.\n`
    );
    process.exit(1);
  }

  const pkg = readJson(pkgPath);
  if (!pkg || typeof pkg !== 'object') {
    process.stderr.write(
      `detect-rn-flavor: package.json in ${cwd} is not valid JSON.\n`
    );
    process.exit(1);
  }

  const deps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  // ── flavor ─────────────────────────────────────────────────────────────
  let flavor;
  if ('expo' in deps) {
    flavor = 'expo';
  } else if ('react-native' in deps) {
    flavor = 'bare';
  } else {
    flavor = 'unknown';
  }

  // ── router ─────────────────────────────────────────────────────────────
  let router;
  if ('expo-router' in deps) {
    router = 'expo-router';
  } else if ('@react-navigation/native' in deps) {
    router = 'react-navigation';
  } else {
    router = 'unknown';
  }

  // ── styling ────────────────────────────────────────────────────────────
  let styling;
  if ('nativewind' in deps) {
    styling = 'nativewind';
  } else if ('react-native-unistyles' in deps) {
    styling = 'unistyles';
  } else {
    styling = 'stylesheet';
  }

  // ── rnVersion / sdkVersion ─────────────────────────────────────────────
  const rnRaw =
    deps['react-native'] ||
    pkg.dependencies?.['react-native'] ||
    pkg.devDependencies?.['react-native'] ||
    null;
  const rnVersion = rnRaw ? stripRange(rnRaw) : null;

  const expoRaw =
    deps['expo'] ||
    pkg.dependencies?.['expo'] ||
    pkg.devDependencies?.['expo'] ||
    null;
  const sdkVersion = expoRaw ? stripRange(expoRaw) : null;

  // ── newArch ────────────────────────────────────────────────────────────
  // Three signals — first truthy one wins:
  //   1. react-native >= 0.73 (default-enabled on 0.76+, experimental on 0.73+)
  //   2. "newArchEnabled": true anywhere in package.json
  //   3. newArchEnabled: true in app.json or app.config.js

  let newArch = false;

  if (!newArch && rnVersion) {
    newArch = versionAtLeast(rnVersion, 0, 73);
  }

  if (!newArch) {
    // Search the whole package.json text for the flag
    const pkgText = fs.readFileSync(pkgPath, 'utf-8');
    if (mentionsNewArch(pkgText)) {
      newArch = true;
    }
  }

  if (!newArch) {
    const configCandidates = ['app.json', 'app.config.js', 'app.config.ts'];
    for (const candidate of configCandidates) {
      const candidatePath = path.join(cwd, candidate);
      if (fs.existsSync(candidatePath)) {
        const text = fs.readFileSync(candidatePath, 'utf-8');
        if (mentionsNewArch(text)) {
          newArch = true;
          break;
        }
      }
    }
  }

  // ── output ─────────────────────────────────────────────────────────────
  const result = { flavor, router, styling, newArch, sdkVersion, rnVersion };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(0);
}

try {
  detect();
} catch (err) {
  process.stderr.write(`detect-rn-flavor: unexpected error: ${err.message}\n`);
  process.exit(1);
}
