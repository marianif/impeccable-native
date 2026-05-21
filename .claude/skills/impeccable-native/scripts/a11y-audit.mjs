#!/usr/bin/env node

/**
 * a11y-audit.mjs
 *
 * Static accessibility analysis for React Native .ts/.tsx files. Catches the
 * most common, statically-detectable a11y omissions that break VoiceOver and
 * TalkBack. This is a gate for audit.md's A11y dimension — it finds missing
 * props, not narration quality. A clean run is necessary, not sufficient.
 *
 * Usage:
 *   node a11y-audit.mjs [--dir=path] [--file=path]
 *
 * Output (stdout, JSON):
 *   {
 *     "findings": [
 *       { "rule", "description", "severity", "file", "line", "snippet" }
 *     ],
 *     "summary": { "totalFiles", "errors", "warnings", "passed" }
 *   }
 *
 * Rules:
 *   A11Y001  Pressable/Touchable* without accessibilityRole
 *   A11Y002  Pressable/Touchable* without accessibilityLabel AND no text child
 *   A11Y003  Image without accessibilityLabel and not explicitly hidden
 *   A11Y004  accessibilityRole="button" with neither label nor visible text
 *   A11Y005  TextInput without an associated label (accessibilityLabel / placeholder is not a label)
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

const INTERACTIVE_TAGS = [
  'Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'TouchableNativeFeedback',
];

/**
 * Given the source and the index of an opening JSX tag (`<Tag`), return the
 * full opening tag text up to the matching `>` (handles nested braces for
 * expression props). Returns { tagText, endIndex }.
 */
function readOpeningTag(source, startIndex) {
  let depth = 0;       // brace depth for {expression} props
  let i = startIndex;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) {
      return { tagText: source.slice(startIndex, i + 1), endIndex: i };
    }
  }
  // Unterminated — return a bounded slice
  return { tagText: source.slice(startIndex, startIndex + 400), endIndex: startIndex + 400 };
}

/**
 * Does the element starting at openTagEnd contain a JSX text child or a
 * <Text> element before ITS OWN closing tag?
 *
 * The window must stop at this element's matching close tag, otherwise a
 * downstream sibling's <Text> leaks in and produces false negatives. We track
 * nesting depth of same-named tags to find the matching `</tagName>`.
 */
