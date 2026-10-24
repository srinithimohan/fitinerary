# PR 1A repository security audit

Scope: repository review, owner-reported clothing columns and owner-verified configuration, mocked route tests, and safe local verification. The implementing agent did not contact production services. This is not a completed audit of deployed authorization.

## Evidence matrix

| Boundary | Evidence | Conclusion / missing evidence |
| --- | --- | --- |
| API authentication | Every clothing/board handler calls Clerk `auth()` and rejects absent user IDs; route tests exercise this | Verified application gate with mocked Clerk, not JWT validation |
| Supabase identity | `app/lib/supabase.ts` supplies a Clerk access-token callback and publishable key; unit test checks forwarding | Configuration shape verified; actual issuer/audience/provider setup unknown |
| Clothing ownership | GET has no explicit owner predicate; inserts rely on default owner; PATCH/DELETE filter by ID. Owner verified RLS enabled, force_rls false | Isolation depends on policy predicates/effective grants. No policy export available |
| Board ownership | Routes query IDs and nested board items through the user-scoped client. Owner verified RLS enabled, force_rls false | Board/item policy predicates, effective privileges, foreign keys and cascade semantics remain unverified |
| Object authorization | Storage SDK calls use the user-scoped client; new paths include Clerk subject. Owner verified private bucket and Storage objects RLS | Privacy/limits are known below; insert/copy/read/delete policies, effective privileges and overwrite authorization remain unverified. Prefixes do not prove access control |
| Clothing schema | Owner supplied UUID PK; required owner/name/category/path; JWT-sub owner default; timestamp defaults | Provenance is owner report, not independently queried. No category CHECK reported; triggers remain unknown |
| Lifecycle concurrency | Existing uploads use a new random UUID on each POST | No idempotency contract in current app; future pipeline must add it |

No production schema/policy definitions are fabricated or installed. `scripts/audit/database-catalog.sql` and `storage-catalog.sql` are optional **owner-run read-only catalog queries**. Review and sanitize results before sharing: function definitions and policy expressions can contain privileged literals. Never commit raw keys, signed URLs, application rows, JWTs, or secret-table contents.

## Owner-verified configuration

Provenance: the owner's PR review supplied/confirmed the following configuration on 2026-10-24. These are owner-verified values, not independently queried by this agent or validated by the mocks. Raw catalog/policy exports have not been provided.

| Setting | Confirmed value |
| --- | --- |
| `clothing-images` visibility | Private |
| Bucket file-size limit | 5,242,880 bytes (5 MiB) |
| Bucket allowed MIME types | `["image/*"]` |
| `public.clothing_items`, `public.boards`, `public.board_items`, `storage.objects` | RLS enabled on all four; `force_rls = false` |

These flags/settings do not establish policy predicates, effective privileges, or cross-user authorization behavior. `force_rls = false` must be considered when evaluating owner/bypass roles; it is not by itself proof of a client authorization defect. The planned 5,000,000-byte pipeline ceiling is slightly stricter than the existing 5 MiB bucket limit. Neither MIME wildcard configuration nor private visibility proves that actual file content is validated.

## Existing findings (not introduced or fixed by PR 1A)

### High-impact uncertainty: object authorization cannot be established

The route code intentionally depends on RLS. RLS enablement and private bucket configuration are owner-verified, but without actual policy predicates, effective grants, trigger definitions, and two-user integration evidence, cross-user isolation cannot be claimed. A wrong policy could expose or modify another user's clothing or boards. Verify authenticated and anonymous roles, owner changes, nested board access, Storage signing/copy/deletion, and column-level grants before pipeline implementation. Authentication alone does not resolve this finding. Correct cross-user isolation also would not prevent same-user snapshot aliasing and deletion of unrelated owned images, described below.

### Upload validation trusts declared content type

`app/api/clothing/route.ts` POST and board upload branches check `file.type.startsWith('image/')`. They do not verify magic bytes, decoded format, pixels, file size, or animation. Filename extensions are caller-controlled. A source labeled as an image can pass this application check. The owner-verified bucket limits uploads to 5,242,880 bytes and permits `["image/*"]`; this does not establish decoded-content validation. PR 1A does not tighten validation because that changes production behavior; future pipeline checks must enforce it at trusted boundaries.

### Upload may succeed despite an error response

Clothing POST uploads, inserts, then signs. If signing fails, it returns 500 after the item exists. A retry can create another record/object. `tests/unit/clothing.test.ts` characterizes this failure. Rollback cleanup after insertion failure also does not confirm removal success. Durable operation identity/reconciliation is required by the approved architecture.

### Clothing deletion can leave an orphan

DELETE removes the row before deleting its original. Storage failure is logged but returns success. There is no durable cleanup record. The regression suite records this behavior rather than endorsing it. Deletion only targets the closet original; snapshot copies must remain independent.

### Board writes span multiple nontransactional operations

