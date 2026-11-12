---
name: fitinerary-testing
description: Design and implement risk-based automated tests for fitinerary features or bug fixes, using existing Vitest, Playwright, and isolated Supabase integration infrastructure. Explain test selection and report evidence accurately.
---

# Fitinerary testing workflow

Use for test planning, adding regression coverage, or expanding an approved feature's test suite. Honor existing test conventions and do not create a parallel framework without a clear, approved reason.

## Plan before writing

1. Identify the intended behavior and list the main invariants. Inspect the relevant code, existing tests, config, and test scripts first.
2. Make a small test matrix with: invariant, happy path, invalid input, failure/edge case, security/ownership case if relevant, and regression risk.
3. Select the lowest reliable test level that can prove each claim:
   - **Unit/route (Vitest):** pure logic, route decisions, injected failures; mocks are acceptable.
   - **Browser (Playwright):** interactions, keyboard/accessibility, loading/empty/error states, drag-and-drop; state whether APIs are mocked.
   - **Integration:** actual PostgREST, RLS and Storage with two synthetic users and anonymous access; avoid production endpoints and credentials.
   - **Full E2E:** only where a real multi-component journey is necessary and the environment exists.
4. Explicitly identify which dependencies are mocked, which are real, and what the test cannot prove. Favor few high-risk tests over large shallow suites.

## Implementation and verification

5. For a bug, reproduce the defect with a failing behavioral regression test first when practical. Do not weaken tests to hide defects.
6. Keep fixtures deterministic, isolated, and synthetic. Protect sensitive audit exports; prohibit ambient production credentials and remote endpoints for integration tests. Ensure teardown even on failure.
7. Add tests as acceptance criteria for each implementation issue, unless an exception is explained and approved. Keep the core test suite fast; run expensive suites in appropriate CI jobs.
8. Execute the available relevant checks (e.g. `pnpm test`, `pnpm test:browser`, `pnpm test:integration`, `pnpm typecheck`, build). Do not claim success for unrun commands.
9. Report: test name, invariant, what was real versus mocked, commands and pass/fail counts, failure causes, coverage gaps, and next decision. Preserve known diagnostics as explicitly identified gaps, never silent skips or fabricated passes.

If the user requested only a test plan, stop before editing. If the user asked for implementation, write only scoped tests and necessary test-only infrastructure; request approval before touching production configuration or deploying.
