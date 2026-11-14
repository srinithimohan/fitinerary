# Local authorization integration tests

Current CI organization is documented in [security-pr-boundaries.md](security-pr-boundaries.md). The required profile runs every supported guarantee, including all ownership regressions; the separate full diagnostic runs that complete profile plus both preserved issuer assertions. No test is skipped or marked expected-to-fail. The foundation-only execution records below are historical, including their original red-gate configuration.

This document preserves the integration-foundation verification record. The subsequently approved ownership fix, target migration, new verification results, and independent review boundary are documented in [board-clothing-ownership-fix.md](board-clothing-ownership-fix.md).

The later native Clerk-discovery fixture, supported bootstrap configuration, authentication evidence, and remaining issuer-binding requirement are documented separately in [native-clerk-discovery-tests.md](native-clerk-discovery-tests.md). The foundation-only authentication limitations and results below are historical.

On macOS or Linux, run `pnpm install --frozen-lockfile`, then `pnpm test:integration` with a local Docker daemon. No cloud project, production credentials, Clerk session, or paid service is needed. The command intentionally fails if a security assertion fails; known defects are not skipped or inverted into expected-success characterizations.

## Isolation and lifecycle

The runner creates a random project in an OS temporary directory, generates an ephemeral EC signing key, starts pinned Supabase services, applies a test-only SQL fixture, creates a private bucket, and runs Node's test runner. It accepts no database URL or application environment file. It strips application/Supabase/Clerk environment variables, refuses remote Docker endpoints, restricts HTTP requests and redirects to the loopback gateway, and creates a dedicated Docker bridge whose published ports bind to IPv4 loopback. A temporary Docker command adapter adds an explicit `127.0.0.1` address to the pinned CLI’s otherwise unrestricted port flags; the runner verifies the resulting gateway and database bindings. It does not change Docker daemon settings or link a hosted Supabase project. Ports 55320–55322 are reserved for this suite; concurrent runs in one worktree are rejected.

The pinned database image’s bootstrap administrator applies the reviewed fixture, including the exported reserved-role attributes and explicit Storage-owner grant options. The local service key is used only to create the bucket. Independent state checks use read-only SQL in the randomly named local database container. All tested actions use publishable/anon API credentials and user-scoped clients. State files and private keys have mode 0600, are temporary, and are deleted with the stack. CLI status output is captured rather than logged. Failure diagnostics redact JWTs, key prefixes, connection passwords, and generated private values.

Cleanup runs in `finally`, on SIGINT/SIGTERM, and in CI's separate `if: always()` step. To recover after a hard kill, run `node scripts/test-integration.mjs --cleanup`. The ignored `.local/integration-run.json` marker identifies only this worktree's randomly named resources. Container/volume/network fallback removal selects that project's label and containers attached to its dedicated network. Never use a global Docker prune.

## Pins and fixture provenance

| Component | Pin |
| --- | --- |
| Supabase CLI | 3.1.0, exact dev dependency and lockfile |
| PostgreSQL | `supabase/postgres:17.11.0.018` |
| PostgREST | `postgrest/postgrest:v16.5` |
| Storage | `supabase/storage-api:v1.90.1` |
| Auth | `supabase/gotrue:v2.197.0` |
| Kong | CLI 3.1.0 manifest: `library/kong:2.8.1` |

Service images use version tags rather than immutable digests; registry retagging is a remaining reproducibility limit. The CLI may use its public ECR mirrors for these images.

`tests/integration/fixtures/schema.sql` replays the three application tables, seven constraints (which create the four exported indexes), existing grants, and all 16 policy definitions from the owner-provided audit dated 2026-11-09. It is not a production migration. `catalog.json` is a reviewed subset for parity assertions. The raw `.local/audit/supabase-security-audit.csv` stays ignored and is not required by CI. Parsing its `details` arrays yielded 231 records across 11 sections; all declared counts matched. No production rows, identities, keys, or signed URLs are included in fixtures.

The pinned Storage service supplies its real tables, helpers, triggers, and internal lifecycle migrations. We do not fabricate Storage schema or missing functions. Tests compare policy predicates, direct helper bodies/ownership/configuration/grants, trigger inventory, and local security-definer search paths. `storage.reconcile_lifecycle_state` and `storage.bucket_lifecycle_states` are supplied by those migrations; their production definitions were not exported, so their exact production parity is unverified. Trigger-function owners/ACLs absent from the export are local checks, not independently established production facts.

