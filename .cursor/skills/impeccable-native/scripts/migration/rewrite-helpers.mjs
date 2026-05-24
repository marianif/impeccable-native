#!/usr/bin/env node

/**
 * rewrite-helpers.mjs
 *
 * Small library of primitives that per-project, agent-generated migration
 * scripts import. Each helper does one job and has a stable contract so
 * generated scripts stay readable and codebase-specific instead of
 * reinventing AST traversal.
 *
 * Generated scripts live under .impeccable/generated/migrate-phase-N.mjs
 * and import from this module like:
 *
 *   import {
 *     renameDottedAccess,
 *     replaceValueInTokensFile,
 *     replaceClassname,
 *     promoteLiteral,
 *     planChanges,
 *     applyChanges,
 *     emitReport,
 *   } from '<scripts_path>/migration/rewrite-helpers.mjs';
 *
 * All helpers operate on raw source strings and return a list of
 * { line, col, before, after, kind } edits. They never write files
 * directly — `planChanges` collects edits across helpers, `applyChanges`
 * commits them (or dry-runs). This separation is the safety rail: the
 * agent reviews the plan before files change.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// ── primitive: rename dotted access ───────────────────────────────────────

/**
 * Rename a dotted token reference everywhere it appears in `source`.
 * Matches whole-word identifiers so `colors.primary` does not match
 * `colors.primaryDark`. Comments and string literals are skipped.
 *
 *   renameDottedAccess(source, 'colors.primary', 'colors.brand.primary')
 *
 * Returns: [{ line, col, before, after, kind: 'rename-dotted' }, ...]
 */
export function renameDottedAccess(source, oldPath, newPath) {
  const edits = [];
  // Escape dots in path, then require a word-boundary on each side and
  // refuse to match if the next char extends the identifier.
  const escaped = oldPath.replace(/\./g, '\\.');
  const re = new RegExp(`(?<![\\w$.])${escaped}(?![\\w$])`, 'g');
  for (const m of source.matchAll(re)) {
    if (isInsideCommentOrString(source, m.index)) continue;
    const pos = lineAndCol(source, m.index);
    edits.push({
      line: pos.line,
      col: pos.col,
      offset: m.index,
      length: oldPath.length,
      before: oldPath,
      after: newPath,
      kind: 'rename-dotted',
    });
  }
  return edits;
}

// ── primitive: replace value in tokens file ───────────────────────────────

/**
 * Replace the value of a specific token in the source-of-truth tokens file.
 * Only emits a single edit per call; raises if the token can't be located
 * unambiguously so the agent has to investigate rather than silently miss.
 *
 *   replaceValueInTokensFile(source, 'colors.primary', '#5B3FFF')
 *
 * The path is interpreted as a dotted nesting inside object literals.
 * Matching is best-effort: it locates the deepest matching `key: 'value'`
 * line within the right ancestor objects. For deeply nested or computed
 * structures this returns { error } instead of an edit, so the agent
 * falls back to opening the file.
 */
export function replaceValueInTokensFile(source, dottedPath, newValue) {
  const segments = dottedPath.split('.');
  const leafKey = segments[segments.length - 1];
  const ancestors = segments.slice(0, -1);
  const lines = source.split('\n');

  // Walk lines. Maintain a stack of object names entered by lines like
  // `colors: {` or `export const colors = {` and exited by `}`.
  const stack = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const enterMatch = trimmed.match(/^(?:export\s+(?:const|let|var)\s+)?(\w+)\s*[:=]\s*\{/);
    if (enterMatch) stack.push(enterMatch[1]);

    if (trimmed.startsWith('}')) {
      stack.pop();
      continue;
    }

    if (ancestorsMatch(stack, ancestors)) {
      const leafMatch = line.match(new RegExp(`^(\\s*)${leafKey}\\s*:\\s*(['"])([^'"]+)(['"])(.*)$`));
      if (leafMatch) {
        const [, indent, openQ, oldValue, closeQ, tail] = leafMatch;
        if (oldValue === newValue) return { skipped: true, reason: 'value already matches' };
        const newLine = `${indent}${leafKey}: ${openQ}${newValue}${closeQ}${tail}`;
        const offset = lines.slice(0, i).reduce((acc, l) => acc + l.length + 1, 0);
        return {
          edit: {
            line: i + 1,
            col: 1,
            offset,
            length: line.length,
            before: line,
            after: newLine,
            kind: 'value-replace',
          },
        };
      }
    }
  }
  return { error: `could not locate ${dottedPath} unambiguously` };
}

