This is the integration-only review stage. The native change described below is a separate subsequent change; it is not present in this tree. Required security coverage here uses local project keys, not native Clerk evidence.

# Security changes: factual review boundaries

These are change inventories and verification facts, not final PR descriptions or review comments. No commit, PR, deployment, migration application to production, or merge is performed by this preparation. The older generated infrastructure PR draft is archived unchanged under ignored `.local/review/historical-infrastructure-pr-draft.md` rather than included in the proposed patches.

## Dependency and merge order

**Ownership security fix → RLS/Storage integration infrastructure → native Clerk-discovery infrastructure.** The original infrastructure-first order cannot give an independently passing required authorization check: its three strict cross-owner regression cases expose the existing defect. Do not classify those real authorization failures as diagnostics. Put the runtime security change first, then require all regression cases when introducing their Docker harness.

1. The ownership fix is independent of the integration harness. Its application route, SQL migration, fourteen route regressions, aggregate-only preflight SQL, and verification notes can be reviewed on the existing foundation. It uses the existing build checks. Its production deployment remains a separate approval; the owner-run preflight found zero invalid references at the documented timestamp.
2. The integration infrastructure depends on that migration being in its base. It adds actual catalog replay, migration parity/compatibility coverage, the unchanged cross-owner regression cases, Storage tests, and the local-project-key authentication boundary. Its required profile includes all authorization and supported cryptographic checks; its full diagnostic adds the original strict project-key issuer assertion.
3. Native discovery depends on the integration infrastructure. It adds the isolated HTTPS issuer, independent RS256 provider key, real discovery/JWKS ingestion, supported provider-authentication checks, and the second strict issuer assertion. It expands the required profile without changing its check name; the diagnostic remains the complete superset.

The integration-only stage does not claim native Clerk authentication. The three changes are independently reviewable as stacked changes; they are not three unrelated, interchangeable patches.

## File boundaries

| Change | Files and ownership |
| --- | --- |
| Ownership fix | `app/api/boards/[id]/route.ts`; `supabase/migrations/20261109000100_board_item_clothing_ownership.sql`; `tests/unit/board-snapshot-ownership.test.ts`; `scripts/audit/board-clothing-reference-integrity.sql`; `docs/board-clothing-ownership-fix.md` |
| Integration infrastructure | `.gitignore`; `.github/workflows/build.yml`; `.github/workflows/issuer-conformance.yml`; `.github/required-checks.json`; `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`; `scripts/test-integration.mjs`, `scripts/verify-integration-profiles.mjs`; `tests/integration/authorization.test.mjs`, `ownership.test.mjs`, `reference-audit.test.mjs`, `support.mjs`, `docker-loopback.mjs`, `profiles.mjs`, and project-only `issuer-conformance.test.mjs`; all five JSON/SQL fixtures under `tests/integration/fixtures/`; documentation links in `docs/security-audit.md` and `docs/pr-1a-verification.md`; `docs/authorization-integration-tests.md` and this factual inventory |
| Native discovery | New `tests/integration/native-discovery.mjs`, `oidc-server.mjs`, `native-auth-support.mjs`, `native-auth.test.mjs`; `docs/native-clerk-discovery-tests.md`; scoped updates to the runner, Docker port adapter, profiles, issuer diagnostic, assertion fingerprints/verifier, workflow step labels, and current verification documentation |

Shared files have separate intermediate versions in the local review patches. The target catalog and positive ownership integration tests are assigned to the harness change because they require its catalog/support files; their contents and security assertions are preserved. The security-fix source, migration, and unit regressions are unchanged by CI organization.

## CI contract and merge enforcement

- `pnpm test:integration` runs the required file partition: all supported database, Storage, authentication, ownership, and read-only audit guarantees. Failures remain fatal.
- `pnpm test:integration:diagnostic` runs the complete superset, including both unchanged issuer callbacks. Their failures make this separate workflow fail normally; there is no exit-status rewriting or `continue-on-error`.
- `pnpm test:integration:profiles` verifies the explicit partition, rejects arbitrary test filters, checks for skipped/only/todo registrations, and verifies the original issuer assertion fingerprints.
- Existing lint, typecheck, unit, browser, audit SQL, and build steps are preserved. Workflow artifacts select only the sanitized profile-specific log, never the audit directory or whole `.local` tree.