function hasTextChild(source, openTagEnd, tagName) {
  // If self-closing, no children
  if (source[openTagEnd - 1] === '/') return false;

  // Find this element's matching closing tag, tracking nested same-name tags.
  const childrenStart = openTagEnd + 1;
  let depth = 1;
  let i = childrenStart;
  const openRe = new RegExp(`<${tagName}(?=[\\s/>])`, 'g');
  const closeRe = new RegExp(`</${tagName}\\s*>`, 'g');
  // Bounded scan to avoid pathological cost
  const limit = Math.min(source.length, openTagEnd + 4000);
  let closeIndex = -1;
  while (i < limit) {
    openRe.lastIndex = i;
    closeRe.lastIndex = i;
    const nextOpen = openRe.exec(source);
    const nextClose = closeRe.exec(source);
    if (!nextClose || nextClose.index >= limit) break;
    if (nextOpen && nextOpen.index < nextClose.index) {
      // Skip self-closing nested opens (they don't add depth)
      const { tagText } = readOpeningTag(source, nextOpen.index);
      if (!/\/>\s*$/.test(tagText)) depth++;
      i = nextOpen.index + nextOpen[0].length;
    } else {
      depth--;
      if (depth === 0) { closeIndex = nextClose.index; break; }
      i = nextClose.index + nextClose[0].length;
    }
  }

  const end = closeIndex >= 0 ? closeIndex : Math.min(source.length, openTagEnd + 600);
  const window = source.slice(childrenStart, end);

  // A <Text ...> child within this element's own subtree
  if (/<Text[\s>]/.test(window)) return true;
  // Literal text node: word chars appearing as a text node (not inside a tag)
  if (/^[^<{]*[A-Za-z0-9]/.test(window.replace(/^\s+/, ''))) return true;
  return false;
}

function hasProp(tagText, prop) {
  return new RegExp(`\\b${prop}\\s*=`).test(tagText);
}

function isHiddenFromA11y(tagText) {
  return (
    /accessibilityElementsHidden\s*=\s*\{?\s*true/.test(tagText) ||
    /importantForAccessibility\s*=\s*["'{]?\s*no-hide-descendants/.test(tagText) ||
    /importantForAccessibility\s*=\s*["'{]?\s*no\b/.test(tagText) ||
    /accessible\s*=\s*\{?\s*false/.test(tagText) ||
    /aria-hidden/.test(tagText)
  );
}

// ── rules ──────────────────────────────────────────────────────────────────

function checkInteractive(source, rel, locate) {
  const findings = [];
  for (const tag of INTERACTIVE_TAGS) {
    const re = new RegExp(`<${tag}(?=[\\s/>])`, 'g');
    for (const m of source.matchAll(re)) {
      const { tagText, endIndex } = readOpeningTag(source, m.index);
      const { line, snippet } = locate(m.index);

      // Skip if explicitly hidden from a11y
      if (isHiddenFromA11y(tagText)) continue;

      const hasRole = hasProp(tagText, 'accessibilityRole') || hasProp(tagText, 'role');
      const hasLabel = hasProp(tagText, 'accessibilityLabel') || hasProp(tagText, 'aria-label');
      const textChild = hasTextChild(source, endIndex, tag);

      // A11Y001: no role
      if (!hasRole) {
        findings.push({
          rule: 'A11Y001',
          description: `${tag} has no accessibilityRole. Screen readers announce it as a generic touchable. Add accessibilityRole="button" (or link/tab/switch as appropriate).`,
          severity: 'error',
          file: rel, line, snippet,
        });
      }

      // A11Y002: no label and no text child (icon-only buttons are the danger)
      if (!hasLabel && !textChild) {
        findings.push({
          rule: 'A11Y002',
          description: `${tag} has no accessibilityLabel and no visible text child. Icon-only and image-only controls are unreadable to VoiceOver/TalkBack. Add accessibilityLabel.`,
          severity: 'error',
          file: rel, line, snippet,
        });
      }
    }
  }
  return findings;
}

function checkImages(source, rel, locate) {
  const findings = [];
  // Match <Image and <ExpoImage / expo-image's <Image (imported as Image),
  // plus react-native-fast-image FastImage
  const re = /<(Image|FastImage)(?=[\s/>])/g;
  for (const m of source.matchAll(re)) {
    const { tagText } = readOpeningTag(source, m.index);
    const { line, snippet } = locate(m.index);

    if (isHiddenFromA11y(tagText)) continue;

    const hasLabel = hasProp(tagText, 'accessibilityLabel') || hasProp(tagText, 'alt') || hasProp(tagText, 'aria-label');
    const hasA11yRole = /accessibilityRole\s*=\s*["'{]?\s*image/.test(tagText);

    // An image that is neither labeled nor hidden is ambiguous: decorative
    // images should be hidden, meaningful images should be labeled.
    if (!hasLabel) {
      findings.push({
        rule: 'A11Y003',
        description: `${m[1]} has no accessibilityLabel and is not hidden. If meaningful, add accessibilityLabel + accessibilityRole="image". If decorative, add accessibilityElementsHidden + importantForAccessibility="no-hide-descendants".`,
        severity: hasA11yRole ? 'error' : 'warning',
        file: rel, line, snippet,
      });
    }
  }
  return findings;
}

function checkRoleButtonNoLabel(source, rel, locate) {
  const findings = [];
  // Any element with accessibilityRole="button" should have a label or text.
  // We catch the generic case where role=button is on a View (no text child).
  const re = /accessibilityRole\s*=\s*["'{]?\s*button/g;
  for (const m of source.matchAll(re)) {
    // Find the start of the enclosing tag (scan back to nearest `<`)
    const tagStart = source.lastIndexOf('<', m.index);
    if (tagStart < 0) continue;
    const { tagText, endIndex } = readOpeningTag(source, tagStart);
    const { line, snippet } = locate(tagStart);

    const hasLabel = hasProp(tagText, 'accessibilityLabel') || hasProp(tagText, 'aria-label');
    const tagNameMatch = tagText.match(/^<(\w+)/);
    const tagName = tagNameMatch ? tagNameMatch[1] : 'element';
    const textChild = hasTextChild(source, endIndex, tagName);

    if (!hasLabel && !textChild) {
      findings.push({
        rule: 'A11Y004',
        description: `${tagName} declares accessibilityRole="button" but has neither accessibilityLabel nor visible text. Screen readers announce "button" with no name.`,
        severity: 'error',
        file: rel, line, snippet,
      });
    }
  }
  return findings;
}

function checkTextInput(source, rel, locate) {
  const findings = [];
  const re = /<TextInput(?=[\s/>])/g;
  for (const m of source.matchAll(re)) {
    const { tagText } = readOpeningTag(source, m.index);
    const { line, snippet } = locate(m.index);

    const hasLabel = hasProp(tagText, 'accessibilityLabel') || hasProp(tagText, 'aria-label');
    // placeholder is NOT an accessibility label — it disappears on input and
    // is inconsistently read. We warn if there's only a placeholder.
    const hasPlaceholderOnly = hasProp(tagText, 'placeholder') && !hasLabel;

    if (!hasLabel) {
      findings.push({
        rule: 'A11Y005',
        description: hasPlaceholderOnly
          ? 'TextInput relies on placeholder only. Placeholder is not an accessibility label — it vanishes on input. Add accessibilityLabel or a visible <Text> label associated with the field.'
          : 'TextInput has no accessibilityLabel and no associated visible label. Add accessibilityLabel or pair with a visible label.',
        severity: 'warning',
        file: rel, line, snippet,
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
      process.stderr.write(`a11y-audit: file not found: ${singleFile}\n`);
      process.exit(1);
    }
    files = [singleFile];
  } else {
    if (!fs.existsSync(rootDir)) {
      process.stderr.write(
        `a11y-audit: directory not found: ${rootDir}\n` +
        `  Run from the root of your React Native project, or pass --dir=path.\n`
      );
      process.exit(1);
    }
    files = collectFiles(rootDir);
    if (files.length === 0) {
      process.stderr.write(`a11y-audit: no .ts/.tsx files found under ${rootDir}\n`);
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

    // Fast path: skip files with no relevant JSX
    const relevant =
      /<(Pressable|Touchable\w*|Image|FastImage|TextInput)[\s/>]|accessibilityRole/.test(source);
    if (!relevant) continue;

    const rel = singleFile ? filePath : path.relative(rootDir, filePath);
    const locate = makeLocator(source);

    allFindings.push(
      ...checkInteractive(source, rel, locate),
      ...checkImages(source, rel, locate),
      ...checkRoleButtonNoLabel(source, rel, locate),
      ...checkTextInput(source, rel, locate),
    );
  }

  // Deduplicate
  const seen = new Set();
  const findings = allFindings.filter(f => {
    const key = `${f.rule}:${f.file}:${f.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

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
  process.exit(errors > 0 ? 1 : 0);
}

try {
  run();
} catch (err) {
  process.stderr.write(`a11y-audit: unexpected error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
}
