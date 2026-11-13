# Board clothing-reference ownership fix

Scope: separately approved security fix whose final review base is the existing application foundation. Earlier verification used the accompanying uncommitted integration harness; the final merge order places this runtime fix first. Only the local disposable Supabase stack received the migration. No production policy, data, authentication setting, deployment, or infrastructure billing configuration was changed.

The review/file lists and test results below preserve the implementation history. For the final independently reviewable change boundaries and merge order, see [security-pr-boundaries.md](security-pr-boundaries.md). The runtime fix, migration, unit regressions, and ownership integration regression bodies remain unchanged. Integration fixtures/support and their real-service tests are grouped with the harness PR so the security change can be reviewed first without depending on missing test infrastructure. Later CI organization moves issuer callbacks verbatim into a dedicated diagnostic file; it changes no ownership assertion.

## Review boundary

The earlier infrastructure and its 16-pass/4-fail verification record remain in [authorization-integration-tests.md](authorization-integration-tests.md). An ignored snapshot of the pre-fix worktree and hashes is stored in `.local/review/infrastructure-before-ownership/`. The separate `.local/review/ownership-security-fix.patch` contains only this fix relative to that snapshot; no commit or PR has been created.

Security-fix files:

| File | Purpose |
| --- | --- |
| `supabase/migrations/20261109000100_board_item_clothing_ownership.sql` | Transactional ALTER POLICY migration; modifies only the existing INSERT/UPDATE WITH CHECK expressions |
| `app/api/boards/[id]/route.ts` | Preflight ownership validation for non-null clothing references supplied with retained snapshot paths |
| `tests/unit/board-snapshot-ownership.test.ts` | Fourteen route regression, validation, error, and preservation cases |
| `tests/integration/ownership.test.mjs` | Eight real-HTTP migration and legitimate-reference tests |
| `tests/integration/fixtures/catalog.ownership-target.json` | Independently authored target catalog with only two predicate changes and migration provenance |
| `tests/integration/support.mjs` | Selects that target catalog for the existing parity assertions |
| `scripts/test-integration.mjs` | Verifies the original policy catalog, applies the explicit migration to its random local container, and includes the new tests |

No new dependency or CI configuration change is required by this security fix. Existing foundation changes to those files belong to the separate infrastructure scope.

## Enforcement

The two existing board-item write policies previously required only ownership of the board. Their new WITH CHECK expressions also require each non-null `clothing_item_id` to identify a row whose text `user_id` equals `auth.jwt()->>'sub'`. Null references remain valid. ALTER POLICY omits USING, TO, and other changes, preserving existing UPDATE USING, SELECT, DELETE, role targeting, and permissiveness.

The FK previously established existence without ownership. The old three insert/update/upsert regression tests now pass unchanged: foreign references fail and the independent state checks show no persisted mutation. The additional tests exercise the PATCH route's `board_id,position` conflict target for both new and occupied positions, plus legitimate owner insert/reassignment/upsert/null detachment.

PATCH performs one batched, user-scoped `clothing_items` query with an explicit `user_id` filter before processing any new uploads or item writes. Foreign and missing references receive the same generic 400 response; malformed non-null UUIDs also receive 400. UUID case is normalized for lookup without replacing the submitted reference or snapshot path. An ownership-query failure returns a generic 500 before writes. Null and omitted references require no lookup.

The application preflight complements RLS. It is not a replacement for RLS, and it is not atomic with the later writes. RLS and the unchanged FK remain authoritative if data changes between validation and persistence.

## Evidence and compatibility

The original raw audit CSV remains ignored under `.local/audit/`. The original `catalog.json`, `schema.sql`, and entire `authorization.test.mjs` remain byte-for-byte unchanged, including all three ownership regressions and the JWT issuer test. Their hashes are checked against the pre-fix snapshot. The original audit is never overwritten with migrated definitions.

The runner first replays the original audited definitions and independently compares all 16 policy definitions with the original catalog. It then applies the version-controlled migration explicitly to its named local container and reloads PostgREST. The unchanged parity assertion compares the migrated policies against the new target catalog. A new assertion confirms exactly two WITH CHECK fields differ from the original, with all USING expressions, other policies, schema, grants, and Storage settings unchanged.

Independent snapshots, direct uploads, and null references remain supported. Both real integration suites verify original deletion sets the FK to null and preserves snapshot state; the unchanged Storage test also verifies the actual copied bytes survive. Later snapshot metadata edits and board deletion continue working.

