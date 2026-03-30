# Clipwise MVP Test Plan

## Overview

This test plan covers all 4 phases of the Clipwise MVP: Save & Process pipeline, Feed UI & actions, Corrections & learning, and Auth/polish/deploy. Test cases identify which require mocks (Apify, Gemini) vs real API calls, and flag gaps for board clarification.

***

## Test Execution Strategy

### Mocking vs Real Calls

| Component                  | MVP Testing Approach           | Rationale                                                            |
| -------------------------- | ------------------------------ | -------------------------------------------------------------------- |
| **Apify Actors**           | Mock with fixture data         | Apify rate limits, cost; fixture ensures reproducible video metadata |
| **Google Gemini**          | Mock with fixture responses    | Gemini API costs; test extraction logic independently of AI quality  |
| **Supabase Auth**          | Real against staging DB        | Auth must be tested end-to-end; use dedicated test user account      |
| **Supabase Postgres**      | Real against staging DB        | Database schema and query correctness require real tests             |
| **Google Maps Deep Links** | No-op test (verify URL format) | Deep links are client-side; no API calls needed                      |
| **Supabase Storage**       | Mock or staging storage        | Thumbnails/screenshots optional for MVP; mock is fine                |

***

## Phase 1: Save & Process Pipeline

### Test Suite 1.1 — URL Submission & Detection

#### Test 1.1.1: Valid TikTok URL Detection

* **Preconditions:** User is authenticated and on home page
* **Steps:**
  1. Paste a valid TikTok URL (e.g., `https://www.tiktok.com/@user/video/123456789`)
  2. Click "Save"
* **Expected Result:**
  * Platform detected as "tiktok"
  * SavedItem created with `status = "pending"`
  * Job queued for processing
  * User sees loading card with "Processing..." status