Require GitHub check contexts **`build`** and **`Security authorization and authentication`**. Do **not** require **`Issuer conformance diagnostic - full suite`**. The separate diagnostic workflow triggers on the same main-branch pushes/PRs and can also be run manually, so its failures remain visible.

Read-only GitHub inspection on 2026-11-10 found `main` unprotected and no repository rulesets; the repository is public. Workflow labels alone do not enforce merging. `.github/required-checks.json` supplies the explicit protection payload for review, including up-to-date required checks and enforcement for administrators, without adding an unrequested review-approval policy. It has **not** been applied. After the approved workflows are published and their names exist, activation of this payload is a remaining merge prerequisite. Applying it now would require check names that no committed workflow yet produces and would affect unrelated PRs. No repository protection settings were changed during this uncommitted review.

Activation order matters: merge the ownership-only change under the existing build checks first. Once the integration PR produces both named checks on its reviewed commit, activate the final payload **before merging that integration PR**. Do not require its new security context on the earlier ownership-only PR, which does not yet contain that workflow. Native discovery later retains the same required context and expands its guarantees. No merge or settings activation is performed here.

Issuer enforcement is tracked in [issue #18](https://github.com/srinithimohan/fitinerary/issues/18). It is a limitation of this pinned local verification path, not established evidence of a hosted-production bypass. Real Clerk issuance and any additional managed gateway/hook enforcement remain outside the verified boundary. No artificial issuer proxy is added.

## Production rollout boundary

The owner-run aggregate-only production inspection completed at `2026-11-10T20:46:51.912116+00:00`: 8 board items, 4 null references, 4 non-null references, and zero cross-owner, missing-row, missing-owner, or invalid references. No existing links needed remediation then. See the security migration's verification notes for provenance and all counts. Repeat the read-only check before a future rollout because the original production policies remain in place until separately approved enforcement is applied. No data repair or production migration is authorized here.

Original audit CSV, original catalog/schema fixtures, and all ownership regression bodies are preserved. Current and historical logs, snapshots, and independently applicable local review patches stay under ignored `.local/review/`. No credentials or raw evidence belong in the patches.

## Final local verification (2026-11-10)

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pass; no dependency/version changes during organization |
| `pnpm lint` | Pass; seven existing image warnings |
| `pnpm typecheck` | Pass |
| `pnpm test` | 56 passed |
| `pnpm test:integration:profiles` | Pass; explicit file partitions and original issuer assertion fingerprints |
| `caffeinate -i pnpm test:integration` | 40/40 passed; zero skipped/cancelled; 58.7 seconds of tests |
| `caffeinate -i pnpm test:integration:diagnostic` | Full 42 tests: 40 passed, both strict issuer assertions failed; zero skipped/cancelled; exits 1; 92.3 seconds |
| Ownership-only review tree, existing Vitest runner | 56 passed, without the integration harness |
| Integration-only review tree, required profile | 30/30 passed; zero skipped/cancelled; 76.3 seconds |
| Integration-only review tree, full diagnostic | Full 31 tests: 30 passed, original project-key issuer assertion failed; zero skipped/cancelled; exits 1; 61.1 seconds |
| `caffeinate -i pnpm test:audit-sql` | Pass |
| `caffeinate -i pnpm test:browser --workers=1` | Seven passed |
| `caffeinate -i pnpm build` | Pass, unchanged Turbopack build |
| Workflow YAML/protection-context validation | Pass; diagnostic excluded from required contexts; no `continue-on-error` |
| Patch forward/reverse application checks | Pass in dependency order; no commits made |
| Protected evidence/source hashes | Original audit CSV/catalog/schema, ownership implementation/migration/unit/integration regressions unchanged; both issuer callbacks copied verbatim |

The first partitioned required run found a missing `encode` helper import (39 passed, 1 failed). The import was corrected; neither an assertion nor a security boundary was changed, and the full required/diagnostic reruns above verified the fix. An initial ownership-tree attempt invoked dependency auto-install before its dependency link existed and hit sandbox DNS errors. The successful ownership check reused the existing installed test runner; it is not a claim of a fresh dependency installation for that intermediate tree. Final frozen installation in the actual worktree passed.

All disposable integration projects cleaned up after success or failure. The stage source trees are outside the repository in a local temporary directory; the ignored patch inventory records their locations. This avoids including review copies in lint/build discovery. The generated pnpm store is also ignored. No GitHub Actions execution is claimed for these uncommitted workflows. Repository-level required-check activation and future production rollout approval remain outstanding; local passing checks do not activate either automatically.
