---
name: fitinerary-ui-redesign
description: Audit, plan, and implement high-quality fitinerary UI/UX changes while preserving Next.js application behavior, auth, data flow, accessibility, and responsive design.
---

# Fitinerary UI/UX redesign

Use for visual redesigns, design-system work, frontend refactors, polish, responsiveness, and interaction quality in fitinerary. Pair with an installed `better-ui` skill when available, but do not assume external skills are installed.

## Phase 1: inspect and propose

1. Read existing design tokens, fonts, components, app routes, Tailwind styles, current screenshots when available, tests, and project instructions. Identify established brand elements; do not blindly preserve or replace them.
2. Inventory key user journeys: outfit-board grid and drag/drop, closet upload/search/category filters, board save/history, and authenticated/empty/error states.
3. Evaluate information hierarchy, spacing, typography, contrast, responsiveness, keyboard/focus accessibility, motion preferences, hover/active/disabled states, and image handling. Test mobile and desktop layouts.
4. Propose a prioritized redesign plan with before/after goals, exact pages/components, reusable tokens and components, functional risks, measurable acceptance criteria, and a rollback plan. Stop for design approval before broad changes.

## Phase 2: implement approved frontend scope

5. Work in a separate Superset/Paradev worktree/branch from backend security or database migrations. Keep backend API contracts, Supabase/Clerk integration, schema, RLS, and routes unchanged unless separately authorized. Do not change unrelated business logic merely to simplify styling.
6. Favor reusable tokens/components and existing dependencies. Avoid arbitrary one-off styling, bloated animation libraries, or a flashy redesign that reduces usability. Keep motion optional for reduced-motion users.
7. Verify focus, keyboard interactions, touch targets, text contrast, loading/empty/error states, responsive breakpoints, and 3x3 board drag-and-drop. Preserve snapshot/export behavior and image performance.
8. Run relevant available checks (lint, typecheck, unit, browser tests, build). Visually review the actual pages and screenshots when browser tools are available. State clearly when visual verification was not performed.
9. Report before/after changes, exact files, design rationale, accessibility notes, tests run, any regressions or uncertain behavior, and screenshots if generated.

## Communication

Use concise, concrete language. Explain why each design change improves a specific user task. Distinguish observed UI defects from personal style preferences. Show design choices and tradeoffs rather than declaring a redesign 'modern' or 'beautiful' without evidence.

Do not commit, push, merge, or deploy without explicit authorization. Do not edit production data or credentials.
