---
name: fitinerary-implementation
description: Implement a specifically approved Fitinerary PR, using its architecture and verification boundaries. Use for Fitinerary engineering work, not permission to start later PRs.
---

# Fitinerary implementation

- Read `AGENTS.md`, `docs/image-pipeline-plan.md`, and the user's selected PR scope before editing. Consult the installed Next.js guides before application changes.
- Implement only the selected PR. The architecture roadmap is not authorization to execute it. Preserve existing user-facing behavior unless the selected change explicitly changes it.
- PR 1A permits documentation, repository audit, test tooling, tests, and CI. It does not permit pipeline queues, lifecycle migrations, production changes, or image processing.
- Keep additional infrastructure spending at $0. Successful originals have a seven-day retention requirement. Do not deploy, change production data/policies/storage, add secrets, or merge without explicit authorization.
- Use repository-local, synthetic fixtures. Do not fabricate missing RLS policies or treat mocks as evidence that real authorization works. Catalog exports must be read-only and sanitized.
- Test observable behavior and failure boundaries. Run lint, typechecking, route tests, browser regressions, and build as applicable; consult `docs/pr-1a-verification.md` for commands and known limits.
- Review the full diff for scope, security, regressions, and sensitive data. Report exact commands/outcomes, evidence limits, remaining defects, and rollback. Commit/push/create a draft PR only when requested. Stop at the approved review boundary.
