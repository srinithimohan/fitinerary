# Fitinerary image-processing architecture

Status: architecture approved; only PR 1A foundation work is authorized for implementation. No pipeline infrastructure is created by PR 1A. Additional infrastructure budget: **$0/month**, with no new billing commitment. Successful originals must be retained for **seven days**, superseding earlier 24-hour proposals.

## Current application and evidence

- `app/api/clothing/route.ts`: Clerk-authenticated synchronous upload to `clothing-images`, then `clothing_items` insertion and a one-hour signed URL. PATCH changes metadata; DELETE removes the row before attempting file deletion.
- `app/lib/supabase.ts`: Supabase publishable key with a Clerk access-token callback. Ownership depends on deployed policies/defaults, not explicit owner filters in each query.
- `app/context/closet-context.tsx`: loads the closet once on mount. `app/ui/closet/closet.tsx`: single-file upload, metadata editing/deletion, category filtering.
- `app/api/boards/route.ts` and `app/api/boards/[id]/route.ts`: direct uploads and independent copies of closet images for saved-board snapshots. `app/ui/board/outfit-builder.tsx`: browser canvas export.
- The owner supplied clothing columns: UUID `id` default `gen_random_uuid()`, text `user_id` default JWT subject, required text `name`, `category`, `image_path`, and created/updated timestamps default `now()`. The only reported constraint is its primary key. `Uncategorized` satisfies the known API/schema requirements, but production triggers and policies remain unverified.
- No schema/policy export is checked in. See `security-audit.md` for the repository audit. Tests with mocks do not establish deployed RLS, Storage, or Clerk correctness.
- Owner-verified configuration (review supplied 2026-10-24): `clothing-images` is private, limited to 5,242,880 bytes with `["image/*"]`; RLS is enabled and `force_rls = false` on clothing, boards, board items, and Storage objects. Policy predicates, effective privileges, and cross-user behavior remain unverified. These settings do not protect against same-user snapshot aliasing; see the audit's separate board consistency follow-up.

## Product requirements

- Optimize new closet uploads only. Preserve existing single-image capability, legacy images/paths, saved-board snapshots, and direct board uploads.
- Independent file states: uploading, processing (including queued/retrying), ready, or failed with an upload/processing failure stage.
- Up to 20 files per batch; 5,000,000 bytes and 25,000,000 pixels per file. JPEG, PNG, and WebP only; reject animated/multiframe inputs in V1.
- Begin uploads with sanitized filename-derived nonempty names (fallback `Untitled clothing`) and `Uncategorized`. Allow metadata edits while processing; never overwrite them on completion.
- Only ready clothing can be added to boards. Enforce this on the server as well as in the UI.
- Intentional new uploads can duplicate photos. Retries reuse an owner-scoped operation and clothing record. No image hashing or cross-upload deduplication.
- Completed uploads continue without an open browser. Interrupted transfers require reselection, not chunked/resumable uploads. Reconcile storage before requesting another transfer.
- Target a 20-file batch within five minutes in a healthy, empty-queue pilot. This is a benchmark gate, not a free-tier availability guarantee.

## Architecture choice

Use **Supabase Queues (pgmq)** rather than Redis/BullMQ or a custom PostgreSQL execution queue. pgmq supplies atomic concurrent reads, visibility timeouts, delayed availability, read counts, and acknowledgment. Application code supplies error classification, retry limits/backoff, ownership, quotas, and guarded publication. It must not implement a competing queue or visibility scheduler.

PostgreSQL remains the source of truth for application state. Supabase Storage holds private originals and optimized images. Supabase Cron/pg_net wakes a bounded Vercel Node.js processor using Sharp. Docker runs local Supabase and the shared processor for integration/failure testing; production has no laptop dependency and needs no Docker host.

Use durable `image_processing` and `image_cleanup` queues, never unlogged queues or destructive `pop`. Execution is at least once with idempotent effects. A visibility timeout does not make external storage writes execute exactly once.

### Application records and transactions (future PRs)