Creation inserts the board, copies/uploads objects, and inserts items with best-effort cleanup. Editing performs upsert, deletion, board update, and storage cleanup separately. Board deletion removes snapshot objects before deleting the board row, so later database failure can leave existing references broken. Database FK/cascade behavior is not available to verify. No application changes are made here.

### Board PATCH does less item validation than POST

POST validates position range/uniqueness. PATCH validates the items array but does not perform equivalent position validation before processing; null/malformed members can throw. Its caller-supplied snapshot path check establishes only the current-user prefix, not membership in that particular board. Storage/RLS may constrain access, but that is unverified. Add a separately scoped validation fix after reviewing intended behavior.

### Board consistency follow-up

The known-defect group in `tests/unit/boards.test.ts` records unsafe existing behavior, **not a desired contract**. These tests assert calls, injected operation results, invocation order where relevant, and HTTP responses. The sequential double cannot establish actual constraints, transactions, successful persistence, or persisted-state integrity. A separate corrective PR must replace unsafe expectations with the intended protections and add real integration/fault tests; no application fix is included here.

| ID | Characterized boundary | Corrective follow-up |
| --- | --- | --- |
| BD-01 | PATCH accepts a path from another board owned by the same user without copying; a scripted later DELETE read passes that alias to Storage removal | Restrict reusable references to the current board's actual items, or create independent owned copies with explicit lifecycle rules; test deleting either board never damages the other |
| BD-02 | Storage removal succeeds, then board-row deletion returns an error; no restoration occurs | Coordinate deletion state and recoverable asset cleanup so database failure cannot leave a surviving board pointing to removed images |
| BD-03 | Item upsert reports success, then omitted-row deletion fails; no compensating writes or cleanup occur | Make related database changes atomic and reconcile storage effects |
| BD-04 | Item upsert and omitted-row deletion report success, then board update fails; earlier writes are not rolled back by the handler | Same atomicity/recovery requirement, verified against real transaction boundaries |
| BD-05 | Old-image cleanup returns an error after item/board writes report success, but PATCH returns 200 | Record and retry cleanup rather than ignore returned Storage errors |
| BD-06 | Old-image cleanup throws after item/board writes report success; catch removes the newly referenced image without rolling back references | Separate post-commit cleanup from pre-commit compensation; never compensate by deleting published assets |

Same-user aliasing is a data-lifecycle defect even if cross-user RLS is correct: the owner may legitimately delete both paths, but two boards can reference the same object and deleting one can break the unrelated board. The BD-01 follow-up read is explicitly scripted; it demonstrates the handler path for an alias, not a real persisted-state experiment.

The positive preservation case now supplies a matching existing board-item row **and** an omitted row. It asserts that cleanup receives only the omitted path and that row deletion excludes the retained row. This verifies handler cleanup selection under the supplied fixture, not deployed referential integrity.

### Session and URL lifecycle need integration verification

`ClosetProvider` loads once on mount, does not subscribe to Clerk identity changes, and retains signed URLs without automatic refresh. A sign-out/account switch without remount can leave stale displayed client state even if APIs correctly reject access. This is not evidence of a server authorization bypass. Verify with a development Clerk instance, and address session reset/expiry in a separately scoped change.

### Raw backend errors are exposed

Several handlers return provider error messages in 500 responses. They may reveal internal details. Error sanitization should be considered separately without silently changing the API baseline here.

## What tests establish

- Vitest invokes real route handlers and NextResponse with mocked auth/Supabase. It verifies application control flow, request validation, API shapes, snapshot paths and cleanup attempts. It cannot prove actual policy enforcement or transaction semantics.
- Playwright mounts real client components in a Vite-only harness; API traffic is mocked and non-local requests blocked. Font transformation and Next navigation are test adapters. It covers component/browser behavior, including actual PNG canvas download, not real Next routing/SSR, drag-and-drop fidelity, Clerk login, or Supabase integration.
- `pnpm test:audit-sql` launches an ephemeral local PostgreSQL container with only the owner-reported clothing columns and a synthetic `auth.jwt()` placeholder. It validates catalog SQL and PostgreSQL read-only enforcement, **not RLS**. No policy or board schema is invented.

## Remaining audit work / release gate

Obtain sanitized policy/grant/trigger/schema definitions via the owner-run queries and verify Clerk provider configuration. Preserve the owner-verified bucket/RLS values above as evidence; reconfirm them when reproducing the environment. Recreate the actual definitions in isolated local Supabase, then test users A/B and anonymous requests through database roles and Storage HTTP, plus same-user alias/deletion cases. Capture policy/grant/trigger behavior, owner spoofing and changes, board snapshot preservation, and development Clerk sign-in/sign-out. Until then real authorization and policy tests remain **blocked by unavailable evidence**, not passing or silently skipped. No queues or lifecycle migrations belong in this audit task.
