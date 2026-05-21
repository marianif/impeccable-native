#!/usr/bin/env node

/**
 * platform-parity.mjs
 *
 * Statically checks .ts and .tsx files for known iOS/Android divergence
 * pitfalls that cause one platform to silently break while the other works.
 *
 * Usage:
 *   node platform-parity.mjs [--dir=path] [--file=path]
 *
 * Flags:
 *   --dir=path    Scan all .ts/.tsx files under this directory (default: cwd).
 *   --file=path   Scan a single file only.
 *
 * Output (stdout, JSON):
 *   {
 *     "findings": [
 *       {
 *         "rule":        string,   // rule ID
 *         "description": string,   // human-readable explanation
 *         "severity":    "error" | "warning",
 *         "file":        string,
 *         "line":        number,
 *         "snippet":     string    // trimmed source line
 *       }
 *     ],
 *     "summary": {
 *       "totalFiles":   number,
 *       "errors":       number,
 *       "warnings":     number,
 *       "passed":       boolean   // true if zero errors
 *     }
 *   }
 *
 * Rules checked:
 *   PP001  shadowColor without elevation   — iOS shadow with no Android fallback
 *   PP002  elevation without shadowColor   — Android elevation with no iOS shadow
 *   PP003  KeyboardAvoidingView missing platform-split behavior
 *   PP004  Haptics call without iOS guard
 *   PP005  Platform-divergent style prop used outside Platform.select / Platform.OS
 */

import fs from 'fs';
import path from 'path';

// ── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const singleFile = (() => {
  const flag = args.find(a => a.startsWith('--file='));
  return flag ? path.resolve(flag.split('=')[1]) : null;
})();
const rootDir = (() => {
  const flag = args.find(a => a.startsWith('--dir='));
  return flag ? path.resolve(flag.split('=')[1]) : process.cwd();
})();

// ── file discovery ─────────────────────────────────────────────────────────

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.expo', '.metro-cache',
  'android', 'ios', '__generated__', 'coverage',
]);

function collectFiles(dir, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, results);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

// ── helpers ────────────────────────────────────────────────────────────────

/**
 * Split source into lines and return a helper that converts a regex match
 * index to a 1-based line number plus the trimmed source line.
 */
function makeLocator(source) {
  const lines = source.split('\n');
  const offsets = [];
  let off = 0;
  for (const line of lines) {
    offsets.push(off);
    off += line.length + 1;
  }
  return function locate(charIndex) {
    let lo = 0, hi = offsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (offsets[mid] <= charIndex) lo = mid; else hi = mid - 1;
    }
    return { line: lo + 1, snippet: lines[lo].trim() };
  };
}

/**
 * Return true if the source text within windowChars characters *before*
 * charIndex contains a reference to Platform.OS or Platform.select —
 * indicating the prop is already gated.
 */
function hasPlatformGateNear(source, charIndex, windowChars = 400) {
  const start = Math.max(0, charIndex - windowChars);
  const slice = source.slice(start, charIndex + windowChars);
  return /Platform\.(?:OS|select)/.test(slice);
}

/**
 * Return true if the line or nearby context contains a Platform.OS iOS guard.
 * Used for haptics checks.
 */
