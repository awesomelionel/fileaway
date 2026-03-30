# Phase 1 PRD — Save & Process

> Source: [CAL-11](/CAL/issues/CAL-11#document-plan) — Written by PM

**Product:** fileaway.app
**Phase:** 1 — Save & Process
**Timeline:** Weeks 1–3
**Owner (Product):** PM
**Owner (Engineering):** Engineer
**Status:** Completed

---

## Overview

fileaway.app lets users paste a social media URL and have AI automatically extract structured, actionable information from the content. Phase 1 covers the entire backend pipeline: from URL submission to structured extraction and status tracking. The output of Phase 1 is a system where any submitted TikTok or Instagram URL is queued, scraped, analyzed by Gemini, categorized, and surfaced as structured data — ready for Phase 2 display.

**Platforms in scope for Phase 1 MVP:** TikTok, Instagram
**Budget cap (Apify + Gemini combined):** $500/month

---

## User Stories & Acceptance Criteria

### Story 1 — URL Submission

**As a user, I want to paste a social media URL so that fileaway can save and process the content for me.**

**AC 1.1 — Valid URL accepted**
- Given I am on the fileaway app
- When I paste a valid TikTok or Instagram URL into the input field and submit
- Then the system accepts the URL, creates a `SavedItem` record with status `pending`, and shows a confirmation that the item is queued

**AC 1.2 — Duplicate URL handled**
- Given I submit a URL that I have already submitted before
- When the system detects a duplicate (same URL, same user)
- Then the system does NOT create a duplicate record; instead it returns the existing `SavedItem` with its current status

**AC 1.3 — Unsupported platform rejected**
- Given I paste a URL from an unsupported platform (e.g. YouTube, Twitter/X)
- When I submit
- Then the system rejects with: "This platform isn't supported yet. We currently support TikTok and Instagram."

**AC 1.4 — Invalid URL rejected**
- Given I paste a string that is not a valid URL
- When I submit
- Then the system rejects with: "Please enter a valid TikTok or Instagram URL."

**AC 1.5 — Submission is non-blocking**
- Given a valid URL is submitted
- When the submission is accepted
- Then the API responds within 500ms and the user does not wait for scraping or AI processing to complete

---

### Story 2 — Platform Detection

**AC 2.1 — TikTok URL detected** → platform field set to `tiktok`
**AC 2.2 — Instagram URL detected** → platform field set to `instagram`
**AC 2.3 — Short URLs resolved** — follows redirects server-side before storing
**AC 2.4 — Unknown platform logged** → set `platform = unknown`, reject from queue with user-visible error

---

### Story 3 — Apify Scraping

**AC 3.1 — Metadata scraped for TikTok:** video URL/stream, caption text, author handle, view count, like count, share count, comment count
**AC 3.2 — Metadata scraped for Instagram:** media URL, caption, author handle, like count (if public)
**AC 3.3 — Scrape failure handled gracefully:** status set to `failed`, failure reason stored, no Gemini call made
**AC 3.4 — Cached content not re-scraped:** reuses existing `raw_content` for duplicate URLs
**AC 3.5 — Scraping is asynchronous:** job runs in background, user not blocked

---

### Story 4 — Auto-Categorization

**AC 4.1 — Category assigned from Gemini output:** exactly one of `food`, `fitness`, `recipe`, `how-to`, `video-analysis`, `other`
**AC 4.2 — Categorization uses Gemini Flash** (`gemini-1.5-flash`)
**AC 4.3 — Uncategorizable content defaults to `other`** with low-confidence flag
**AC 4.4 — Category is stored and queryable**

---

### Story 5 — Structured Data Extraction

**AC 5.1 — Food/Places:** `{ name, address, cuisine_type, why_visit }` — missing fields are `null`
**AC 5.2 — Recipe:** `{ ingredients: [...], steps_summary }`
**AC 5.3 — Workout/Fitness:** `{ exercises: [...], sets_reps, muscle_groups: [...] }`
**AC 5.4 — How-To:** `{ steps: [...] }`
**AC 5.5 — Other/Video-analysis:** `{ summary: "..." }`
**AC 5.6 — Appropriate Gemini model used:** `gemini-1.5-pro` for deep extraction; flash acceptable if budget exceeded. Model used is logged.
**AC 5.7 — Extraction failure does not orphan item:** retried up to 2 additional times with exponential backoff before permanently failing

---

### Story 6 — Status Tracking

**AC 6.1 — Status transitions:** `pending` → `processing` → `done` (or `failed` at any step after submission)
**AC 6.2 — Status accessible via API**
**AC 6.3 — Failed items surfaced** with `status = failed` and human-readable `error_reason`
**AC 6.4 — Status transitions timestamped** with `processed_at`

---

## Success Metrics — Phase 1

| Metric                           | Target       | Notes                                                          |
| -------------------------------- | ------------ | -------------------------------------------------------------- |
| URL submission success rate      | ≥ 98%        | % of valid submissions that return 2xx with a SavedItem        |
| Scraping success rate            | ≥ 85%        | % of queued jobs that return scraped content (public accounts) |
| Categorization accuracy          | ≥ 80%        | Manual spot-check of 20 items per category per week            |
| End-to-end processing time (p50) | ≤ 60 seconds | From submission to status = done                               |
| End-to-end processing time (p95) | ≤ 5 minutes  | Accounts for queue back-pressure                               |
| Failed item rate                 | ≤ 10%        | % of submitted items that end in failed                        |
| Cost per item (Apify + Gemini)   | ≤ $0.05      | Keeps budget under $500/month at ~10k items/month              |
| Duplicate scrape calls           | 0%           | Cache must prevent any re-scrape of already-processed URLs     |

---

## Non-Functional Requirements

**Latency**
- URL submission API response: ≤ 500ms (p99)
- Job queue enqueue time: ≤ 1 second from submission
- Scraping worker start time: ≤ 30 seconds from queue entry

**Reliability**
- Retry policy: up to 3 attempts with exponential backoff for Apify and Gemini failures
- Job queue must be durable — jobs survive server restart
- Dead-letter queue for jobs that exhaust retries

**Cost Controls**
- Gemini model selection configurable per category without code deploy
- Apify actor calls rate-limited to max configurable concurrency (default: 5 concurrent actors)
- Alert when projected monthly spend exceeds $400 (80% of cap)

**Security**
- URL submission endpoint must require auth JWT — no anonymous submissions
- Apify and Gemini API keys stored as environment secrets only

**Observability**
- Each pipeline step emits a structured log event with `saved_item_id`, `step`, `status`, `duration_ms`, and `model`

---

## Out of Scope — Phase 1

| Item                             | Deferred To   |
| -------------------------------- | ------------- |
| Frontend card display            | Phase 2       |
| Action buttons                   | Phase 2       |
| Manual category override         | Phase 2       |
| Search and filter UI             | Phase 2       |
| User correction / feedback loop  | Phase 3       |
| Auth UI / login flow             | Phase 4       |
| Shot-by-shot video breakdown     | v2            |
| YouTube / Twitter/X support      | v2            |
| Multi-user sharing               | v2            |
| Mobile app                       | post-MVP      |

---

## Data Model Reference (Phase 1)

```
SavedItem {
  id                 UUID (PK)
  user_id            UUID (FK → auth.users)
  source_url         TEXT (original submitted URL)
  canonical_url      TEXT (normalized URL for dedup)
  platform           ENUM (tiktok | instagram | unknown)
  category           ENUM (food | fitness | recipe | how-to | video-analysis | other)
  raw_content        JSONB (scraped metadata from Apify)
  extracted_data     JSONB (structured output from Gemini)
  gemini_model_used  TEXT (e.g. gemini-1.5-flash)
  status             ENUM (pending | processing | done | failed)
  error_reason       TEXT (nullable)
  created_at         TIMESTAMPTZ
  updated_at         TIMESTAMPTZ
  processed_at       TIMESTAMPTZ (nullable)
}
```

> **Note:** In Phase 3, this schema was migrated to Convex (`convex/schema.ts`). Field names follow camelCase convention in Convex. See [architecture.md](./architecture.md).
