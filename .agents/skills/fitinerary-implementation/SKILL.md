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
- ## Testing requirements
For every implementation issue:
1. Read the issue's acceptance criteria before coding.
2. Identify which existing tests should continue passing.
3. Add or update automated tests for new behavior,
   edge cases, authorization, and relevant failure paths.
4. Prefer writing failing regression tests before fixing bugs.
5. Run all applicable tests, typechecking, lint, and build.
6. Report which acceptance criteria have been verified
   and which remain untested.
7. Never weaken or delete tests merely to make CI pass.

## Technical communication and learning (STE-inspired)

- Use short, direct sentences and active voice.
- Define unfamiliar technical terms the first time they appear.
- Explain why each component exists and what problem it solves.
- Use concrete examples from the fitinerary codebase.
- Clearly distinguish:
  - Observed in code
  - Assumed
  - Recommended
  - Verified by testing
- Explain important engineering tradeoffs and failure cases.
- Do not use unnecessary jargon or vague technical language.
- Never claim mocked tests prove real database authorization.

## Before substantial implementation

Explain:
1. The problem being solved.
2. How the existing system works.
3. The proposed solution.
4. Reasonable alternatives and tradeoffs.
5. What must always remain true (invariants).
6. How the implementation will be tested.
7. Risks and required approvals.

## Testing and verification

- Treat tests as acceptance criteria for implementation tasks.
- Reuse the existing Vitest, Playwright, and Supabase
  integration testing infrastructure.
- Do not create redundant testing frameworks.
- Report exact tests executed and their results.
- Explain what tests do and do not establish.

## Engineering ownership

- Preserve existing security and approval requirements.
- Never access production, apply migrations, commit,
  push, merge, or deploy without explicit permission.
- Do not automatically write my final PR descriptions
  or review comments.
- Help me understand and evaluate engineering decisions.