* **Mocking:** N/A (URL parsing is local logic)
* **Notes:** Use a fixture TikTok URL (never a real user's video)

#### Test 1.1.2: Valid Instagram URL Detection

* **Preconditions:** User is authenticated and on home page
* **Steps:**
  1. Paste a valid Instagram URL (e.g., `https://www.instagram.com/p/ABC123DEF/`)
  2. Click "Save"
* **Expected Result:**
  * Platform detected as "instagram"
  * SavedItem created with `status = "pending"`
* **Mocking:** N/A

#### Test 1.1.3: Unsupported URL Detection

* **Preconditions:** User is authenticated
* **Steps:**
  1. Paste a Twitter/YouTube/random URL
  2. Click "Save"
* **Expected Result:**
  * Error message: "Platform not supported in MVP. Supported: TikTok, Instagram"
  * No SavedItem created
* **Mocking:** N/A

#### Test 1.1.4: Malformed URL Submission

* **Preconditions:** User is authenticated
* **Steps:**
  1. Paste text that is not a valid URL (e.g., "hello world")
  2. Click "Save"
* **Expected Result:**
  * Error message: "Please enter a valid URL"
  * No SavedItem created
* **Mocking:** N/A

#### Test 1.1.5: Empty URL Field Submission

* **Preconditions:** User is authenticated
* **Steps:**
  1. Leave URL field empty
  2. Click "Save"
* **Expected Result:**
  * Error message: "URL is required"
* **Mocking:** N/A

***

### Test Suite 1.2 — Apify Scraping Integration

#### Test 1.2.1: Successful TikTok Scrape

* **Preconditions:**
  * URL submitted and queued
  * Job processor running
  * Apify mock returns fixture response
* **Steps:**
  1. Trigger background job processing (or wait for async queue)
  2. Verify Apify is called with correct URL and credentials
* **Expected Result:**
  * Raw metadata saved to `SavedItem.raw_content` (title, description, creator, duration, view count, etc.)
  * `status` updated to "processing"
* **Mocking:** **MOCK** Apify response with fixture JSON (name, description, metadata)
* **Notes:**
  * Fixture should include: title, description, creator name, view/like count, comment count, duration
  * Avoid actual Apify API call to save costs and ensure test reproducibility

#### Test 1.2.2: Successful Instagram Scrape

* **Preconditions:** Instagram URL queued; Apify mock ready
* **Steps:**
  1. Trigger background job
* **Expected Result:**
  * Raw metadata saved (caption, likes, comments, media type)
  * `status` updated to "processing"
* **Mocking:** **MOCK** Instagram fixture (caption, hashtags, likes)

#### Test 1.2.3: Apify Rate Limit / Failure Handling

* **Preconditions:** Job queued
* **Steps:**
  1. Simulate Apify returning rate-limit error (429)
* **Expected Result:**
  * Job retried (should have backoff strategy)
  * After max retries, `status` set to "failed"
  * User notified (error shown on card)
* **Mocking:** **MOCK** error response from Apify
* **Gaps:** *How many retries? What backoff strategy (linear, exponential)?*

#### Test 1.2.4: Missing or Invalid Apify Credentials

* **Preconditions:** Apify key is misconfigured or missing
* **Steps:**
  1. Trigger job processing
* **Expected Result:**
  * Job fails with clear error: "Scraping service misconfigured"
  * `status` set to "failed"
* **Mocking:** Simulate auth failure from Apify mock

***

### Test Suite 1.3 — Google Gemini Integration & Extraction

#### Test 1.3.1: Category Auto-Detection (Food Video)

* **Preconditions:**
  * Apify scrape complete; fixture contains food-related metadata (recipe, ingredients, cooking)
  * Gemini mock ready
* **Steps:**
  1. Trigger Gemini analysis on raw metadata
* **Expected Result:**
  * Category set to "food" or "recipe"
  * Extracted data populated with ingredients, cooking steps, or restaurant info
* **Mocking:** **MOCK** Gemini response with category and extraction
* **Fixture:** Metadata about a food video (e.g., "How to make pasta")
* **Notes:** Gemini call should only happen once per SavedItem (cache result)

#### Test 1.3.2: Category Auto-Detection (Fitness Video)

* **Preconditions:** Fixture contains workout-related metadata
* **Steps:**
  1. Trigger Gemini analysis
* **Expected Result:**
  * Category set to "fitness" or "workout"
  * Extracted data includes exercise name, sets/reps if mentioned, muscle groups
* **Mocking:** **MOCK** Gemini response

#### Test 1.3.3: Category Auto-Detection (How-To Video)

* **Preconditions:** Fixture contains instructional/tutorial metadata
* **Steps:**
  1. Trigger Gemini analysis
* **Expected Result:**
  * Category set to "how-to"
  * Extracted data includes step-by-step summary
* **Mocking:** **MOCK** Gemini response

#### Test 1.3.4: Category Auto-Detection (Places/Location)

* **Preconditions:** Fixture contains location/restaurant info
* **Steps:**
  1. Trigger Gemini analysis
* **Expected Result:**
  * Category set to "places"
  * Extracted data includes name, address, cuisine, "why visit"
* **Mocking:** **MOCK** Gemini response

#### Test 1.3.5: Fallback Category (Unmatched Content)

* **Preconditions:** Fixture doesn't clearly match any category
* **Steps:**
  1. Trigger Gemini analysis
* **Expected Result:**
  * Category set to "other"
  * Extracted data includes generic description
* **Mocking:** **MOCK** Gemini response with "other"

#### Test 1.3.6: Gemini API Error Handling

* **Preconditions:** Job queued; Gemini mock configured to fail
* **Steps:**
  1. Trigger Gemini analysis
  2. Simulate Gemini error (timeout, auth failure)
* **Expected Result:**
  * Job retried with backoff
  * After max retries, `status` set to "failed"
* **Mocking:** **MOCK** error from Gemini
* **Gaps:** *Same retry/backoff strategy as Apify?*

#### Test 1.3.7: Extraction Accuracy (Ingredient List)

* **Preconditions:** Fixture is a recipe video; Gemini mock returns structured ingredient list
* **Steps:**
  1. Trigger Gemini analysis
* **Expected Result:**
  * `extracted_data.ingredients` is a JSON array with: `[{name, quantity, unit}, ...]`
* **Mocking:** **MOCK** Gemini with well-formed ingredient list
* **Notes:** Test data structure, not AI accuracy (AI quality is out of scope for MVP testing)

***

### Test Suite 1.4 — Background Job Queue

#### Test 1.4.1: Job Queued and Processed in Order

* **Preconditions:** Multiple URLs submitted
* **Steps:**
  1. Submit 3 URLs in sequence
  2. Wait for job processor to run
* **Expected Result:**
  * All 3 jobs queued
  * Processed in FIFO order (or priority if implemented)
  * Each SavedItem reaches "done" status
* **Mocking:** Use fast mock responses (no real delays)

#### Test 1.4.2: Job Status Persisted

* **Preconditions:** Job in progress
* **Steps:**
  1. Restart application / refresh database
  2. Verify job state on restart
* **Expected Result:**
  * Job resumes from last checkpoint (not restarted from URL detection)
* **Mocking:** N/A (test database persistence)
* **Gaps:** *Is there checkpoint/resume logic, or full restart?*

#### Test 1.4.3: Concurrent Job Processing

* **Preconditions:** Job queue supports concurrency
* **Steps:**
  1. Submit 5 URLs
  2. Let multiple workers process (if implemented)
* **Expected Result:**
  * All jobs complete without conflict or duplication
* **Mocking:** Use fast mocks; verify no race conditions
* **Gaps:** *What's the concurrency limit? Single-threaded or multi-worker?*

***

### Test Suite 1.5 — End-to-End Phase 1 Flow

#### Test 1.5.1: Complete Save & Process Flow

* **Preconditions:** User authenticated
* **Steps:**
  1. Submit a TikTok URL about a recipe
  2. Wait for job to complete
  3. Verify SavedItem reaches "done" status
* **Expected Result:**
  * SavedItem has: category\="recipe", extracted\_data with ingredients, raw\_content from Apify
  * User sees card in feed (ready for Phase 2)
* **Mocking:** **MOCK** Apify scrape and Gemini extraction
* **Notes:** This is the primary MVP flow; must work reliably

#### Test 1.5.2: End-to-End with Processing Failure

* **Preconditions:** Job queued
* **Steps:**
  1. Submit URL
  2. Simulate Apify failure (rate limit, auth)
  3. Verify max retries exhausted
* **Expected Result:**
  * SavedItem status \= "failed"
  * Error message shown to user
  * User can retry or delete the item
* **Mocking:** Simulate Apify failure on first attempt, succeed on retry (if implemented)

***

## Phase 2: Display & Actions

### Test Suite 2.1 — Feed Display

#### Test 2.1.1: Feed Shows Saved Items

* **Preconditions:** User has 3 completed SavedItems with different categories
* **Steps:**
  1. Navigate to home/feed
* **Expected Result:**
  * All items displayed as cards
  * Cards show: title, category badge, action button
  * Sorted logically (newest first or by category)
* **Mocking:** N/A (use real DB with test data)

#### Test 2.1.2: Empty Feed State

* **Preconditions:** User has no SavedItems
* **Steps:**
  1. Navigate to home/feed
* **Expected Result:**
  * "No items yet" message displayed
  * Prompt to save first link
* **Mocking:** N/A

#### Test 2.1.3: In-Progress Items Show Loading State

* **Preconditions:** SavedItem with status\="processing"
* **Steps:**
  1. Navigate to feed
* **Expected Result:**
  * Card shows "Processing..." spinner or message
  * No action buttons available yet
* **Mocking:** N/A

#### Test 2.1.4: Failed Items Show Error State

* **Preconditions:** SavedItem with status\="failed"
* **Steps:**
  1. Navigate to feed
* **Expected Result:**
  * Card shows error message (reason if available)
  * Action button: "Retry" or "Dismiss"
* **Mocking:** N/A

***

### Test Suite 2.2 — Action Buttons (Category-Specific)

#### Test 2.2.1: "Save to Google Maps" Button (Places)

* **Preconditions:** SavedItem with category\="places" and extracted address
* **Steps:**
  1. Click "Save to Google Maps" button
* **Expected Result:**
  * Opens Google Maps URL: `https://maps.google.com/?q={address}`
  * User can save location
* **Mocking:** N/A (verify URL construction, not Google API)
* **Notes:** MVP uses deep link, not Maps API write access

#### Test 2.2.2: "Export Ingredients" Button (Recipes)

* **Preconditions:** SavedItem with category\="recipe" and ingredient list
* **Steps:**
  1. Click "Export Ingredients" button
* **Expected Result:**
  * Copies ingredients to clipboard in format: "- Ingredient 1\n- Ingredient 2\n..."
  * Show toast: "Copied to clipboard"
* **Mocking:** N/A (clipboard API)

#### Test 2.2.3: "Add to My Routine" Button (Fitness)

* **Preconditions:** SavedItem with category\="fitness"
* **Steps:**
  1. Click "Add to My Routine" button
* **Expected Result:**
  * Adds exercises to a "My Routine" list (stored in DB)
  * Show toast: "Added to routine"
  * Exercise appears in routine view
* **Mocking:** N/A

#### Test 2.2.4: "Save as Guide" Button (How-Tos)

* **Preconditions:** SavedItem with category\="how-to"
* **Steps:**
  1. Click "Save as Guide" button
* **Expected Result:**
  * Saves clean, readable summary to a "Guides" collection
  * Show toast: "Saved as guide"
  * Guide accessible from guides view
* **Mocking:** N/A

#### Test 2.2.5: Default Action Button (Other)

* **Preconditions:** SavedItem with category\="other"
* **Steps:**
  1. View card
* **Expected Result:**
  * Shows generic button, e.g., "View Details"
  * Opens a modal with raw\_content and extracted\_data
* **Mocking:** N/A

***

### Test Suite 2.3 — Category Override

#### Test 2.3.1: Manual Category Change

* **Preconditions:** SavedItem with auto-detected category
* **Steps:**
  1. Click card to open details
  2. Change category from dropdown (e.g., from "recipe" to "fitness")
  3. Save
* **Expected Result:**
  * Category updated in DB
  * Card updates to show new category badge
  * Action buttons change based on new category
* **Mocking:** N/A

#### Test 2.3.2: Category Override Affects Action Buttons

* **Preconditions:** SavedItem was "recipe", changed to "places"
* **Steps:**
  1. Change category to "places"
  2. Verify card action button changed
* **Expected Result:**
  * Old button ("Export Ingredients") gone
  * New button ("Save to Google Maps") appears
* **Mocking:** N/A

***

### Test Suite 2.4 — Search & Filter

#### Test 2.4.1: Filter by Category

* **Preconditions:** User has items in multiple categories
* **Steps:**
  1. Click filter dropdown
  2. Select "Recipe"
  3. Observe feed
* **Expected Result:**
  * Only recipe items shown
  * Other categories hidden
* **Mocking:** N/A

#### Test 2.4.2: Search by Title/Content

* **Preconditions:** User has items with different titles
* **Steps:**
  1. Enter "pasta" in search box
* **Expected Result:**
  * Only items with "pasta" in title or extracted data shown
  * Case-insensitive
* **Mocking:** N/A

#### Test 2.4.3: Clear Filter

* **Preconditions:** Filter or search active
* **Steps:**
  1. Click "Clear" or close search
* **Expected Result:**
  * All items displayed again
* **Mocking:** N/A

***

## Phase 3: User Corrections & Learning

### Test Suite 3.1 — Correction Flow

#### Test 3.1.1: Initiate Correction

* **Preconditions:** SavedItem displayed with auto-detected category/data
* **Steps:**
  1. Click "That's wrong" or error icon on card
  2. Modal opens for correction input
* **Expected Result:**
  * Modal shows current extracted data
  * User can edit fields (category, ingredients, steps, etc.)
  * "Save correction" button available
* **Mocking:** N/A

#### Test 3.1.2: Submit Correction

* **Preconditions:** Correction modal open
* **Steps:**
  1. Modify extracted data (e.g., change "pasta" to "fettuccine")
  2. Click "Save correction"
* **Expected Result:**
  * Correction saved to `SavedItem.user_correction`
  * Card updates with corrected data
  * Toast: "Thanks! We'll learn from this."
  * Correction logged for future Gemini prompts
* **Mocking:** N/A

#### Test 3.1.3: Category Correction

* **Preconditions:** Item misclassified
* **Steps:**
  1. Open correction flow
  2. Change category from "fitness" to "recipe"
  3. Submit
* **Expected Result:**
  * Category updated
  * Action button changes to match new category
  * Correction recorded
* **Mocking:** N/A

***

### Test Suite 3.2 — Dashboard & Analytics

#### Test 3.2.1: Dashboard Displays Summary Stats

* **Preconditions:** User has multiple saved items
* **Steps:**
  1. Navigate to dashboard
* **Expected Result:**
  * Shows counts by category (e.g., "5 recipes, 3 workouts, 2 places")
  * Shows total items saved
  * Shows "recent saves" list
* **Mocking:** N/A (use test data in DB)

#### Test 3.2.2: Dashboard Filters by Date Range

* **Preconditions:** Dashboard loaded
* **Steps:**
  1. Select "This week"
* **Expected Result:**
  * Counts update to show only this week's saves
* **Mocking:** N/A

***

## Phase 4: Auth, Polish & Deploy

### Test Suite 4.1 — Authentication

#### Test 4.1.1: Email Magic Link Sign-Up

* **Preconditions:** New user
* **Steps:**
  1. Enter email and click "Sign up with magic link"
  2. Check email (or use test email inbox)
  3. Click magic link
* **Expected Result:**
  * User logged in and redirected to home
  * Session created
* **Mocking:** N/A (real Supabase Auth in staging)
* **Notes:** Use dedicated test email account for testing

#### Test 4.1.2: Magic Link Expiration

* **Preconditions:** Magic link generated
* **Steps:**
  1. Wait past expiration time (default \~24h)
  2. Click expired link
* **Expected Result:**
  * Error: "Link expired. Request a new one."
* **Mocking:** Can mock if Supabase behavior needs acceleration
* **Gaps:** *What's the magic link TTL? Is it configurable?*

#### Test 4.1.3: Google OAuth Sign-In

* **Preconditions:** Google OAuth configured in Supabase
* **Steps:**
  1. Click "Sign in with Google"
  2. Complete Google consent flow
* **Expected Result:**
  * User account created in Supabase
  * Logged in and redirected
* **Mocking:** Can use test Google account
* **Gaps:** *Is Google OAuth required for MVP or optional?*

#### Test 4.1.4: Session Persistence

* **Preconditions:** User logged in
* **Steps:**
  1. Close browser tab
  2. Open app again
* **Expected Result:**
  * User still logged in (session persisted to localStorage/cookie)
* **Mocking:** N/A

#### Test 4.1.5: Logout

* **Preconditions:** User logged in
* **Steps:**
  1. Click logout button
* **Expected Result:**
  * User session cleared
  * Redirected to login page
  * Cannot access home without re-authenticating
* **Mocking:** N/A

***

### Test Suite 4.2 — Mobile Responsiveness

#### Test 4.2.1: Layout on Mobile (iPhone 375px)

* **Preconditions:** App deployed
* **Steps:**
  1. View app on iPhone or 375px viewport
  2. Verify all UI elements fit and scroll properly
* **Expected Result:**
  * No horizontal scrolling
  * Cards stack vertically
  * Buttons are touch-sized (48px+)
* **Mocking:** N/A (use responsive testing tool / device)

#### Test 4.2.2: Layout on Tablet (iPad 768px)

* **Preconditions:** App deployed
* **Steps:**
  1. View on iPad or 768px viewport
* **Expected Result:**
  * 2-column or flexible layout if appropriate
  * No layout breaks
* **Mocking:** N/A

#### Test 4.2.3: Touch Interactions Work

* **Preconditions:** On mobile device
* **Steps:**
  1. Tap buttons, links, form fields
  2. Swipe to dismiss cards (if implemented)
* **Expected Result:**
  * All interactions respond to touch
  * No mouse-specific hover states blocking interaction
* **Mocking:** N/A (real device test)

***

### Test Suite 4.3 — Error Handling & Retries

#### Test 4.3.1: Network Timeout Handling

* **Preconditions:** Network unstable or timeout simulated
* **Steps:**
  1. Submit a URL and trigger network timeout
  2. Observe behavior
* **Expected Result:**
  * Error message displayed: "Network error. Retrying..."
  * Automatic retry after backoff
  * If persistent, show "Retry" button
* **Mocking:** Mock network errors in job queue

#### Test 4.3.2: Database Connection Error

* **Preconditions:** Supabase temporarily unavailable
* **Steps:**
  1. Attempt to fetch feed or save item
* **Expected Result:**
  * Graceful error: "Service temporarily unavailable. Please try again."
  * App doesn't crash
* **Mocking:** Mock Supabase connection error

#### Test 4.3.3: Gemini or Apify Service Degraded

* **Preconditions:** External service returns 500 or timeout
* **Steps:**
  1. Trigger background job
* **Expected Result:**
  * Job retries with exponential backoff
  * After max retries, status \= "failed"
  * User notified
* **Mocking:** Mock service errors

***

### Test Suite 4.4 — Performance

#### Test 4.4.1: Feed Load Time

* **Preconditions:** User has 50 saved items
* **Steps:**
  1. Measure time from app load to feed display
* **Expected Result:**
  * Initial load \< 3 seconds
  * Pagination or lazy loading implemented if needed
* **Mocking:** Use performance profiler (Lighthouse, WebPageTest)
* **Gaps:** *What's the SLA for feed load time?*

#### Test 4.4.2: Card Action Button Response

* **Preconditions:** On feed
* **Steps:**
  1. Click action button (e.g., "Save to Google Maps")
  2. Measure response time
* **Expected Result:**
  * \< 500ms to respond (UI feels snappy)
* **Mocking:** N/A

***

## Critical Gaps Requiring Board Clarification

These gaps affect test scope, coverage, or acceptance criteria:

1. **Retry & Backoff Strategy**
   * How many retries for Apify / Gemini failures?
   * Linear backoff, exponential, or fixed delay?
   * *Impacts: Test Suite 1.2.3, 1.3.6, 4.3.1–4.3.3*
2. **Job Queue Concurrency**
   * Single-threaded or multi-worker processing?
   * Max concurrent jobs?
   * *Impacts: Test Suite 1.4.3*
3. **Job State Checkpointing**
   * If a job is interrupted mid-processing, does it resume or restart?
   * What if Gemini completed but Supabase write failed?
   * *Impacts: Test Suite 1.4.2*
4. **Google OAuth in MVP**
   * Is Google OAuth required for MVP, or is email magic link sufficient?
   * *Impacts: Test Suite 4.1.3*
5. **Magic Link TTL**
   * Default Supabase is \~24h; is this acceptable?
   * Should it be configurable per environment?
   * *Impacts: Test Suite 4.1.2*
6. **Performance SLAs**
   * Feed load time? API response time?
   * What constitutes acceptable performance?
   * *Impacts: Test Suite 4.4*
7. **Multi-User in MVP**
   * Is data isolated per user, or can users see each other's saves?
   * Are corrections scoped to individual user or shared globally?
   * *Impacts: All test suites (data isolation assumptions)*
8. **Video Download & Storage**
   * Does MVP download and store video files, or just metadata?
   * If stored, where? How long retained?
   * *Impacts: Test Suite 1.2 (Apify output scope)*

***

## Testing Resources & Tools

| Task                  | Tool                                        | Notes                                       |
| --------------------- | ------------------------------------------- | ------------------------------------------- |
| API mocking           | **Vitest/MSW**                              | Mock Apify, Gemini, Supabase                |
| Database testing      | **Supabase staging** + **pgboss** test mode | Real Postgres for integration tests         |
| Mobile responsiveness | **Chrome DevTools**, **BrowserStack**       | Test on real devices if budget allows       |
| Performance           | **Lighthouse**, **WebPageTest**             | Measure load time, Largest Contentful Paint |
| E2E testing           | **Playwright** or **Cypress**               | Full flow: auth → save → process → action   |
| Manual testing        | **Test device (iOS/Android)**               | Magic link email, deep links, touch UX      |

***

## Test Execution Plan

### Phase 1 Testing (Weeks 1–3)

* Test Suites 1.1–1.5 (URL detection, Apify, Gemini, job queue, end-to-end)
* Focus on happy path + error cases
* Use mocks for Apify/Gemini; real Supabase for DB
* Block deployment if 1.5.1 (end-to-end save & process) fails

### Phase 2 Testing (Weeks 3–4)

* Test Suites 2.1–2.4 (feed display, action buttons, search/filter)
* Depends on Phase 1 completion
* Test action button URLs (Google Maps deep link format)
* Block deployment if feed is not rendering or buttons are non-functional

### Phase 3 Testing (Week 5)

* Test Suites 3.1–3.2 (corrections, dashboard)
* Depends on Phase 2
* Verify corrections are logged and used in future prompts (or logged for future use)

### Phase 4 Testing (Weeks 5–6)

* Test Suites 4.1–4.4 (auth, mobile, error handling, performance)
* Auth must be tested end-to-end with real Supabase
* Mobile testing on real devices (iOS 15+, Android 11+)
* Performance benchmarking before production deployment

***

## Acceptance Criteria

The Clipwise MVP is ready for production when:

1. ✅ **Phase 1 end-to-end test passes:** Save → Apify scrape → Gemini categorization → Done
2. ✅ **Phase 2 UI functional:** Feed displays items, action buttons work and open correct links/modals
3. ✅ **Phase 3 corrections logged:** User corrections saved and retrievable for auditing
4. ✅ **Phase 4 critical paths:**
   * Auth: Users can sign up via magic link and stay logged in
   * Mobile: App is usable on iPhone and Android (responsive layout)
   * Error handling: Failed jobs gracefully notify user and allow retry
5. ✅ **Performance:** Feed loads in \< 3 seconds for 50 items; action buttons respond in \< 500ms
6. ✅ **Security:** Auth tokens used securely (no localStorage for sensitive data); XSS/CSRF protections in place
7. ✅ **Data isolation:** Each user sees only their own saves; corrections are user-scoped (or global if by design)

***

## Sign-Off

* **QA Agent:** 446d28a4-a1d4-46c5-8c17-924cb625bdab
* **Date:** March 29, 2026
* **Status:** Ready for development team review and board clarification on gaps