Route tests invoke the real handler with mocked Clerk/Supabase. The database/Storage integration tests use real HTTP services and independently verified state. This is not a Clerk-backed Next.js E2E flow; the previously documented JWT limitation remains separate.

## Verification

Before implementation, the new route test file failed 11 of 13 cases against the original handler; the two existing null-reference behaviors already passed. After implementation:

| Command | Result |
| --- | --- |
| `pnpm test` | 56 passed: all 42 original tests plus 14 new route tests |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed, zero errors and the same seven existing image warnings |
| `caffeinate -i pnpm test:integration` | 27 passed, 1 failed, 0 skipped, 28 tests in 19.2 seconds excluding startup; cleanup succeeded |
| `caffeinate -i pnpm test:audit-sql` | Passed; catalog SQL and read-only write rejection |
| `caffeinate -i pnpm test:browser --workers=1` | All seven unchanged Chromium regressions passed in 9.9 seconds |
| `caffeinate -i pnpm build` | Passed with the unchanged default Turbopack build |
| `git diff --check` and independent security-patch review | Passed; the reverse patch check restores the preserved infrastructure baseline |

The only remaining integration failure is the unchanged same-key untrusted-issuer test. Both local REST and Storage accept that token. It remains a strict failing gate and is not treated as proof of a production Clerk vulnerability. The integration CI job therefore remains red; no test was disabled, skipped, or marked expected-to-fail.

## Risks and rollout boundary

### Owner-run production reference inventory (read-only)

The owner ran `scripts/audit/board-clothing-reference-integrity.sql` in the production Supabase SQL Editor and reported successful completion at **2026-11-10T20:46:51.912116+00:00**. This is owner-supplied aggregate evidence; the agent did not connect to production or execute a migration.

| Aggregate | Result |
| --- | ---: |
| Total board items | 8 |
| Null clothing references | 4 |
| Non-null clothing references | 4 |
| Cross-owner references | 0 |
| Missing board references | 0 |
| Missing clothing references | 0 |
| Missing owner references | 0 |
| Invalid references | 0 |
| Invalid references with snapshot paths | 0 |
| Invalid references without snapshot paths | 0 |

No existing board-item clothing references required remediation **as of that inspection**. The four null references are valid under the nullable-reference contract and remain permitted by the migration. This does not verify snapshot object bytes or establish that later writes cannot introduce another invalid reference before enforcement is deployed. Re-run the same aggregate-only read-only preflight immediately before any separately approved rollout. Any newly nonzero result needs a separately reviewed remediation decision; do not delete board items, originals, or snapshots automatically. Null-detaching a confirmed invalid reference would preserve its independent snapshot relationship, but no repair SQL or production mutation is included here.

The preflight uses a read-only transaction with local timeouts and rolls back. Its local `row_security=off` setting causes an error when RLS would hide rows; it does not disable deployed RLS or change persistent configuration. Isolated synthetic tests verify detection of an intentionally seeded legacy cross-owner link and failure for incomplete authenticated/anonymous scans.

- Production still has its original policies; this local fix has not remediated production.
- The migration does not repair existing invalid cross-owner links. None were found in the owner-run production inventory above. A future update retaining any subsequently introduced invalid link will fail; the board owner can still select/delete the item or clear its reference to null. Any production data repair requires separate authorization.
- API preflight can race deletion of an original; subsequent RLS/FK checks fail closed. The route's broader multi-step transaction/cleanup defects and same-user snapshot aliasing remain separate follow-ups.
- Snapshot reference input validation accepts standard hyphenated UUIDs, case-insensitively. The existing UI uses the database's canonical UUID form; callers using noncanonical PostgreSQL UUID spellings would receive 400.
- Migration subqueries use existing table SELECT grants and text JWT subjects. They introduce no privileged helper, ownership column, new grant, or Storage policy. Privileged roles can still bypass RLS; application routes continue using the existing user-scoped client.
- Review deployment ordering separately. Database enforcement is the security boundary; applying the API change alone would leave direct PostgREST writes vulnerable. A future database-first rollout would close that path before the route's improved 400 handling is deployed. No rollout is authorized here.

Rollback for this local work discards the disposable stack and removes the separately scoped patch. For a future production rollback, reverting the two checks reopens the vulnerability and must not be done automatically to accommodate an invalid reference. Null detachment preserves independent snapshots without weakening the policy.