- Add clothing lifecycle status, nullable processing version, and deletion marker. Backfill legacy items as ready with no processing version, without changing existing image paths.
- `image_operations`: owner/idempotency key, clothing ID, source generation, retry cycle, message ID, delivery receipt, errors, and timestamps. Unique `(user_id, idempotency_key)` and one clothing record per operation.
- `image_assets`: exact bucket/path, owning operation/generation, asset role, reserved/confirmed bytes, cleanup state. Unique bucket/path.
- Administrator-only settings and transactional per-user/global quota records. No separate custom execution job table or cross-service outbox.
- Initiation atomically checks capacity, reserves source/output bytes, and inserts operation + clothing row. Pending rows use a reserved output path to satisfy non-null `image_path`; it is never served before ready.
- A single completion RPC locks the operation, validates its current generation, updates status, calls `pgmq.send`, and stores the returned ID. All changes commit or roll back together. Separate HTTP calls are not a transaction.
- A claim RPC calls `pgmq.read` and records the current receipt/read count. Completion/failure must match that receipt, message, generation, and cycle. Use a consistent locking order across claim, publication, retry, and deletion; concurrency tests must prove stale deliveries cannot acknowledge current work.
- Upload output first; then atomically publish ready state, acknowledge the processing message, and schedule delayed cleanup. Reconcile manifested output if storage succeeds and publication fails. Only update image/lifecycle fields, never user metadata.
- User deletion hides/cancels atomically and schedules cleanup. A stale worker cannot resurrect it. Immutable versioned paths and an asset manifest bound external-write recovery.

### Upload and processing lifecycle

1. Validate file count/size in the browser for feedback. Server admission reserves capacity independently per file.
2. Upload directly to a private originals bucket with Clerk-backed authentication and exact-operation Storage policies. Vercel's 4.5 MB request limit cannot carry the agreed maximum file size.
3. Completion checks object identity/size and transactionally enqueues. A scheduled reconciliation handles lost browser completion requests.
4. Read one message at a time with a 120-second visibility timeout. Validate signatures, decoded format, dimensions and frame count before full processing. Bound downloads, decoder pixels/cache/concurrency and processing duration.
5. Profile v1: orient, fit within 1600 x 1600 without cropping/upscaling, preserve aspect ratio and alpha, convert sRGB, strip EXIF/GPS, output WebP quality 82/alpha quality 100, maximum 5 MB. No background removal. Benchmark visual quality in closet, boards, and canvas exports.
6. Publish transactionally and expose a signed output URL. Poll pending statuses with backoff/focus refresh; merge by ID without replacing newer metadata. Refresh expired display URLs on demand.

Upload authorization expires after 15 minutes. Reconcile a possibly completed transfer before retrying. Reselection uses the existing clothing row and a new source generation where required. Old attempts cannot overwrite an accepted original. Do not render unvalidated stored originals as trusted remote images; local previews remain available during the transfer.

### Retries and cleanup

- Three automatic processing attempts. Transient failures use pgmq visibility delay of about one minute then five minutes, with jitter; permanent invalid input fails immediately. Interrupted deliveries count toward exhaustion. Before a fourth attempt, record terminal failure and acknowledge without decoding.
- Allow two additional idempotent manual retry cycles while the source remains retained. A new cycle invalidates prior deliveries. Quota pauses should not consume attempts in a rapid claim loop.
- Successful original: cleanup eligible **seven days after ready**. Failed source: seven days after first terminal failure, not extended indefinitely by retry clicks. Abandoned unconfirmed upload: 24 hours. Optimized image: until item deletion. Legacy objects and saved-board snapshots: excluded.
- Cleanup rechecks generation, current activity, deadline, and references. A manual retry cannot race source removal. After expiry retain metadata and require reselection.
- Delete via Storage APIs, not storage metadata SQL. Retry removal safely; release reserved/used accounting only after absence is confirmed. Outages delay deletion and continue consuming capacity.
- Retain bounded queue archives/diagnostics; pgmq is not a backup. Define backup/recovery expectations separately before launch.

## Security, quotas, and $0 execution

Audit deployed RLS, grants, triggers, Storage policies, bucket limits, Clerk JWT mapping, and actual account usage before activation. Restrict clients to owned metadata/control RPCs. RLS alone does not protect lifecycle columns. Queue functions are worker-only; use fixed search paths and narrow grants. Never accept caller-selected worker URLs or trusted paths. Keep originals private, forbid overwrites, and keep privileged credentials server-only. Sign-in checks do not establish object authorization.

