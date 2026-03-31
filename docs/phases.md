# fileaway.app — Phase Roadmap

> Status as of 2026-03-30. All phases tracked under goal: "Run a tech company that makes social media easier for everyday people and also hardware that saves peoples time."

## Phase Summary

| Phase | Title                                   | Status    | Key Issues                                   |
| ----- | --------------------------------------- | --------- | -------------------------------------------- |
| 1     | Save & Process Pipeline                 | ✅ Done    | [CAL-10], [CAL-11], [CAL-12], [CAL-13], [CAL-14] |
| 2     | Display & Actions (Feed UI)             | ✅ Done    | [CAL-16], [CAL-17], [CAL-18]                 |
| 3     | Convex Migration + Auth UI + Deploy     | ✅ Done    | [CAL-20], [CAL-22], [CAL-23], [CAL-24], [CAL-25] |
| 4     | Polish & Hardening                      | ✅ Done    | TBD                                          |

---

## Phase 1 — Save & Process Pipeline ✅

**Scope:** Scaffold codebase, URL submission, platform detection, Apify scraping, Gemini categorization/extraction, status tracking.

**Completed issues:**
- [CAL-10](/CAL/issues/CAL-10) — Scaffold fileaway.app codebase (Next.js + Supabase setup)
- [CAL-11](/CAL/issues/CAL-11) — Write Phase 1 PRD → [PRD document](./phase-1-prd.md)
- [CAL-12](/CAL/issues/CAL-12) — Prepare Phase 1 test plan → [Test plan document](./test-plan-phase-1.md)
- [CAL-13](/CAL/issues/CAL-13) — Testing and Git
- [CAL-14](/CAL/issues/CAL-14) — Execute Phase 1 test suite (116 tests passing)

**Test results:** 116 passing tests at Phase 1 completion.

---

## Phase 2 — Display & Actions ✅

**Scope:** Card-based feed, category-specific card layouts, action buttons, manual category override, search and filter.

**Completed issues:**
- [CAL-15](/CAL/issues/CAL-15) — Proceed with Phase 2
- [CAL-16](/CAL/issues/CAL-16) — Phase 2 backend — SavedItems feed API + category filtering
- [CAL-17](/CAL/issues/CAL-17) — Phase 2 frontend — Card feed, action buttons & category filter UI
- [CAL-18](/CAL/issues/CAL-18) — Phase 2 QA — Test plan and integration tests (141 passing tests)
- [CAL-19](/CAL/issues/CAL-19) — Configure fileaway.app project workspace/repo

**Action buttons delivered:**

| Category        | Action                | Behavior                                        |
| --------------- | --------------------- | ----------------------------------------------- |
| `food`          | Save to Google Maps   | Opens `https://maps.google.com/?q=<address>`    |
| `recipe`        | Copy ingredient list  | Copies ingredients to clipboard                 |
| `fitness`       | Save to my routine    | Saves exercise list to localStorage or DB       |
| `how-to`        | Save as guide         | Clean readable view of steps                    |
| `video-analysis`| Copy summary          | Copies summary to clipboard                     |
| `other`         | Copy summary          | Copies summary to clipboard                     |

---

## Phase 3 — Convex Migration + Auth + Deploy ✅

**Scope:** Board expressed concern that the app only showed mock data with no live keys/database. Decision was made to migrate from Supabase to Convex and deploy to production.

**Completed issues:**
- [CAL-20](/CAL/issues/CAL-20) — Deployment concerns (board review → migration plan)
- [CAL-21](/CAL/issues/CAL-21) — Check in the code before moving to next plan
- [CAL-22](/CAL/issues/CAL-22) — Phase 3: Migrate backend from Supabase to Convex + deploy
- [CAL-23](/CAL/issues/CAL-23) — Phase 3: Build auth UI (login/signup pages) for Convex
- [CAL-24](/CAL/issues/CAL-24) — Fix: auth on live deployment not working
- [CAL-25](/CAL/issues/CAL-25) — Phase 3 QA — Test Convex migration & auth UI

**Key changes:**
- Replaced Supabase + pgboss with Convex (DB, auth, background jobs in one platform)
- Replaced SQL schema with `convex/schema.ts`
- Background job queue replaced by `ctx.scheduler.runAfter` in Convex actions
- Auth replaced with `@convex-dev/auth` (Password provider)
- Deployed to Vercel with Convex Cloud backend

---

## Phase 4 — Polish & Hardening ✅

**Scope:** User corrections flow, dashboard stats, retry for failed items, mobile-responsive layout, bookmarklet / share extension.

**Completed:**
- `saveCorrection` Convex mutation — stores user correction note + optional category fix in `userCorrection` field
- `retryItem` Convex mutation — resets failed items to pending and re-schedules processing
- `stats` Convex query — returns per-category counts, failed/processing totals, recent saves
- `CorrectionModal` in `ItemCard` — "✗" button opens modal; submission saves `userCorrection`
- Retry button in `FailedBody` on failed item cards
- `/dashboard` page with summary stats + category bar chart + recent saves list
- `/add?url=` page — bookmarklet target, auto-submits the passed URL, redirects to feed
- `/share` page — bookmarklet drag-to-install + mobile sharing instructions
- Mobile layout: two-row header on mobile, wrapping filter row, ≥ 44px touch targets on action buttons
- 8 new Jest tests for `computeStats()` helper

---

## Social Media Product — Separate Track (Backlog)

The company goal includes a broader social media product (not fileaway.app). This track is in backlog.

- [CAL-1](/CAL/issues/CAL-1) — Hire first engineer and create hiring plan ✅
- [CAL-2](/CAL/issues/CAL-2) — Define MVP feature set for social media product ✅ → [Feature set](./social-media-mvp-feature-set.md)
- [CAL-3](/CAL/issues/CAL-3) — Scaffold social media app codebase (backlog)
- [CAL-4](/CAL/issues/CAL-4) — Research hardware opportunities ✅
