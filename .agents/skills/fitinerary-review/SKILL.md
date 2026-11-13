---
name: fitinerary-review
description: Review any Fitinerary PR against its approved scope, relevant architecture, security requirements, and regression evidence. Use for review, not automatic implementation or deployment. Do not modify code.
---

# Fitinerary review

- Read `AGENTS.md`, the selected PR scope, relevant architecture documentation, and the full diff. Review existing callers when needed; do not assume a passing mock proves integration correctness.
- Identify the PR using the user-provided PR number or branch. Otherwise, inspect the current Git branch and use GitHub CLI to find its associated PR when available. Determine the actual base branch, head branch, description, and changed files. Do not guess if the target is ambiguous.
- Discover relevant requirements dynamically. Read the PR description, linked issues, acceptance criteria, and feature-specific documentation when applicable. Do not assume every PR belongs to the same feature or roadmap.
- Prioritize correctness, authorization, authentication, data integrity, concurrency, compatibility, error handling, test isolation, and accidental production access.
- Check that test commands actually run meaningful cases, CI detects failures, and fixtures cannot reach real services. Distinguish route mocks, component-browser tests, local policy tests, and live integration evidence.
- Check for unintended behavior changes, missing requirements, unnecessary complexity, scope expansion, security vulnerabilities, and regressions.
- Respect project-wide constraints documented in `AGENTS.md`, including infrastructure costs, security requirements, and production safety. Apply feature-specific constraints only when relevant.
- Return actionable findings ordered by severity, with file/line references, impact, and a concrete verification or correction. Separate existing defects from regressions and unverified assumptions. State when there are no new findings; retain material testing limitations.
- Review is read-only. Do not modify code, weaken checks, merge, deploy, approve, or start the next PR. Reference relevant architecture documentation rather than duplicating it.

## PR identification and context

- If the user specifies a PR number or branch, use that as the review target.
- Otherwise, inspect the current branch using `git branch --show-current`.
- If GitHub CLI is available, use `gh pr view` to identify the associated PR, including its title, description, base branch, and head branch.
- If no PR exists, review the current branch only when its intended base branch can be established reliably.
- If the target PR or base branch cannot be identified unambiguously, ask for clarification.
- Inspect the complete diff against the PR's actual base branch, using the appropriate merge-base comparison.
- Distinguish committed PR changes from uncommitted local modifications.
- Identify the intended behavior, scope, and acceptance criteria before evaluating correctness.
- Do not assume that the newest PR or most recent commit is necessarily the intended review target.

## Review communication

- Explain findings in clear, precise technical language.
- Define unfamiliar concepts when necessary.
- Explain why each finding matters and what could go wrong.
- Use concrete examples from the changed code.
- Distinguish confirmed defects, potential risks, existing defects, regressions, and unverified assumptions.
- Do not make unsupported security or correctness claims.
- Explain the smallest practical correction or verification step for each finding.
- Prioritize meaningful issues rather than generating unnecessary findings.

## Scope-specific review

- Use the selected PR's approved scope and acceptance criteria as the primary review standard.
- Read feature-specific architecture documents only when relevant to the PR's changes or dependencies.
- Apply image-pipeline requirements only when reviewing image-processing changes.
- Apply authentication requirements when reviewing authentication-related changes.
- Apply database and authorization requirements when reviewing changes involving data access or persistence.
- Apply UI and accessibility requirements when reviewing relevant frontend changes.
- Consider interactions with existing components and potential regressions outside the directly modified files.
- Identify missing or ambiguous acceptance criteria as verification limitations.
- Do not invent requirements unrelated to the selected PR.
- Do not enforce requirements from unrelated features or future PRs.

## Test and verification review

- Identify the automated tests and CI checks relevant to the PR.
- Run appropriate read-only verification commands when feasible and permitted.
- Confirm that tests exercise meaningful behavior rather than only mocked assumptions.
- Verify that CI includes the relevant tests and detects failures.
- Distinguish unit tests, integration tests, browser tests, local policy tests, and live-service tests.
- Check that test fixtures and configurations cannot accidentally access or modify production resources.
- Do not claim integration correctness based solely on unit tests or mocks.
- Explicitly state which checks were run, which passed or failed, and which could not be verified.
- Do not modify tests or weaken existing verification requirements.

## Final review verdict

End each review with:

1. Findings ordered by severity, including file/line references, impact, and recommended corrections.
2. Tests and checks verified, and any verification gaps.
3. Remaining risks or questions.
4. Verdict:
   - Ready for approval
   - Changes requested
   - Blocked pending verification

Explain the verdict and identify the smallest next action.

Never approve, merge, deploy, or modify files automatically. The user retains responsibility for final approval and merging.