Initial configurable ceilings: 20 new operations/user/day, 20 pending/user, 40 global operations/day, 50 MB admitted original bytes/day, 700 MB total storage including all existing files and reservations, 2 GB processing downloads/rolling 30 days, and two hours processor wall time/rolling 30 days. Reserve up to 10 MB/image. Seven-day originals may hit storage limits well before count limits; storage admission takes precedence. Do not shorten retention automatically to admit more work. Count board copies/direct board uploads in shared accounting in a later explicitly scoped PR.

Runtime budgets are conservative application safeguards, not exact provider billing measurements. Recheck existing consumption before setting pilot values. Exhaustion pauses work/admission without spending or deleting existing items.

Cron checks each minute and invokes a fixed authenticated Vercel endpoint only for due processing, cleanup, or upload reconciliation. Store the dedicated caller secret in Vault and server environment variables. Set pg_net timeout to 70 seconds, Vercel max duration to 60 seconds, and an internal 45-second deadline. Read sequentially, at most five images/invocation, and stop claiming before insufficient time remains. Lost HTTP wake-ups never acknowledge pgmq messages. Validate installed timeout/function support before enabling scheduling.

Published free allowances: Supabase 1 GB files/500 MB database/5 GB egress; Vercel Hobby four CPU hours/360 GB-hours memory/one million invocations. These are shared, changeable account allowances, not dedicated pipeline capacity. Vercel Hobby's personal/noncommercial restrictions must fit the app. Supabase projects may pause after inactivity. No free-tier uptime guarantee is implied. No additional service, paid subscription, or card commitment is authorized.

## Implementation sequence and acceptance

**PR 1A (current):** documentation, two scoped skills, repository/security audit, route and browser regression tests, CI and verification evidence. No pipeline queues, schema changes, production connections/mutations, application behavior changes, or deployment. Missing schema/policy exports are explicit audit blockers; never invent policies to make tests pass.

Later PRs require separately selected scope:

| PR | Work | Required acceptance/tests | Rollback |
| --- | --- | --- | --- |
| 1B | Additive lifecycle/operation/assets schema, pgmq and protected RPCs | Legacy compatibility, authorization, transactional enqueue/ack, concurrent claims/stale receipts | Disable new writes; preserve additive state/queue |
| 2 | Direct upload, idempotency, quota admission, reconciliation | Concurrent retries/quotas, forged paths, lost responses, mixed batches | Stop admissions; retain reconciliation |
| 3 | Sharp processor, retries, publication | Image/alpha/orientation bounds, memory/latency, kill/replay/delete/edit races | Stop consumers; retain originals/messages |
| 4 | Batch UI, states/retries, board readiness | One/20-file browser flows, API readiness rejection, legacy boards/export | Lifecycle-aware UI rollback; retain accepted operations |
| 5 | Retention, cleanup, deletion and accounting | Report-only candidate review, seven-day success/failure policy, no legacy deletion, cleanup failures/races | Independent cleanup switch; deletion is irreversible |
| 6 | Cron/Vercel execution and invite-only pilot | Authenticated dispatch, duplicate wake-ups, outages/timeouts, measured budgets, healthy five-minute batch | Stop admissions/specific Cron job; preserve durable work |

Start the pilot with five invited users only after security evidence, performance benchmarks, report-only cleanup, failure tests, and free-tier account prerequisites pass. Never send one operation to two backends, mark pending ready during rollback, or drop queues/history to simplify recovery. No later PR is authorized by this roadmap.

## Sources and verification boundaries

Official references checked during architecture planning (2026-10-23):

- [Supabase Queues](https://supabase.com/docs/guides/queues), [pgmq primitives](https://supabase.com/docs/guides/queues/pgmq), [Cron](https://supabase.com/docs/guides/cron), [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net)
- [Supabase pricing](https://supabase.com/pricing), [Storage policies](https://supabase.com/docs/guides/storage/security/access-control)
- [Vercel function limits](https://vercel.com/docs/functions/limitations), [Hobby allowances](https://vercel.com/docs/plans/hobby)

Provider documentation establishes a feasible shape, not actual account capacity. PR 1A verification results and remaining blockers are recorded separately in `pr-1a-verification.md`.