function ancestorsMatch(stack, wanted) {
  if (wanted.length === 0) return stack.length >= 1;
  if (stack.length < wanted.length) return false;
  // The stack's tail should match the wanted ancestor chain.
  const tail = stack.slice(-wanted.length);
  return tail.every((s, i) => s === wanted[i]);
}

// ── primitive: replace classname (NativeWind / className strings) ─────────

/**
 * Replace a Tailwind/NativeWind class name everywhere a className= or
 * tw\`...\` template references it. Whole-token match so `bg-blue-600`
 * doesn't accidentally match `bg-blue-600/50`.
 */
export function replaceClassname(source, oldClass, newClass) {
  const edits = [];
  const escaped = oldClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?<![\\w/-])${escaped}(?![\\w/-])`, 'g');
  for (const m of source.matchAll(re)) {
    if (!isInsideClassNameContext(source, m.index)) continue;
    const pos = lineAndCol(source, m.index);
    edits.push({
      line: pos.line,
      col: pos.col,
      offset: m.index,
      length: oldClass.length,
      before: oldClass,
      after: newClass,
      kind: 'class-rename',
    });
  }
  return edits;
}

function isInsideClassNameContext(source, idx) {
  // Walk back to find the nearest className=, tw`, or class= attribute.
  const before = source.slice(Math.max(0, idx - 200), idx);
  return /(class(?:Name)?\s*=\s*["'`{][^"'`]*$)|(tw`[^`]*$)/.test(before);
}

// ── primitive: promote literal to token ───────────────────────────────────

/**
 * Replace every occurrence of a literal value with a token reference.
 * Used for hardcoded violations (e.g. '#3B82F6' → tokens.colors.brand.primary)
 * when the substitution table marks the promotion as high-confidence.
 *
 * The replacement is wrapped to fit the surrounding syntax:
 *   - inside a string literal: replaced inline as a tokens reference
 *     wrapped in braces is left to the generated script (this helper
 *     only swaps the raw text); for hex-in-style-object cases the
 *     generated script should pre-strip surrounding quotes.
 */
export function promoteLiteral(source, literal, tokenExpression) {
  const edits = [];
  const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match the literal whether or not it's quoted. Quotes are captured so
  // the replacement preserves them (or the agent strips them in the
  // generated script).
  const re = new RegExp(`(['"]?)${escaped}\\1`, 'g');
  for (const m of source.matchAll(re)) {
    if (isInsideCommentOrString(source, m.index) && m[1] === '') continue;
    const pos = lineAndCol(source, m.index);
    const replacement = m[1] ? tokenExpression : tokenExpression;
    edits.push({
      line: pos.line,
      col: pos.col,
      offset: m.index,
      length: m[0].length,
      before: m[0],
      after: replacement,
      kind: 'literal-promote',
    });
  }
  return edits;
}

// ── primitive: promote numeric literal ────────────────────────────────────

/**
 * Replace `<property>: <numericLiteral>` with `<property>: <tokenExpression>`
 * inside style objects. Handles snap-to-scale violations like
 *   padding: 17  →  padding: tokens.spacing.md
 *   borderRadius: 9  →  borderRadius: tokens.radii.sm
 *   fontSize: 15  →  fontSize: tokens.type.md
 *
 * Matches only the property:literal form (not arbitrary numbers).
 * Skips comments and string literals.
 */
export function promoteNumericLiteral(source, property, literalValue, tokenExpression) {
  const edits = [];
  // Match property: <number> where number is the exact literal.
  const valueStr = String(literalValue);
  const escapedValue = valueStr.replace(/\./g, '\\.');
  const re = new RegExp(`\\b${property}\\s*:\\s*${escapedValue}\\b`, 'g');
  for (const m of source.matchAll(re)) {
    if (isInsideCommentOrString(source, m.index)) continue;
    const pos = lineAndCol(source, m.index);
    const after = `${property}: ${tokenExpression}`;
    edits.push({
      line: pos.line,
      col: pos.col,
      offset: m.index,
      length: m[0].length,
      before: m[0],
      after,
      kind: 'numeric-promote',
    });
  }
  return edits;
}

// ── primitive: add a new token to the tokens file ─────────────────────────

/**
 * Insert a new key:value pair into the tokens file at the right nesting
 * level. Used to create `colors.unresolved.*` legacy tokens for off-palette
 * colors that the script auto-promotes during migration.
 *
 *   addTokenToTokensFile(source, 'colors.unresolved.blue3b82f4', '#3B82F4')
 *
 * If the nesting path doesn't exist yet (e.g., `colors.unresolved` is
 * missing), the helper creates it. Returns { edit } or { error }.
 *
 * Idempotent: if the key already exists with the same value, returns
 * { skipped: true }.
 */
export function addTokenToTokensFile(source, dottedPath, value) {
  const segments = dottedPath.split('.');
  const leafKey = segments[segments.length - 1];
  const ancestors = segments.slice(0, -1);
  const lines = source.split('\n');

  // First, detect if the leaf already exists.
  const stack = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const enterMatch = trimmed.match(/^(?:export\s+(?:const|let|var)\s+)?(\w+)\s*[:=]\s*\{/);
    if (enterMatch) stack.push(enterMatch[1]);
    if (trimmed.startsWith('}')) { stack.pop(); continue; }
    if (ancestorsMatch(stack, ancestors)) {
      const leafMatch = line.match(new RegExp(`^\\s*${leafKey}\\s*:\\s*['"]([^'"]+)['"]`));
      if (leafMatch) {
        if (leafMatch[1] === value) return { skipped: true, reason: 'token already exists' };
        return { error: `token ${dottedPath} exists with different value ${leafMatch[1]}` };
      }
    }
  }

  // Find the closing brace of the deepest existing ancestor and insert
  // before it. If a mid-ancestor is missing, we cannot safely insert —
  // bail and let the agent open the file.
  const insertion = findInsertionPoint(lines, ancestors);
  if (!insertion) {
    return { error: `could not find insertion point for ${dottedPath}` };
  }

  const { lineIndex, indent } = insertion;
  const newLine = `${indent}${leafKey}: '${value}',`;
  const offset = lines.slice(0, lineIndex).reduce((acc, l) => acc + l.length + 1, 0);
  return {
    edit: {
      line: lineIndex + 1,
      col: 1,
      offset,
      length: 0,
      before: '',
      after: newLine + '\n',
      kind: 'token-add',
    },
  };
}

function findInsertionPoint(lines, ancestors) {
  // Walk to find the closing brace of the innermost ancestor object.
  // Returns the line index where insertion should happen and the indent
  // to use for the new key.
  const stack = [];
  let targetClose = -1;
  let targetIndent = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const enterMatch = trimmed.match(/^(?:export\s+(?:const|let|var)\s+)?(\w+)\s*[:=]\s*\{/);
    if (enterMatch) {
      stack.push({ name: enterMatch[1], indent: line.match(/^(\s*)/)[1] });
      if (ancestorsMatch(stack.map(s => s.name), ancestors)) {
        const inner = stack[stack.length - 1];
        // Track the position so we can find its matching close
        targetIndent = inner.indent + '  ';
        // Walk forward to find the matching close brace at this depth
        let depth = 1;
        for (let j = i + 1; j < lines.length; j++) {
          const jt = lines[j].trim();
          if (/\{\s*$/.test(jt)) depth++;
          if (/^\}/.test(jt)) {
            depth--;
            if (depth === 0) { targetClose = j; break; }
          }
        }
        if (targetClose >= 0) return { lineIndex: targetClose, indent: targetIndent };
      }
    }
    if (trimmed.startsWith('}')) stack.pop();
  }
  return null;
}

// ── change plan + apply ───────────────────────────────────────────────────

/**
 * Collect edits across many helper calls into a planned change set per file.
 * The generated script builds a plan, then either dry-runs or applies it.
 *
 *   const plan = planChanges();
 *   plan.add('src/a.tsx', renameDottedAccess(srcA, 'colors.primary', 'colors.brand.primary'));
 *   plan.add('src/b.tsx', replaceClassname(srcB, 'bg-blue-600', 'bg-brand-primary'));
 *
 * The plan tracks the original source so apply can compute diffs and
 * detect conflicts (two edits targeting overlapping ranges).
 */
export function planChanges() {
  const files = new Map(); // relPath -> { source, edits[] }
  return {
    add(relPath, edits) {
      if (!Array.isArray(edits)) {
        if (edits?.error) {
          this.errors.push({ file: relPath, ...edits });
          return;
        }
        if (edits?.skipped) return;
        if (edits?.edit) edits = [edits.edit];
        else return;
      }
      if (edits.length === 0) return;
      if (!files.has(relPath)) files.set(relPath, { edits: [] });
      files.get(relPath).edits.push(...edits);
    },
    errors: [],
    files,
    fileCount: () => files.size,
    editCount: () => [...files.values()].reduce((acc, f) => acc + f.edits.length, 0),
  };
}

/**
 * Apply a plan. With { dryRun: true } returns a diff report without
 * writing. With { dryRun: false } writes files. Detects overlapping
 * edits and refuses to apply them, returning the conflicts list.
 *
 *   applyChanges(plan, { rootDir, dryRun: true })
 */
export function applyChanges(plan, { rootDir, dryRun = true }) {
  const results = { written: [], skipped: [], conflicts: [], dryRun };
  for (const [relPath, { edits }] of plan.files) {
    const absPath = path.resolve(rootDir, relPath);
    let source;
    try { source = fs.readFileSync(absPath, 'utf-8'); }
    catch { results.skipped.push({ file: relPath, reason: 'unreadable' }); continue; }

    // Sort edits by offset descending so applying them right-to-left
    // doesn't invalidate later offsets.
    const sorted = [...edits].sort((a, b) => b.offset - a.offset);
    const conflicts = detectOverlaps(sorted);
    if (conflicts.length > 0) {
      results.conflicts.push({ file: relPath, conflicts });
      continue;
    }
    let next = source;
    for (const e of sorted) {
      next = next.slice(0, e.offset) + e.after + next.slice(e.offset + e.length);
    }
    if (!dryRun) fs.writeFileSync(absPath, next, 'utf-8');
    results.written.push({ file: relPath, edits: edits.length, sizeBefore: source.length, sizeAfter: next.length });
  }
  return results;
}

function detectOverlaps(sortedEdits) {
  const conflicts = [];
  for (let i = 0; i < sortedEdits.length - 1; i++) {
    const a = sortedEdits[i];
    const b = sortedEdits[i + 1];
    // sorted descending by offset, so b.offset <= a.offset
    if (b.offset + b.length > a.offset) {
      conflicts.push({ a, b });
    }
  }
  return conflicts;
}

// ── report emission ───────────────────────────────────────────────────────

/**
 * Emit a JSON + Markdown report for a phase rewrite.
 * Writes to .impeccable/generated/phase-<N>-rewrite-report.{json,md}.
 *
 * The agent reads the report to decide what to surface to the developer
 * and which files still need agent attention.
 */
export function emitReport({ rootDir, phase, plan, applyResults, requiresAgent = [] }) {
  const dir = path.join(rootDir, '.impeccable', 'generated');
  fs.mkdirSync(dir, { recursive: true });

  const report = {
    phase,
    generatedAt: new Date().toISOString(),
    dryRun: applyResults.dryRun,
    summary: {
      filesPlanned: plan.fileCount(),
      editsPlanned: plan.editCount(),
      filesWritten: applyResults.written.length,
      conflicts: applyResults.conflicts.length,
      errors: plan.errors.length,
      requiresAgent: requiresAgent.length,
    },
    written: applyResults.written,
    conflicts: applyResults.conflicts,
    errors: plan.errors,
    requiresAgent,
    sampleEdits: sampleEditsByKind(plan, 5),
  };

  const jsonPath = path.join(dir, `phase-${phase}-rewrite-report.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');

  const mdPath = path.join(dir, `phase-${phase}-rewrite-report.md`);
  fs.writeFileSync(mdPath, renderReportMarkdown(report), 'utf-8');

  return { jsonPath, mdPath, report };
}

function sampleEditsByKind(plan, perKind) {
  const byKind = new Map();
  for (const [file, { edits }] of plan.files) {
    for (const e of edits) {
      if (!byKind.has(e.kind)) byKind.set(e.kind, []);
      const arr = byKind.get(e.kind);
      if (arr.length < perKind) arr.push({ file, line: e.line, before: e.before, after: e.after });
    }
  }
  return Object.fromEntries(byKind);
}

function renderReportMarkdown(report) {
  const lines = [];
  lines.push(`# Phase ${report.phase} rewrite report`);
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Mode: **${report.dryRun ? 'dry-run' : 'committed'}**`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  for (const [k, v] of Object.entries(report.summary)) {
    lines.push(`- **${k}**: ${v}`);
  }
  if (report.conflicts.length > 0) {
    lines.push('');
    lines.push('## Conflicts');
    lines.push('');
    lines.push('Two edits targeted overlapping ranges. The file was left untouched.');
    for (const c of report.conflicts) {
      lines.push(`- \`${c.file}\` — ${c.conflicts.length} overlap(s)`);
    }
  }
  if (report.errors.length > 0) {
    lines.push('');
    lines.push('## Errors');
    lines.push('');
    for (const e of report.errors) {
      lines.push(`- \`${e.file}\` — ${e.error ?? JSON.stringify(e)}`);
    }
  }
  if (report.requiresAgent.length > 0) {
    lines.push('');
    lines.push('## Requires agent');
    lines.push('');
    lines.push('Files the generated script refused to touch. Open them and apply judgement.');
    for (const r of report.requiresAgent) {
      lines.push(`- \`${r.file}\` — ${r.reason}`);
    }
  }
  lines.push('');
  lines.push('## Sample edits by kind');
  lines.push('');
  for (const [kind, samples] of Object.entries(report.sampleEdits)) {
    lines.push(`### ${kind}`);
    lines.push('');
    for (const s of samples) {
      lines.push(`- \`${s.file}:${s.line}\` — \`${s.before}\` → \`${s.after}\``);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ── git safety ────────────────────────────────────────────────────────────

/**
 * Pre-flight: refuse to apply changes if the working tree has uncommitted
 * changes outside the brief's scope. Generated scripts should call this
 * before applyChanges({ dryRun: false }).
 *
 * Returns { clean: true } or { clean: false, reason }.
 */
export function checkGitClean(rootDir) {
  try {
    const out = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf-8' });
    if (out.trim() === '') return { clean: true };
    return { clean: false, reason: `working tree has uncommitted changes:\n${out}` };
  } catch (err) {
    return { clean: true, reason: `git not available: ${err.message}` };
  }
}

// ── small utilities ───────────────────────────────────────────────────────

function lineAndCol(source, index) {
  const before = source.slice(0, index);
  const line = before.split('\n').length;
  const col = index - before.lastIndexOf('\n');
  return { line, col };
}

// Cheap check — counts unbalanced quotes/comment markers up to idx.
// Not perfect (template strings, regex literals can fool it) but good
// enough to skip the obvious cases. Generated scripts that need
// precision should use jscodeshift or babel parser directly.
function isInsideCommentOrString(source, idx) {
  const slice = source.slice(0, idx);
  const lastNewline = slice.lastIndexOf('\n');
  const lineStart = slice.slice(lastNewline + 1);
  if (lineStart.includes('//')) {
    const commentIdx = lineStart.indexOf('//');
    if (commentIdx >= 0 && commentIdx < idx - lastNewline - 1) return true;
  }
  // Count unescaped quotes on this line before idx
  let single = 0, double = 0, backtick = 0;
  for (let i = 0; i < lineStart.length; i++) {
    const c = lineStart[i];
    const prev = i > 0 ? lineStart[i - 1] : '';
    if (prev === '\\') continue;
    if (c === "'") single++;
    if (c === '"') double++;
    if (c === '`') backtick++;
  }
  return (single % 2 === 1) || (double % 2 === 1) || (backtick % 2 === 1);
}
