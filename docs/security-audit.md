# PR 1A repository security audit

Scope: repository review, owner-reported clothing columns, mocked route tests, and safe local verification. No production services were contacted. This is not a completed audit of deployed authorization.

## Evidence matrix

| Boundary | Evidence | Conclusion / missing evidence |
| --- | --- | --- |
| API authentication | Every clothing/board handler calls Clerk `auth()` and rejects absent user IDs; route tests exercise this | Verified application gate with mocked Clerk, not JWT validation |
| Supabase identity | `app/lib/supabase.ts` supplies a Clerk access-token callback and publishable key; unit test checks forwarding | Configuration shape verified; actual issuer/audience/provider setup unknown |
| Clothing ownership | GET has no explicit owner predicate; inserts rely on default owner; PATCH/DELETE filter by ID | Isolation depends on real RLS/defaults/grants. No policy export available |
| Board ownership | Routes query IDs and nested board items through the user-scoped client | Board/item RLS, foreign keys and cascade semantics unknown |
| Object authorization | Storage SDK calls use the user-scoped client; new paths include Clerk subject | Prefixes do not prove access control. Privacy, insert/copy/read/delete policies and overwrite rules unknown |
| Clothing schema | Owner supplied UUID PK; required owner/name/category/path; JWT-sub owner default; timestamp defaults | Provenance is owner report, not independently queried. No category CHECK reported; triggers remain unknown |
| Lifecycle concurrency | Existing uploads use a new random UUID on each POST | No idempotency contract in current app; future pipeline must add it |

No production schema/policy definitions are fabricated or installed. `scripts/audit/database-catalog.sql` and `storage-catalog.sql` are optional **owner-run read-only catalog queries**. Review and sanitize results before sharing: function definitions and policy expressions can contain privileged literals. Never commit raw keys, signed URLs, application rows, JWTs, or secret-table contents.

## Existing findings (not introduced or fixed by PR 1A)

### High-impact uncertainty: object authorization cannot be established

The route code intentionally depends on RLS. Without actual policies, grants, trigger definitions, bucket configuration, and two-user integration evidence, cross-user isolation cannot be claimed. A wrong policy could expose or modify another user's clothing or boards. Verify authenticated and anonymous roles, owner changes, nested board access, Storage signing/copy/deletion, and column-level grants before pipeline implementation. Authentication alone does not resolve this finding.

### Upload validation trusts declared content type

`app/api/clothing/route.ts` POST and board upload branches check `file.type.startsWith('image/')`. They do not verify magic bytes, decoded format, pixels, file size, or animation. Filename extensions are caller-controlled. A source labeled as an image can pass this application check. Actual bucket limits are unknown. PR 1A does not tighten validation because that changes production behavior; future pipeline checks must enforce it at trusted boundaries.

### Upload may succeed despite an error response

Clothing POST uploads, inserts, then signs. If signing fails, it returns 500 after the item exists. A retry can create another record/object. `tests/unit/clothing.test.ts` characterizes this failure. Rollback cleanup after insertion failure also does not confirm removal success. Durable operation identity/reconciliation is required by the approved architecture.

### Clothing deletion can leave an orphan

DELETE removes the row before deleting its original. Storage failure is logged but returns success. There is no durable cleanup record. The regression suite records this behavior rather than endorsing it. Deletion only targets the closet original; snapshot copies must remain independent.

### Board writes span multiple nontransactional operations

Creation inserts the board, copies/uploads objects, and inserts items with best-effort cleanup. Editing performs upsert, deletion, board update, and storage cleanup separately. Board deletion removes snapshot objects before deleting the board row, so later database failure can leave existing references broken. Database FK/cascade behavior is not available to verify. No application changes are made here.

### Board PATCH does less item validation than POST

POST validates position range/uniqueness. PATCH validates the items array but does not perform equivalent position validation before processing; null/malformed members can throw. Its caller-supplied snapshot path check establishes only the current-user prefix, not membership in that particular board. Storage/RLS may constrain access, but that is unverified. Add a separately scoped validation fix after reviewing intended behavior.

### Session and URL lifecycle need integration verification

`ClosetProvider` loads once on mount, does not subscribe to Clerk identity changes, and retains signed URLs without automatic refresh. A sign-out/account switch without remount can leave stale displayed client state even if APIs correctly reject access. This is not evidence of a server authorization bypass. Verify with a development Clerk instance, and address session reset/expiry in a separately scoped change.

### Raw backend errors are exposed

Several handlers return provider error messages in 500 responses. They may reveal internal details. Error sanitization should be considered separately without silently changing the API baseline here.

## What tests establish

- Vitest invokes real route handlers and NextResponse with mocked auth/Supabase. It verifies application control flow, request validation, API shapes, snapshot paths and cleanup attempts. It cannot prove actual policy enforcement or transaction semantics.
- Playwright mounts real client components in a Vite-only harness; API traffic is mocked and non-local requests blocked. Font transformation and Next navigation are test adapters. It covers component/browser behavior, including actual PNG canvas download, not real Next routing/SSR, drag-and-drop fidelity, Clerk login, or Supabase integration.
- `pnpm test:audit-sql` launches an ephemeral local PostgreSQL container with only the owner-reported clothing columns and a synthetic `auth.jwt()` placeholder. It validates catalog SQL and PostgreSQL read-only enforcement, **not RLS**. No policy or board schema is invented.

## Remaining audit work / release gate

Obtain sanitized definitions via the owner-run queries; verify bucket limits/privacy and Clerk provider configuration. Recreate the actual definitions in isolated local Supabase, then test users A/B and anonymous requests through database roles and Storage HTTP. Capture policy/grant/trigger behavior, owner spoofing and changes, board snapshot preservation, and development Clerk sign-in/sign-out. Until then real authorization and policy tests remain **blocked by unavailable evidence**, not passing or silently skipped. No queues or lifecycle migrations belong in this audit task.