function hasIosGuardNear(source, charIndex, windowChars = 300) {
  const start = Math.max(0, charIndex - windowChars);
  const slice = source.slice(start, charIndex + windowChars);
  return /Platform\.OS\s*===?\s*['"]ios['"]/.test(slice) ||
         /Platform\.OS\s*!==?\s*['"]android['"]/.test(slice) ||
         /Platform\.select\s*\(\s*\{/.test(slice);
}

// ── rules ──────────────────────────────────────────────────────────────────

/**
 * PP001: shadowColor without elevation in the same StyleSheet.create block
 * or style object. iOS-only shadow — Android gets no depth.
 *
 * Heuristic: find `shadowColor` occurrences; within the enclosing style
 * block (heuristically: the nearest enclosing `{...}` up to 600 chars),
 * check whether `elevation` also appears.
 */
function checkPP001(source, rel, locate) {
  const findings = [];
  const re = /\bshadowColor\s*:/g;
  for (const m of source.matchAll(re)) {
    // Look for elevation within 600 chars in either direction (same block)
    const start = Math.max(0, m.index - 100);
    const end = Math.min(source.length, m.index + 600);
    const block = source.slice(start, end);
    if (!/\belevation\s*:/.test(block)) {
      const { line, snippet } = locate(m.index);
      findings.push({
        rule: 'PP001',
        description: 'shadowColor used without a paired elevation — iOS gets depth, Android gets nothing. Add elevation to a platform-split token or use Platform.select.',
        severity: 'error',
        file: rel,
        line,
        snippet,
      });
    }
  }
  return findings;
}

/**
 * PP002: elevation without shadowColor in the same style block.
 * Android gets depth, iOS gets nothing.
 */
function checkPP002(source, rel, locate) {
  const findings = [];
  const re = /\belevation\s*:/g;
  for (const m of source.matchAll(re)) {
    const start = Math.max(0, m.index - 100);
    const end = Math.min(source.length, m.index + 600);
    const block = source.slice(start, end);
    if (!/\bshadowColor\s*:/.test(block)) {
      const { line, snippet } = locate(m.index);
      findings.push({
        rule: 'PP002',
        description: 'elevation used without paired shadowColor — Android gets depth, iOS gets nothing. Add shadowColor/shadowOffset/shadowOpacity/shadowRadius or use Platform.select.',
        severity: 'warning',
        file: rel,
        line,
        snippet,
      });
    }
  }
  return findings;
}

/**
 * PP003: KeyboardAvoidingView without a platform-split behavior prop.
 * behavior="padding" works on iOS; behavior="height" is needed on Android.
 * Using a hardcoded value on one platform silently breaks the other.
 */
function checkPP003(source, rel, locate) {
  const findings = [];
  // Find KeyboardAvoidingView JSX openings
  const re = /<KeyboardAvoidingView\b/g;
  for (const m of source.matchAll(re)) {
    // Extract the props block: from the match to the next >
    const end = Math.min(source.length, m.index + 600);
    const tag = source.slice(m.index, end);

    // If behavior prop is present, check it uses Platform.OS or Platform.select
    const hasBehavior = /\bbehavior\s*=/.test(tag);
    if (!hasBehavior) {
      // No behavior at all — defaults vary by RN version, risky
      const { line, snippet } = locate(m.index);
      findings.push({
        rule: 'PP003',
        description: 'KeyboardAvoidingView has no behavior prop. Default behavior differs by platform and RN version. Use behavior={Platform.OS === "ios" ? "padding" : "height"}.',
        severity: 'warning',
        file: rel,
        line,
        snippet,
      });
    } else if (!/Platform\.(?:OS|select)/.test(tag)) {
      // behavior is hardcoded — not platform-split
      const { line, snippet } = locate(m.index);
      findings.push({
        rule: 'PP003',
        description: 'KeyboardAvoidingView behavior is not platform-split. Use behavior={Platform.OS === "ios" ? "padding" : "height"} to avoid keyboard overlap on one platform.',
        severity: 'error',
        file: rel,
        line,
        snippet,
      });
    }
  }
  return findings;
}

/**
 * PP004: expo-haptics calls without an iOS guard.
 * Haptic APIs are iOS-only in expo-haptics; on Android they silently no-op
 * in most versions but can throw on older SDK. More importantly, not guarding
 * means the developer hasn't thought about the Android equivalent.
 *
 * We flag calls to Haptics.impactAsync / Haptics.notificationAsync /
 * Haptics.selectionAsync that are not inside a Platform.OS === 'ios' guard.
 */
function checkPP004(source, rel, locate) {
  const findings = [];
  const re = /Haptics\.(impactAsync|notificationAsync|selectionAsync)\s*\(/g;
  for (const m of source.matchAll(re)) {
    if (!hasIosGuardNear(source, m.index)) {
      const { line, snippet } = locate(m.index);
      findings.push({
        rule: 'PP004',
        description: `Haptics.${m[1]}() called without a Platform.OS === 'ios' guard. expo-haptics is iOS-only; wrap in Platform.OS === 'ios' or provide an Android alternative.`,
        severity: 'warning',
        file: rel,
        line,
        snippet,
      });
    }
  }
  return findings;
}

/**
 * PP005: iOS-only shadow props (shadowOffset, shadowOpacity, shadowRadius)
 * used outside a Platform.select or Platform.OS check.
 * These props are silently ignored on Android; elevation is needed instead.
 */
function checkPP005(source, rel, locate) {
  const findings = [];
  const re = /\b(shadowOffset|shadowOpacity|shadowRadius)\s*:/g;
  for (const m of source.matchAll(re)) {
    if (!hasPlatformGateNear(source, m.index)) {
      const { line, snippet } = locate(m.index);
      findings.push({
        rule: 'PP005',
        description: `${m[1]} is iOS-only and silently ignored on Android. Wrap in Platform.select or use platform-split shadow tokens from tokens.ts.`,
        severity: 'warning',
        file: rel,
        line,
        snippet,
      });
    }
  }
  return findings;
}

// ── main ───────────────────────────────────────────────────────────────────

function run() {
  let files;

  if (singleFile) {
    if (!fs.existsSync(singleFile)) {
      process.stderr.write(`platform-parity: file not found: ${singleFile}\n`);
      process.exit(1);
    }
    files = [singleFile];
  } else {
    if (!fs.existsSync(rootDir)) {
      process.stderr.write(
        `platform-parity: directory not found: ${rootDir}\n` +
        `  Run from the root of your React Native project, or pass --dir=path.\n`
      );
      process.exit(1);
    }
    files = collectFiles(rootDir);
    if (files.length === 0) {
      process.stderr.write(
        `platform-parity: no .ts/.tsx files found under ${rootDir}\n`
      );
      process.exit(1);
    }
  }

  const allFindings = [];

  for (const filePath of files) {
    let source;
    try {
      source = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    // Skip files that don't touch any of the relevant APIs — fast path
    const relevant =
      /shadowColor|elevation|KeyboardAvoidingView|Haptics\.|shadowOffset|shadowOpacity|shadowRadius/.test(source);
    if (!relevant) continue;

    const rel = singleFile ? filePath : path.relative(rootDir, filePath);
    const locate = makeLocator(source);

    allFindings.push(
      ...checkPP001(source, rel, locate),
      ...checkPP002(source, rel, locate),
      ...checkPP003(source, rel, locate),
      ...checkPP004(source, rel, locate),
      ...checkPP005(source, rel, locate),
    );
  }

  // Deduplicate: same rule + file + line → keep first
  const seen = new Set();
  const findings = allFindings.filter(f => {
    const key = `${f.rule}:${f.file}:${f.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort: errors first, then by file + line
  findings.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });

  const errors = findings.filter(f => f.severity === 'error').length;
  const warnings = findings.filter(f => f.severity === 'warning').length;

  const result = {
    findings,
    summary: {
      totalFiles: files.length,
      errors,
      warnings,
      passed: errors === 0,
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  // Exit 1 if there are errors (warnings are non-blocking)
  process.exit(errors > 0 ? 1 : 0);
}

try {
  run();
} catch (err) {
  process.stderr.write(`platform-parity: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
