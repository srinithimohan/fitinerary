# PR 1A verification and handoff

Scope: engineering foundation only. No application source, production database/policy/Storage configuration, queues, lifecycle migrations, worker deployment, or paid infrastructure is changed. `AGENTS.md` and existing skills are preserved.

## Reproduce

Use the checked-in pnpm version (12.6.0), Node 22.12+ (CI uses current Node 22; local verification uses Node 24.21.0), Docker, and network access for dependencies/browser image downloads. Do not supply production credentials. The tests do not read an ambient database URL.

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:audit-sql
pnpm exec playwright install chromium
pnpm test:browser
pnpm build
git diff --check
```

On a clean Linux host, use `pnpm exec playwright install --with-deps chromium`. CI runs lint, typecheck, unit tests, the Docker audit SQL self-test, Chromium regressions, and the unchanged production build. It uploads browser diagnostics on failure, uses read-only repository permissions, and consumes only existing CI allowances. No cloud account or service is provisioned.

## Check results

Verification date: 2026-10-24. All final application checks below ran against the PR 1A tree; the production source remains unchanged.

| Check | Result / boundary |
| --- | --- |
| Original `pnpm lint` before changes | Pass; seven pre-existing warnings, zero errors |
| Final `pnpm install --frozen-lockfile` | Pass online; an additional offline attempt could not run because pnpm's local supply-chain snapshot cache was incomplete |
| Original `pnpm build` inside sandbox | Blocked fetching existing Google Fonts |
| Original build with network access | Turbopack hit local port-binding restrictions |
| `pnpm exec next build --webpack` with network access | Pass on the unchanged application; supported alternate bundler, not a change to the build script |
| `pnpm test` | Pass: 36 route/client tests in three files, with mocked Clerk/Supabase |
| `pnpm typecheck` | Pass after correcting a typing error in a new test; no app types changed |
| `pnpm test:audit-sql` | Pass: isolated PostgreSQL 17 fixture, catalog queries, read-only transaction write rejection |
| Initial `pnpm test:browser` | Sandbox blocked local port binding; rerun with local-server permission |
| First permitted browser run | All five original cases passed, but pnpm-spawned Vite teardown hung; interrupted, stopped the owned orphan process, and corrected test-server launch |
| Final `pnpm test:browser` | Pass: seven Chromium cases in 7.7 seconds, including clean server shutdown |
| Final `pnpm build` | Pass using the unchanged default Turbopack build with normal network/local-process permission |
| Final `pnpm lint` | Pass, zero errors and the same seven pre-existing warnings |
| Final `pnpm typecheck` | Pass, including tests and harness configuration |
| Bundled skill validator | Both skills passed in a temporary Python virtual environment with PyYAML; no Python dependency added to the project |
| `git diff --check` / staged equivalent | Pass |

Local execution required normal sandbox escalation for registry access, Docker's local socket, Chromium download/execution, and local server binding. No sandbox protections were disabled. Build network access is needed because the existing app downloads Orbitron through `next/font/google`.

## Coverage and evidence limits

### Route/client tests

`tests/unit` invokes existing clothing/board handlers and the Supabase client helper. Coverage includes all handler authentication gates, metadata validation/trimming, owner-prefixed uploads, signed URL behavior, error responses, upload/insert cleanup, deletion failures, direct board uploads, closet snapshot copying, saved-board responses, snapshot-preserving PATCH, and cross-owner snapshot-prefix rejection.

These are application contract tests. Their Supabase doubles do not evaluate RLS, actual foreign keys/triggers, or real Storage authorization. A characterization test for an existing defect does not endorse the behavior.

### Chromium regression tests

The test-only Vite harness mounts the real closet, closet context, outfit builder, and saved-boards components. Tests exercise single-file upload/retry, closet search/edit/delete, deletion errors, direct board save, real PNG canvas export, saved snapshot editing, closet selection, and saved-board deletion. Network requests outside the loopback origin are blocked; API responses are explicit fixtures.

The harness adapts only Next font transformation and navigation. It does not run the real Next server, Clerk provider/middleware, Supabase, production CSS/layout, or real drag-and-drop E2E. Authenticated Next/Clerk integration requires dedicated development-instance configuration and remains outstanding. No app source includes a testing bypass.

### Database audit self-test

`scripts/verify-audit-sql.mjs` launches an ephemeral `postgres:17-alpine` container, without published ports or host volumes, and removes it afterward. It accepts no database URL or external host. The fixture contains only the owner-reported clothing columns, plus a clearly synthetic `auth.jwt()` function. No policies, triggers, or board schemas are invented.

This establishes that `scripts/audit/database-catalog.sql` executes and PostgreSQL rejects writes in read-only mode. The Supabase-specific `storage-catalog.sql` is owner-run only and has not been executed against production or a fabricated Storage schema.

**Actual RLS/grant/trigger/Storage policy tests remain blocked by missing definitions.** `docs/security-audit.md` records the evidence matrix, owner-run read-only queries, existing defects, and the exact remaining audit work. Do not claim that audit complete or enable pipeline schema based on these tests.

## Existing defects and follow-up

- MIME-only image validation; no application file-size/pixel/content check.
- Signed-URL failure after item insertion can produce duplicates on retry.
- Row-first clothing deletion can leave orphan files; board storage-first deletion can leave broken references if database deletion fails.
- Multi-step board changes are not transactional; PATCH has less position validation than POST.
- Closet state is loaded once and may survive auth changes; display URLs are not automatically renewed.
- Provider error text is exposed by several endpoints.
- Existing `pnpm-workspace.yaml` disables Sharp build scripts; native processing requirements must be verified in PR 3, not changed in PR 1A.

None is silently fixed by changing production behavior here. Authorization-related uncertainty is a release gate. Obtain sanitized schema/policy/trigger exports and bucket/Clerk configuration before real two-user/anonymous integration checks. Remaining pipeline work starts at PR 1B only when separately authorized.

## Review and rollback

Review checks: no diff under `app/`, `AGENTS.md`, `proxy.ts`, `next.config.ts`, or `pnpm-workspace.yaml`; no migration, queue, production connection, environment file, or secret added. Test dependencies only; runtime dependency versions remain unchanged (lockfile peer resolution includes the newly installed Playwright).

Rollback reverts PR 1A's documentation, skills, testing dependencies/lockfile, scripts, ignore entries, and CI steps. There is no database or application-data rollback. No deployment or merge is authorized. Skills support implementation/review of the selected PR and do not permit automatic progression through the roadmap.
