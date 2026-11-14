import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { sql } from './support.mjs';

const state = JSON.parse(readFileSync(process.env.FITINERARY_INTEGRATION_STATE, 'utf8'));
const audit = readFileSync(new URL('../../scripts/audit/board-clothing-reference-integrity.sql', import.meta.url), 'utf8');
// The shared verification helper already supplies a read-only transaction.
const body = audit.replace(/^BEGIN TRANSACTION .*;$/m, '').replace(/^ROLLBACK;$/m, '');

describe('Aggregate-only read-only legacy-reference preflight (synthetic data)', () => {
  it('detects an existing cross-owner link and distinguishes null independent snapshots', () => {
    const output = sql(body);
    const report = JSON.parse(output.split('\n').find((line) => line.startsWith('{')));
    assert.equal(report.invalid_reference_count, 1);
    assert.equal(report.cross_owner_references, 1);
    assert.equal(report.invalid_references_with_snapshot_path, 1);
    assert.equal(report.invalid_references_without_snapshot_path, 0);
    assert.equal(report.missing_board_references, 0);
    assert.equal(report.missing_clothing_references, 0);
    assert.equal(report.missing_owner_references, 0);
    assert.ok(report.null_clothing_references >= 1);
    assert.ok(report.non_null_clothing_references >= 2);
  });
  for (const role of ['authenticated', 'anon']) {
    it(`fails rather than returning an RLS-filtered zero as ${role}`, () => {
      const result = spawnSync('docker', ['exec', '-i', state.container, 'psql', '-XAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], {
        input: `BEGIN READ ONLY; SET LOCAL ROLE ${role};\n${body}\nROLLBACK;`, encoding: 'utf8', timeout: 60_000,
      });
      assert.ok(!result.error, 'Local read-only audit command did not complete');
      assert.notEqual(result.status, 0, 'Incomplete RLS-filtered inventory must not succeed');
      assert.match(result.stderr, /row-level security policy/, 'Audit failed for an unexpected reason');
    });
  }
});
