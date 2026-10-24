---
name: fitinerary-review
description: Review a Fitinerary PR against its approved scope, architecture, security requirements, and regression evidence. Use for review, not automatic implementation or deployment.
---

# Fitinerary review

- Read `AGENTS.md`, `docs/image-pipeline-plan.md`, the selected PR scope, and the full diff. Review existing callers when needed; do not assume a passing mock proves integration correctness.
- Prioritize authorization, data integrity, concurrency, compatibility, test isolation, and accidental production access. For PR 1A, flag application behavior changes, invented database policies, pipeline implementation, and claims exceeding the available evidence.
- Check that test commands actually run meaningful cases, CI includes failures, and fixtures cannot reach real services. Distinguish route mocks, component-browser tests, local policy tests, and live integration evidence.
- Verify successful-original retention remains seven days and no paid infrastructure, secrets, production mutation, or later-PR scope has been introduced.
- Return actionable findings ordered by severity, with file/line references, impact, and a concrete verification or correction. Separate existing defects from regressions and unverified assumptions. State when there are no new findings; retain material testing limitations.
- Review is read-only unless fixes are separately requested. Do not weaken checks, merge, deploy, or start the next PR. Link to the shared architecture rather than duplicating it.