A separate read-only query against the running local stack verified that `protect_active_lifecycle_states`, `wake_lifecycle_state`, and `reconcile_lifecycle_state` are security-definer functions owned by `supabase_storage_admin`, with `search_path=pg_catalog`, and neither `anon` nor `authenticated` has EXECUTE. The first two have owner-only execution ACLs; reconciliation additionally grants EXECUTE to `postgres` and `service_role`. These are observed pinned-provider facts, not a substitute for missing production ACL evidence.

## Authentication boundary — native Clerk remains unverified

The owner confirmed native Clerk third-party integration, ordinary session tokens with `role: authenticated`, no named JWT template, and a deployment key with the `sb_publishable_` prefix. The repository's four route files use Clerk `auth()` and the shared Supabase helper with its `accessToken` callback; no application service-role client was found. These facts establish the intended route credential path, not production runtime verification.

**This suite's generated tokens do not prove native Clerk authentication.** CLI 3.1.0's native Clerk configuration requires an HTTPS Clerk/custom Clerk domain, discovers the provider's public signing keys, and supplies them to PostgREST and Storage. We have no signing key for the real Clerk issuer and must not contact/configure it or use real user sessions. The isolated suite therefore uses explicitly configured ephemeral asymmetric local signing keys for authorization requests. This does not use a shared Supabase JWT secret or manually injected database claims, but is still a different key-provisioning path and is not equivalent authentication evidence.

The suite exercises real services' signature and expiry checks. It also requires rejection of a different issuer signed with the same trusted key. Failure of that assertion is evidence about the local stack's issuer enforcement, not proof of a production Clerk vulnerability. A valid A/B request under the local signing key establishes authorization under authenticated text subjects only. No test title, documentation, or CI result should describe this as completed Clerk E2E verification.

