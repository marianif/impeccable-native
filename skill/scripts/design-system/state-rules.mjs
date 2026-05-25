/**
 * state-rules.mjs
 *
 * Shared decision table for the /impeccable-native design-system command.
 *
 * Pure function. No filesystem access. Given a facts blob produced by a
 * synthesized .impeccable/design-system/state.mjs, returns:
 *
 *   { recommended_action, reason, charter_may_be_stale, charter_stale_reason }
 *
 * The synthesized state script is responsible for gathering facts (which
 * paths exist, hashes, tree-hash comparisons). This module owns the policy
 * for what to do about them — so a bugfix here applies to every repo
 * without re-synthesizing per-repo scripts.
 *
 * Decision table (top match wins):
 *
 *   assertPathsFailed              → resynthesize-state
 *   !productMdExists               → refuse
 *   !charterExists                 → charter
 *   layoutKind=greenfield, no judg → judge          (skip inventory entirely)
 *   layoutKind=unknown, no mapper  → synthesize-mapper
 *   layoutDetected, !inventory     → inventory
 *   inventory + treeHashMismatch   → refresh-inventory
 *   inventory fresh, !judgment     → judge
 *   judgment + pendingProposals    → resume
 *   all done                       → idle
 *
 * Charter staleness is computed independently and surfaced as a
 * non-blocking FYI flag — it never overrides the recommended action.
 */

const ACTIONS = Object.freeze({
  RESYNTHESIZE_STATE: 'resynthesize-state',
  REFUSE: 'refuse',
  CHARTER: 'charter',
  SYNTHESIZE_MAPPER: 'synthesize-mapper',
  INVENTORY: 'inventory',
  REFRESH_INVENTORY: 'refresh-inventory',
  JUDGE: 'judge',
  RESUME: 'resume',
  IDLE: 'idle',
});

/**
 * @param {object} facts
 * @param {string[]} [facts.assertPathsFailed]   — non-empty array if synth assumptions broke
 * @param {boolean}  facts.productMdExists
 * @param {boolean}  facts.charterExists
 * @param {'greenfield'|'known'|'unknown'} facts.layoutKind
 * @param {boolean}  facts.mapperExists           — synthesized mapper.mjs present?
 * @param {boolean}  facts.inventoryExists
 * @param {boolean}  [facts.inventoryStale]       — true if any tree-hash mismatches
 * @param {string[]} [facts.staleRoots]
 * @param {boolean}  facts.judgmentExists
 * @param {number}   [facts.pendingProposals]
 * @param {boolean}  [facts.charterMayBeStale]
 * @param {string}   [facts.charterStaleReason]
 * @returns {{ recommended_action: string, reason: string, charter_may_be_stale: boolean, charter_stale_reason: string | null }}
 */
export function recommendAction(facts) {
  const charter_may_be_stale = Boolean(facts.charterMayBeStale);
  const charter_stale_reason = facts.charterStaleReason ?? null;

  const wrap = (recommended_action, reason) => ({
    recommended_action,
    reason,
    charter_may_be_stale,
    charter_stale_reason,
  });

  if (Array.isArray(facts.assertPathsFailed) && facts.assertPathsFailed.length > 0) {
    return wrap(
      ACTIONS.RESYNTHESIZE_STATE,
      `Synthesized state.mjs assumptions no longer hold: ${facts.assertPathsFailed.join('; ')}`,
    );
  }

  if (!facts.productMdExists) {
    return wrap(
      ACTIONS.REFUSE,
      'PRODUCT.md is required before /design-system can run. Use /impeccable-native shape to produce one.',
    );
  }

  if (!facts.charterExists) {
    return wrap(
      ACTIONS.CHARTER,
      'DESIGN-SYSTEM.md does not exist yet. Co-author the charter before proceeding.',
    );
  }

  // Greenfield short-circuits the inventory steps entirely.
  if (facts.layoutKind === 'greenfield') {
    if (facts.judgmentExists && (facts.pendingProposals ?? 0) > 0) {
      return wrap(
        ACTIONS.RESUME,
        `Greenfield repo with ${facts.pendingProposals} pending proposal(s) to review.`,
      );
    }
    if (facts.judgmentExists) {
      return wrap(
        ACTIONS.IDLE,
        'Greenfield repo with all proposals applied. Nothing to do unless you want a fresh judgment.',
      );
    }
    return wrap(
      ACTIONS.JUDGE,
      'Greenfield repo: skip inventory and propose a component layer from the charter.',
    );
  }

  // Unknown layout needs a synthesized mapper before inventory can run.
  if (facts.layoutKind === 'unknown' && !facts.mapperExists) {
    return wrap(
      ACTIONS.SYNTHESIZE_MAPPER,
      'Component files exist but no shipped scenario matches the layout. Synthesize a per-repo mapper.',
    );
  }

  if (!facts.inventoryExists) {
    return wrap(
      ACTIONS.INVENTORY,
      'Charter and layout are ready, but no inventory has been produced yet.',
    );
  }

  if (facts.inventoryStale) {
    const which = Array.isArray(facts.staleRoots) && facts.staleRoots.length > 0
      ? ` (stale roots: ${facts.staleRoots.join(', ')})`
      : '';
    return wrap(
      ACTIONS.REFRESH_INVENTORY,
      `Inventory tree-hash mismatch detected${which}.`,
    );
  }

  if (!facts.judgmentExists) {
    return wrap(
      ACTIONS.JUDGE,
      'Inventory is fresh. Ready to produce a judgment.',
    );
  }

  if ((facts.pendingProposals ?? 0) > 0) {
    return wrap(
      ACTIONS.RESUME,
      `${facts.pendingProposals} pending proposal(s) from the last judgment await review.`,
    );
  }

  return wrap(
    ACTIONS.IDLE,
    'Everything is up to date. Nothing to do unless you want to refresh the charter, inventory, or judgment.',
  );
}

export { ACTIONS };
