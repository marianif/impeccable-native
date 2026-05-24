#!/usr/bin/env node

/**
 * validate-plan.mjs
 *
 * Schema + refusal-rule validator for design-system-plan.json. Run after the
 * agent authors a plan and BEFORE Act 3 execution. Mirrors the NEVER rules
 * in skill/reference/design-system.md so the doc's guarantees are mechanical,
 * not aspirational.
 *
 * Exit code:
 *   0  — plan is valid (or has only warnings)
 *   1  — plan has hard errors; Act 3 MUST NOT execute
 *
 * Output (stdout, JSON):
 *   {
 *     "verdict": "valid" | "invalid",
 *     "errors":  [{ path, kind, message }],   // hard refusals
 *     "warnings":[{ path, kind, message }],   // soft signals
 *     "summary": { ... }
 *   }
 *
 * Usage:
 *   node validate-plan.mjs [--plan=.impeccable/design-system-plan.json] [--dir=path]
 */

import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
function flag(name) {
  const f = args.find(a => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
}
const rootDir = path.resolve(flag('dir') ?? process.cwd());
const planPath = flag('plan') ?? '.impeccable/design-system-plan.json';

// ── load ──────────────────────────────────────────────────────────────────

function loadPlan() {
  const full = path.isAbsolute(planPath) ? planPath : path.join(rootDir, planPath);
  try {
    return { plan: JSON.parse(fs.readFileSync(full, 'utf-8')), path: path.relative(rootDir, full) };
  } catch (err) {
    return { error: err.message, path: planPath };
  }
}

// ── error/warning accumulators ────────────────────────────────────────────

const errors = [];
const warnings = [];

function err(p, kind, message) { errors.push({ path: p, kind, message }); }
function warn(p, kind, message) { warnings.push({ path: p, kind, message }); }

// ── top-level shape ───────────────────────────────────────────────────────

function validateShape(plan) {
  const required = ['version', 'mode', 'atoms', 'molecules', 'organisms', 'cleanup'];
  for (const key of required) {
    if (!(key in plan)) err(`/${key}`, 'missing-required-field', `Top-level field '${key}' is required.`);
  }
  if (plan.mode && !['brownfield', 'greenfield'].includes(plan.mode)) {
    err('/mode', 'invalid-mode', `mode must be 'brownfield' or 'greenfield'; got '${plan.mode}'.`);
  }
  for (const arrayField of ['atoms', 'molecules', 'organisms']) {
    if (plan[arrayField] != null && !Array.isArray(plan[arrayField])) {
      err(`/${arrayField}`, 'invalid-type', `Field '${arrayField}' must be an array.`);
    }
  }
  if (plan.cleanup != null) {
    if (typeof plan.cleanup !== 'object') err('/cleanup', 'invalid-type', `cleanup must be an object with merges[] and deletions[].`);
    else {
      for (const k of ['merges', 'deletions']) {
        if (plan.cleanup[k] != null && !Array.isArray(plan.cleanup[k])) {
          err(`/cleanup/${k}`, 'invalid-type', `cleanup.${k} must be an array.`);
        }
      }
    }
  }
}

// ── atom / molecule basics ────────────────────────────────────────────────

const VALID_DISPOSITIONS = new Set(['CONFIRM', 'REVISE', 'ADD', 'RETIRE']);

function validateBasicEntry(entry, idx, kind) {
  const p = `/${kind}/${idx}`;
  if (!entry || typeof entry !== 'object') {
    err(p, 'invalid-entry', `${kind} entry must be an object.`);
    return;
  }
  if (!entry.name || typeof entry.name !== 'string') {
    err(p + '/name', 'missing-name', `${kind} entry is missing 'name'.`);
  }
  if (!entry.disposition) {
    err(p + '/disposition', 'missing-disposition', `${kind} '${entry.name}' is missing disposition (CONFIRM | REVISE | ADD | RETIRE).`);
  } else if (!VALID_DISPOSITIONS.has(entry.disposition)) {
    err(p + '/disposition', 'invalid-disposition', `${kind} '${entry.name}': disposition '${entry.disposition}' is not one of CONFIRM | REVISE | ADD | RETIRE.`);
  }
}

// ── organism life block (the five-question gate) ──────────────────────────

function validateOrganism(org, idx) {
  const p = `/organisms/${idx}`;
  validateBasicEntry(org, idx, 'organisms');
  if (!org || typeof org !== 'object') return;

  const life = org.life;
  if (!life || typeof life !== 'object') {
    err(p + '/life', 'missing-life-block', `Organism '${org.name}' is missing its 'life' block. Per the reference doc's refusal rules, organisms must answer all five questions (job / lives_in / states / reacts_to / neighbors). Demote to molecule, move to parking, or fill in life.`);
    return;
  }

  // 1. Job — verb-led sentence required.
  if (!life.job || typeof life.job !== 'string' || life.job.trim().length < 8) {
    err(p + '/life/job', 'missing-job', `Organism '${org.name}': life.job must be a verb-led sentence describing what the user can do or decide (e.g. "Let the user resume a paused workout").`);
  }

  // 2. Lives in — at least one screen/region/priority entry.
  if (!Array.isArray(life.lives_in) || life.lives_in.length === 0) {
    err(p + '/life/lives_in', 'missing-lives-in', `Organism '${org.name}': life.lives_in[] must list at least one home (screen + region + priority). An organism with no home is a molecule in disguise.`);
  } else {
    life.lives_in.forEach((home, i) => {
      if (!home?.screen) err(`${p}/life/lives_in/${i}/screen`, 'incomplete-home', `Organism '${org.name}' home #${i} is missing 'screen'.`);
    });
  }

  // 3. States — ≥ 3 meaningful states.
  if (!Array.isArray(life.states)) {
    err(p + '/life/states', 'missing-states', `Organism '${org.name}': life.states[] is required.`);
  } else if (life.states.length < 3) {
    err(p + '/life/states', 'insufficient-states', `Organism '${org.name}' has ${life.states.length} state(s). Per the refusal rules, organisms must have ≥3. If it truly has fewer, re-classify as a molecule rather than demoting the bar.`);
  } else {
    life.states.forEach((s, i) => {
      if (!s?.name) err(`${p}/life/states/${i}/name`, 'incomplete-state', `Organism '${org.name}' state #${i} is missing 'name'.`);
      if (!s?.when) warn(`${p}/life/states/${i}/when`, 'state-missing-when', `Organism '${org.name}' state '${s?.name}' has no 'when' clause — agent should describe the trigger condition.`);
    });
  }

  // 4. Reacts to — at least one reaction.
  if (!Array.isArray(life.reacts_to) || life.reacts_to.length === 0) {
    err(p + '/life/reacts_to', 'missing-reacts-to', `Organism '${org.name}': life.reacts_to[] must list at least one reaction (scroll, focus, sibling-state, data arrival, etc.). Static organisms are decorations, not organisms.`);
  }

  // 5. Neighbors — ≥ 1 named neighbor, OR an explicit choreography note about solitude.
  const hasNeighbors = Array.isArray(life.neighbors) && life.neighbors.length > 0;
  const hasSolitudeNote = typeof life.solitudeNote === 'string' && life.solitudeNote.trim().length > 0;
  if (!hasNeighbors && !hasSolitudeNote) {
    err(p + '/life/neighbors', 'missing-neighbors', `Organism '${org.name}': life.neighbors[] must name at least one neighbor with a relationship (yields-to, dims-when, coexists), OR provide life.solitudeNote explaining why it has none. Isolated organisms are molecules in disguise.`);
  }

  // Evidence — at least one citation (file:line OR verbatim quote from anatomy/brief).
  if (!Array.isArray(life.evidence) || life.evidence.length === 0) {
    err(p + '/life/evidence', 'missing-evidence', `Organism '${org.name}': life.evidence[] must cite either ≥3 existing use sites (file:line) OR a verbatim quote from app-anatomy.json / brand-brief.json naming the journey or goal this serves.`);
  }

  // Vibe trait — must be present and non-generic.
  if (!life.vibe_trait || typeof life.vibe_trait !== 'string') {
    err(p + '/life/vibe_trait', 'missing-vibe-trait', `Organism '${org.name}': life.vibe_trait must reference a trait from the brand brief (e.g. "encouraging, not nagging").`);
  } else if (/^(modern|clean|minimal|simple|elegant)$/i.test(life.vibe_trait.trim())) {
    warn(p + '/life/vibe_trait', 'generic-vibe-trait', `Organism '${org.name}': vibe_trait '${life.vibe_trait}' is generic. Use a specific, named trait from the brand brief.`);
  }
}

// ── cleanup ───────────────────────────────────────────────────────────────

const VALID_APPROVAL = new Set(['pending', 'approved', 'rejected']);

function validateCleanup(cleanup) {
  if (!cleanup) return;
  for (const section of ['merges', 'deletions']) {
    const arr = cleanup[section] ?? [];
    arr.forEach((entry, i) => {
      const p = `/cleanup/${section}/${i}`;
      if (!entry.approval) {
        err(p + '/approval', 'missing-approval', `cleanup.${section}[${i}] is missing 'approval' (must be pending | approved | rejected).`);
      } else if (!VALID_APPROVAL.has(entry.approval)) {
        err(p + '/approval', 'invalid-approval', `cleanup.${section}[${i}].approval '${entry.approval}' is not one of pending | approved | rejected.`);
      }
      if (section === 'merges') {
        if (!entry.winner) err(p + '/winner', 'missing-winner', `cleanup.merges[${i}] is missing 'winner' (the surviving component).`);
        if (!Array.isArray(entry.memberJobs) || entry.memberJobs.length === 0) {
          err(p + '/memberJobs', 'missing-member-jobs', `cleanup.merges[${i}] must describe the job each cluster member was doing. Flattening duplicates without job analysis destroys signal.`);
        }
      }
    });
  }
}

// ── parking ──────────────────────────────────────────────────────────────

function validateParking(plan) {
  // Parking is allowed — but if a parked entry was once an organism candidate
  // and now sits in parking, that's fine. If it sits in `organisms[]` AND fails
  // the life-block validation, that's an error (above). Nothing extra here.
}

// ── main ──────────────────────────────────────────────────────────────────

function run() {
  const loaded = loadPlan();
  if (loaded.error) {
    process.stdout.write(JSON.stringify({
      verdict: 'invalid',
      errors: [{ path: '/', kind: 'plan-not-found', message: `Could not read ${loaded.path}: ${loaded.error}. Run /impeccable-native design-system plan first.` }],
      warnings: [],
      summary: { rootDir, planPath: loaded.path },
    }, null, 2) + '\n');
    process.exit(1);
  }

  const { plan, path: rel } = loaded;

  validateShape(plan);
  (plan.atoms ?? []).forEach((e, i) => validateBasicEntry(e, i, 'atoms'));
  (plan.molecules ?? []).forEach((e, i) => validateBasicEntry(e, i, 'molecules'));
  (plan.organisms ?? []).forEach((e, i) => validateOrganism(e, i));
  validateCleanup(plan.cleanup);
  validateParking(plan);

  const verdict = errors.length === 0 ? 'valid' : 'invalid';

  process.stdout.write(JSON.stringify({
    verdict,
    errors,
    warnings,
    summary: {
      rootDir,
      planPath: rel,
      mode: plan.mode ?? null,
      atomCount: (plan.atoms ?? []).length,
      moleculeCount: (plan.molecules ?? []).length,
      organismCount: (plan.organisms ?? []).length,
      cleanupMerges: plan.cleanup?.merges?.length ?? 0,
      cleanupDeletions: plan.cleanup?.deletions?.length ?? 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      pendingApprovals: [
        ...(plan.cleanup?.merges ?? []).filter(m => m.approval === 'pending'),
        ...(plan.cleanup?.deletions ?? []).filter(d => d.approval === 'pending'),
      ].length,
    },
  }, null, 2) + '\n');

  process.exit(verdict === 'valid' ? 0 : 1);
}

try { run(); }
catch (e) {
  process.stderr.write(`validate-plan: unexpected error: ${e.message}\n${e.stack}\n`);
  process.exit(2);
}