References: [pinned CLI issuer/JWKS discovery](https://github.com/supabase/cli/blob/v3.1.0/apps/cli/src/shared/auth/jwks.ts), [PostgREST JWKS configuration](https://github.com/supabase/cli/blob/v3.1.0/apps/cli/src/commands/start/services/postgrest.service.ts), [Storage JWKS configuration](https://github.com/supabase/cli/blob/v3.1.0/apps/cli/src/commands/start/services/storage.service.ts), [Supabase Clerk integration](https://supabase.com/docs/guides/auth/third-party/clerk).

To close the native authentication boundary requires a separately configured development Clerk instance with real test sessions, or a supported isolated Clerk issuer/discovery fixture in the upstream CLI. Do not change production settings, translate JWTs using the project shared secret, or mark local signing-key tests as that evidence.

## Tested authorization boundaries

- Real PostgREST: owner operations on all three tables, text-subject owner defaults, cross-user/anonymous reads and mutations, owner spoofing/reassignment, upserts, nested board/item reads, and cross-owner clothing references. Read-only administrator queries confirm denied mutations did not persist; zero-row update/delete successes are not mistaken for authorization failures.
- Real Storage HTTP: owner upload/download/sign/copy/overwrite/delete, duplicate rejection with `upsert: false`, cross-user/anonymous denials, forged prefixes, and copy source/destination authorization. Owner downloads verify bytes survive denied writes/deletes. Ordinary signed URLs are bearer capabilities: unauthenticated use of an owner-generated valid URL is expected to work. Unauthorized users must not generate one or download through unsigned public/authenticated URLs.
- Existing snapshot behavior: a real copy remains after original clothing/object deletion, and the board-item FK becomes null while its snapshot path/bytes remain. This tests backend behavior matching the current routes, not invocation of those routes through Clerk middleware.
- Application control flow remains covered by the existing 42 mocked route/client tests and seven browser harness regressions. The new suite does not boot Next.js or run Clerk sign-in/sign-out, session switching, or production deployment E2E.

## Findings and boundaries to preserve

1. Board-item policies check the parent board's ownership but do not validate ownership of `clothing_item_id`. The foreign key checks existence, not ownership. Strict gates exercise insert, update, and upsert independently. The strict cross-owner-reference test must remain failing if that write succeeds. A separately scoped fix should define reference ownership rules and review inserts, updates, upserts, and FK side effects; do not change policies in this testing PR.
2. Storage UPDATE policies allow owners to overwrite their own paths. Tests preserve this exported behavior while rejecting cross-user overwrites; future immutable pipeline paths are outside scope.
3. `anon` and `authenticated` have application-table `TRUNCATE` and other broad grants. PostgreSQL RLS does not cover TRUNCATE. Tests scoped to the HTTP API cannot establish safety for arbitrary SQL execution under these roles. Review grants in a separately approved security change; never truncate production as a probe.
4. Board-item policies do not establish snapshot-path membership in a specific board, and same-user aliasing remains the existing BD-01 follow-up. Cross-user Storage isolation does not fix that lifecycle defect.
5. The owner verified Data API exposure for all three tables and reported no exposed functions. A role-settings query found no `pgrst.db_pre_request`, but that does not rule out configuration elsewhere. Local tests use no pre-request hook. Production parity for that setting remains uncertain; no repeat exposure audit or production query is required to run this suite.

## Verification results

Local verification on 2026-11-09 (America/New_York), Node 24.21.0, Docker Desktop 29.8.0, pnpm 12.6.0:

| Command | Outcome |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed with registry access after the sandboxed attempt could not resolve the registry |
| `pnpm add -D -E supabase@3.1.0` | Passed; exact test dependency plus platform-specific lock entries and release-age exceptions |
| `pnpm lint` | Passed, zero errors, seven existing application image warnings |
| `pnpm typecheck` | Passed |
| `pnpm test` | All 42 existing tests passed |
| `pnpm test:audit-sql` | Passed, including read-only write rejection |
| `pnpm exec playwright install chromium` | Passed |
| `pnpm test:browser` | Initial four-worker run timed out on navigation |
| `pnpm test:browser --workers=1` | All seven unchanged regressions passed in 52.6 seconds |
| `pnpm build` | Passed with the unchanged default Turbopack build and normal font/network access |
| `caffeinate -i pnpm test:integration` | **16 passed / 4 failed / 0 skipped**, 20 tests, 10.4 seconds excluding stack startup; cleanup succeeded |
| `node scripts/test-integration.mjs --cleanup` | Recovery cleanup passed after a previous run exposed duplicate short/full container IDs; final cleanup deduplicates full IDs and tolerates removal already in progress |
| `node_modules/.bin/eslint scripts/test-integration.mjs tests/integration` and `node --check` on the runner/test/helper files | Passed |
| `git diff --check` | Passed |

The four remaining failures are intentional strict gates, not expected-success characterizations: cross-owner clothing references persist through **insert, update, and upsert**, and an untrusted-issuer JWT signed by the same locally trusted key is accepted by **both REST and Storage**, including creating an object. The reference defect is demonstrated against the reproduced production definitions. The issuer result establishes the local authentication limitation; it does not establish a production Clerk vulnerability. CI's integration job therefore remains red until those gates are resolved in separately approved work. No tests were skipped, marked expected-to-fail, or weakened into unsafe contracts.

Earlier full runs established the same reference/issuer findings but also encountered local Docker/query/HTTP timeouts. The final macOS run used `caffeinate -i` to prevent idle sleep; HTTP and independent SQL verification each have a 60-second deadline. The assertions are identical. Initial image acquisition stalled through ECR; official Docker Hub pulls completed. A temporary host-side image-transfer attempt timed out loading archives, which were removed. The final runner uses the normal pinned CLI and cached official images; that auxiliary transfer tool is not a repository dependency.

GitHub-hosted CI was configured but not executed remotely in this task. The original build job is unchanged. No commit, push, draft PR, deployment, or production mutation was performed. The audit CSV is ignored; generated keys/state and task-owned containers, volumes, and network were removed. Docker image and dependency caches are retained normally.

CI runs integration tests in a separate Docker-backed job. The existing lint/typecheck/unit/audit SQL/browser/build job is preserved. No deployment, merge, production policy change, or pipeline work is part of this change. Rollback removes this test tooling, fixtures, CI job, and test dependency; it needs no production-data rollback.
