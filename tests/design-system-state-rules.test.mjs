/**
 * Tests for skill/scripts/design-system/state-rules.mjs — the decision
 * table that drives /design-system's recommended_action. This is the
 * single most important piece of the determinism backbone, so we test
 * every branch of the table.
 *
 * Run: node --test tests/design-system-state-rules.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recommendAction, ACTIONS } from '../skill/scripts/design-system/state-rules.mjs';

// Convenience: a base facts object that satisfies every prerequisite, so each
// test only tweaks the field under examination.
function happy(overrides = {}) {
  return {
    assertPathsFailed: [],
    productMdExists: true,
    charterExists: true,
    layoutKind: 'known',
    mapperExists: false,
    inventoryExists: true,
    inventoryStale: false,
    staleRoots: [],
    judgmentExists: true,
    pendingProposals: 0,
    charterMayBeStale: false,
    charterStaleReason: null,
    ...overrides,
  };
}

describe('recommendAction — top-priority branches', () => {
  it('resynthesizes when assertPaths failed (highest priority, beats everything)', () => {
    const r = recommendAction(happy({
      assertPathsFailed: ['PRODUCT.md missing', 'src/components moved'],
      productMdExists: false, // would otherwise trigger refuse
    }));
    assert.equal(r.recommended_action, ACTIONS.RESYNTHESIZE_STATE);
    assert.match(r.reason, /PRODUCT\.md missing/);
  });

  it('refuses when PRODUCT.md is missing', () => {
    const r = recommendAction(happy({ productMdExists: false, charterExists: false }));
    assert.equal(r.recommended_action, ACTIONS.REFUSE);
    assert.match(r.reason, /PRODUCT\.md/);
  });

  it('recommends charter when PRODUCT exists but charter does not', () => {
    const r = recommendAction(happy({ charterExists: false, inventoryExists: false, judgmentExists: false }));
    assert.equal(r.recommended_action, ACTIONS.CHARTER);
  });
});

describe('recommendAction — greenfield path', () => {
  it('greenfield + no judgment → judge (skips inventory entirely)', () => {
    const r = recommendAction(happy({
      layoutKind: 'greenfield',
      inventoryExists: false,
      judgmentExists: false,
    }));
    assert.equal(r.recommended_action, ACTIONS.JUDGE);
    assert.match(r.reason, /greenfield/i);
  });

  it('greenfield + judgment with pending proposals → resume', () => {
    const r = recommendAction(happy({
      layoutKind: 'greenfield',
      inventoryExists: false,
      judgmentExists: true,
      pendingProposals: 3,
    }));
    assert.equal(r.recommended_action, ACTIONS.RESUME);
  });

  it('greenfield + judgment with no pending proposals → idle', () => {
    const r = recommendAction(happy({
      layoutKind: 'greenfield',
      inventoryExists: false,
      judgmentExists: true,
      pendingProposals: 0,
    }));
    assert.equal(r.recommended_action, ACTIONS.IDLE);
  });
});

describe('recommendAction — unknown layout path', () => {
  it('unknown layout + no mapper → synthesize-mapper', () => {
    const r = recommendAction(happy({
      layoutKind: 'unknown',
      mapperExists: false,
      inventoryExists: false,
      judgmentExists: false,
    }));
    assert.equal(r.recommended_action, ACTIONS.SYNTHESIZE_MAPPER);
  });

  it('unknown layout but mapper exists → proceeds to inventory check (no synth)', () => {
    const r = recommendAction(happy({
      layoutKind: 'unknown',
      mapperExists: true,
      inventoryExists: false,
      judgmentExists: false,
    }));
    assert.equal(r.recommended_action, ACTIONS.INVENTORY);
  });
});

describe('recommendAction — inventory lifecycle', () => {
  it('known layout, no inventory → inventory', () => {
    const r = recommendAction(happy({ inventoryExists: false, judgmentExists: false }));
    assert.equal(r.recommended_action, ACTIONS.INVENTORY);
  });

  it('inventory exists but stale → refresh-inventory', () => {
    const r = recommendAction(happy({
      inventoryStale: true,
      staleRoots: ['src/components'],
      judgmentExists: false,
    }));
    assert.equal(r.recommended_action, ACTIONS.REFRESH_INVENTORY);
    assert.match(r.reason, /src\/components/);
  });

  it('inventory fresh, no judgment → judge', () => {
    const r = recommendAction(happy({ judgmentExists: false }));
    assert.equal(r.recommended_action, ACTIONS.JUDGE);
  });
});

describe('recommendAction — judgment lifecycle', () => {
  it('judgment with pending proposals → resume', () => {
    const r = recommendAction(happy({ pendingProposals: 5 }));
    assert.equal(r.recommended_action, ACTIONS.RESUME);
    assert.match(r.reason, /5 pending/);
  });

  it('everything done → idle', () => {
    const r = recommendAction(happy());
    assert.equal(r.recommended_action, ACTIONS.IDLE);
  });
});

describe('recommendAction — charter staleness is non-blocking', () => {
  it('stale charter is surfaced as FYI but does not override recommendation', () => {
    const r = recommendAction(happy({
      charterMayBeStale: true,
      charterStaleReason: 'PRODUCT.md hash changed',
      // Setup that would normally recommend idle:
    }));
    assert.equal(r.recommended_action, ACTIONS.IDLE);
    assert.equal(r.charter_may_be_stale, true);
    assert.equal(r.charter_stale_reason, 'PRODUCT.md hash changed');
  });

  it('charter staleness rides along with every recommendation', () => {
    const r = recommendAction(happy({
      charterMayBeStale: true,
      charterStaleReason: 'PRODUCT.md hash changed',
      inventoryStale: true,
      staleRoots: ['src/ui'],
    }));
    assert.equal(r.recommended_action, ACTIONS.REFRESH_INVENTORY);
    assert.equal(r.charter_may_be_stale, true);
  });

  it('no staleness signal defaults to false / null', () => {
    const r = recommendAction(happy());
    assert.equal(r.charter_may_be_stale, false);
    assert.equal(r.charter_stale_reason, null);
  });
});

describe('recommendAction — return shape', () => {
  it('always returns the four documented fields', () => {
    const r = recommendAction(happy());
    assert.ok('recommended_action' in r);
    assert.ok('reason' in r);
    assert.ok('charter_may_be_stale' in r);
    assert.ok('charter_stale_reason' in r);
  });
});
