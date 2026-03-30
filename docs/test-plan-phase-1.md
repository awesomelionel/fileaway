# Phase 1 Test Plan: fileaway.app Save & Process

## Overview

This test plan covers all integration and end-to-end testing for Phase 1 (Save & Process pipeline). Phase 1 focuses on URL submission, platform detection, content scraping via Apify, AI processing via Gemini, and status tracking.

**Scope:** Link submission → Platform detection → Apify scraping → Gemini processing → Status tracking

**Testing Window:** Week 1 (implementation), Weeks 2-3 (validation)

**Success Criteria:** All test suites pass with >90% coverage on core paths; no production blockers identified

***

## Test Execution Strategy

### Environment Tiers

| Environment        | Purpose                                     | Dependencies                                            |
| ------------------ | ------------------------------------------- | ------------------------------------------------------- |
| **Local Dev**      | Unit/integration tests during development   | Local Supabase, mocked Apify, mocked Gemini             |
| **QA Environment** | Full integration tests with shared fixtures | Local Supabase, mocked Apify, mocked Gemini             |
| **Staging**        | Pre-production with real API calls (capped) | Actual Supabase, capped Apify quota, Gemini dev account |

### Test Pyramid

```
E2E Tests (10%)         — Full user flow
Integration Tests (60%) — Component integration + mocks
Unit Tests (30%)        — Handlers, schema validation
```

***

## Test Categories & Scaffolding

### 1. URL Validation & Platform Detection

**Objective:** Verify URL parsing, platform detection, and early rejection of invalid URLs.

#### Test Suite: `tests/integration/url-validation.test.ts`

```typescript
// Test categories
describe("URL Validation & Platform Detection", () => {
  describe("TikTok URLs", () => {
    test("Valid TikTok URLs are detected correctly", () => {
      // Test URLs: see Test Data Inventory
      const urls = [
        "https://www.tiktok.com/@creator/video/1234567890",
        "https://vm.tiktok.com/abcd1234",
        "https://vt.tiktok.com/abcd1234"
      ];
      urls.forEach(url => {
        expect(detectPlatform(url)).toBe("tiktok");
      });
    });

    test("Invalid TikTok URLs are rejected", () => {
      const invalid = [
        "https://tiktok.com/creator",
        "https://www.tiktok.com/invalid",
        ""
      ];
      invalid.forEach(url => {
        expect(() => validateAndParseTikTok(url)).toThrow();
      });
    });
  });

  describe("Instagram URLs", () => {
    test("Valid Instagram post/reel URLs are detected", () => {
      const urls = [
        "https://www.instagram.com/p/AbC1De2FgH/",
        "https://www.instagram.com/reel/AbC1De2FgH/",
        "https://instagram.com/p/AbC1De2FgH/"
      ];
      urls.forEach(url => {
        expect(detectPlatform(url)).toBe("instagram");
      });
    });

    test("Instagram profile/story URLs are rejected", () => {
      const invalid = [
        "https://www.instagram.com/username/",
        "https://www.instagram.com/stories/username/"
      ];
      invalid.forEach(url => {
        expect(() => validateAndParseInstagram(url)).toThrow();
      });
    });
  });

  describe("Edge cases", () => {
    test("URLs with tracking params are normalized", () => {
      const url = "https://www.tiktok.com/@creator/video/1234?utm_source=share";
      const normalized = normalizeUrl(url);
      expect(normalized).not.toContain("utm_");
    });

    test("Null/empty/malformed URLs are rejected", () => {
      expect(() => validateUrl(null)).toThrow();
      expect(() => validateUrl("")).toThrow();
      expect(() => validateUrl("not a url")).toThrow();
    });
  });
});
```

**Mock Strategy:** No mocking needed — pure URL parsing.

***

### 2. Apify Scraping Integration

**Objective:** Verify scraping triggers, mock API calls, fixture handling, and error recovery.

#### Test Suite: `tests/integration/apify-scraping.test.ts`

```typescript
describe("Apify Scraping Integration", () => {
  beforeEach(() => {
    // Setup mock Apify client
    apifyMock.reset();
  });

  describe("TikTok scraping", () => {
    test("Enqueues scraping job with correct parameters", async () => {
      const url = "https://www.tiktok.com/@creator/video/1234567890";
      const jobId = await enqueueScrapeJob({ url, platform: "tiktok" });
      
      expect(apifyMock.call).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: TIKTOK_ACTOR_ID,
          input: expect.objectContaining({
            startUrls: [{ url }],
            resultsFormat: "json"
          })
        })
      );
      expect(jobId).toBeDefined();
    });

    test("Parses TikTok fixture response correctly", async () => {
      // Load fixture from `tests/fixtures/tiktok-response.json`
      const rawResponse = loadFixture("tiktok-response.json");
      const parsed = parseTikTokResponse(rawResponse);
      
      expect(parsed).toMatchObject({
        videoId: expect.any(String),
        title: expect.any(String),
        author: expect.any(String),
        views: expect.any(Number),
        likes: expect.any(Number),
        description: expect.any(String),
        downloadUrl: expect.any(String),
        thumbnailUrl: expect.any(String)
      });
    });
  });

  describe("Instagram scraping", () => {
    test("Enqueues scraping job with correct parameters", async () => {
      const url = "https://www.instagram.com/p/AbC1De2FgH/";
      const jobId = await enqueueScrapeJob({ url, platform: "instagram" });
      
      expect(apifyMock.call).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: INSTAGRAM_ACTOR_ID,
          input: expect.objectContaining({
            startUrls: [{ url }]
          })
        })
      );
    });

    test("Parses Instagram fixture response correctly", async () => {
      const rawResponse = loadFixture("instagram-response.json");
      const parsed = parseInstagramResponse(rawResponse);
      
      expect(parsed).toMatchObject({
        postId: expect.any(String),
        caption: expect.any(String),
        author: expect.any(String),
        likes: expect.any(Number),
        comments: expect.any(Number),
        mediaUrls: expect.any(Array),
        thumbnailUrl: expect.any(String)
      });
    });
  });

  describe("Error handling", () => {
    test("Retries on rate limit", async () => {
      apifyMock.fails({ code: "RATE_LIMIT", retryAfter: 60 });
      
      const promise = enqueueScrapeJob({ url: testUrl, platform: "tiktok" });
      // Expect exponential backoff retry
      expect(apifyMock.call).toHaveBeenCalledTimes(1);
      
      // Simulate retry after backoff
      jest.useFakeTimers();
      jest.advanceTimersByTime(61000);
      
      apifyMock.succeeds();
      const result = await promise;
      expect(result).toBeDefined();
    });

    test("Fails gracefully on platform blocks", async () => {
      apifyMock.fails({ code: "BLOCKED" });
      
      await expect(enqueueScrapeJob({ url: testUrl, platform: "tiktok" }))
        .rejects.toThrow("Platform appears to be blocking requests");
    });
  });
});
```

**Mock Strategy:**

* **Apify Client:** Mock with jest.mock() or MSW
* **Fixtures:** Store real Apify responses in `tests/fixtures/` for realistic parsing tests
* **Network:** No real API calls; all responses from fixtures

***

### 3. Gemini API Integration

**Objective:** Verify AI processing, categorization accuracy, schema validation, and cost control.

#### Test Suite: `tests/integration/gemini-processing.test.ts`

```typescript
describe("Gemini API Integration", () => {
  beforeEach(() => {
    geminiMock.reset();
  });

  describe("Categorization", () => {
    test("Correctly categorizes food/restaurant content", async () => {
      const scrapedContent = loadFixture("tiktok-restaurant-video.json");
      const category = await categorizeContent(scrapedContent);
      
      expect(category).toBe("food");
      expect(geminiMock.call).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gemini-1.5-flash",
          systemPrompt: expect.stringContaining("categorize")
        })
      );
    });

    test("Correctly categorizes fitness content", async () => {
      const scrapedContent = loadFixture("tiktok-workout-video.json");
      const category = await categorizeContent(scrapedContent);
      
      expect(category).toBe("fitness");
    });

    test("Handles ambiguous content gracefully", async () => {
      const scrapedContent = loadFixture("tiktok-unclear-video.json");
      const category = await categorizeContent(scrapedContent);
      
      expect(["food", "fitness", "how-to", "other"]).toContain(category);
    });
  });

  describe("Structured Extraction", () => {
    test("Extracts restaurant details for food content", async () => {
      const scrapedContent = loadFixture("tiktok-restaurant-video.json");
      const extracted = await extractStructuredData(scrapedContent, "food");
      
      expect(extracted).toMatchObject({
        name: expect.any(String),
        cuisine: expect.any(String),
        address: expect.any(String),
        whyVisit: expect.any(String)
      });
    });

    test("Extracts workout details for fitness content", async () => {
      const scrapedContent = loadFixture("tiktok-workout-video.json");
      const extracted = await extractStructuredData(scrapedContent, "fitness");
      
      expect(extracted).toMatchObject({
        exercises: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            sets: expect.any(Number),
            reps: expect.any(Number)
          })
        ]),
        muscleGroups: expect.any(Array)
      });
    });

    test("Extracts recipe ingredients and steps", async () => {
      const scrapedContent = loadFixture("tiktok-recipe-video.json");
      const extracted = await extractStructuredData(scrapedContent, "recipe");
      
      expect(extracted).toMatchObject({
        ingredients: expect.arrayContaining([
          expect.objectContaining({
            item: expect.any(String),
            quantity: expect.any(String)
          })
        ]),
        steps: expect.any(Array)
      });
    });

    test("Validates extracted schema matches TypeScript interface", async () => {
      const scrapedContent = loadFixture("tiktok-restaurant-video.json");
      const extracted = await extractStructuredData(scrapedContent, "food");
      
      // Validate against schema
      const validator = buildValidator(foodExtractionSchema);
      expect(() => validator(extracted)).not.toThrow();
    });
  });

  describe("Cost Control", () => {
    test("Uses Flash model for categorization (cheaper)", async () => {
      await categorizeContent(testContent);
      
      expect(geminiMock.call).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gemini-1.5-flash"
        })
      );
    });

    test("Uses Pro model only for complex extraction", async () => {
      const complexContent = loadFixture("tiktok-complex-video.json");
      await extractStructuredData(complexContent, "video-analysis");
      
      // Pro model used for complex extraction
      expect(geminiMock.call).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gemini-1.5-pro"
        })
      );
    });
  });

  describe("Error handling", () => {
    test("Retries on API quota exceeded", async () => {
      geminiMock.fails({ code: "RESOURCE_EXHAUSTED", retryAfter: 30 });
      
      jest.useFakeTimers();
      const promise = categorizeContent(testContent);
      
      jest.advanceTimersByTime(35000);
      geminiMock.succeeds();
      
      const result = await promise;
      expect(result).toBeDefined();
    });
  });
});
```

**Mock Strategy:**

* **Gemini Client:** Mock with jest.mock() or use Google Cloud Testing library
* **Fixtures:** Store real Gemini responses in `tests/fixtures/` for realistic extraction tests
* **Cost Tracking:** Log all API calls with model/cost metadata for budget monitoring

***

### 4. Background Job Queue

**Objective:** Verify job enqueuing, processing, status updates, and error states.

#### Test Suite: `tests/integration/job-queue.test.ts`

```typescript
describe("Background Job Queue", () => {
  beforeEach(async () => {
    // Start test queue (pgboss or local equivalent)
    await queue.start();
  });

  afterEach(async () => {
    await queue.stop();
  });

  describe("Job Enqueuing", () => {
    test("Creates SavedItem and enqueues processing job", async () => {
      const url = "https://www.tiktok.com/@creator/video/1234567890";
      const savedItem = await createSavedItem({ url, userId: testUser.id });
      
      expect(savedItem).toMatchObject({
        id: expect.any(String),
        status: "pending",
        sourceUrl: url
      });
      
      // Job should be enqueued
      const job = await queue.getJob(savedItem.id);
      expect(job).toBeDefined();
    });
  });

  describe("Job Processing", () => {
    test("Transitions from pending → processing → done", async () => {
      const url = "https://www.tiktok.com/@creator/video/1234567890";
      const savedItem = await createSavedItem({ url, userId: testUser.id });
      
      // Status should be "pending"
      let item = await getSavedItem(savedItem.id);
      expect(item.status).toBe("pending");
      
      // Process job
      await queue.process(savedItem.id);
      
      // Status should be "processing"
      item = await getSavedItem(savedItem.id);
      expect(item.status).toBe("processing");
      
      // After processing completes, status should be "done"
      await waitForJob(savedItem.id, { timeout: 5000 });
      item = await getSavedItem(savedItem.id);
      expect(item.status).toBe("done");
      expect(item.extractedData).toBeDefined();
    });

    test("Handles job failures and transitions to failed state", async () => {
      apifyMock.fails({ code: "BLOCKED" });
      
      const url = "https://www.tiktok.com/@creator/video/invalid";
      const savedItem = await createSavedItem({ url, userId: testUser.id });
      
      await queue.process(savedItem.id);
      await waitForJob(savedItem.id, { timeout: 5000 });
      
      const item = await getSavedItem(savedItem.id);
      expect(item.status).toBe("failed");
      expect(item.errorMessage).toContain("blocked");
    });

    test("Retries failed jobs up to max attempts", async () => {
      let callCount = 0;
      apifyMock.fails({ code: "TIMEOUT" }, () => {
        callCount++;
        if (callCount < 3) {
          throw new Error("Timeout");
        }
      });
      
      const url = "https://www.tiktok.com/@creator/video/1234567890";
      const savedItem = await createSavedItem({ url, userId: testUser.id });
      
      await queue.process(savedItem.id, { maxRetries: 3 });
      await waitForJob(savedItem.id, { timeout: 10000 });
      
      const item = await getSavedItem(savedItem.id);
      expect(item.status).toBe("done");
      expect(callCount).toBe(3);
    });
  });

  describe("Concurrency", () => {
    test("Processes multiple jobs concurrently without data corruption", async () => {
      const urls = [
        "https://www.tiktok.com/@creator/video/1111",
        "https://www.tiktok.com/@creator/video/2222",
        "https://www.tiktok.com/@creator/video/3333"
      ];
      
      const items = await Promise.all(
        urls.map(url => createSavedItem({ url, userId: testUser.id }))
      );
      
      await Promise.all(
        items.map(item => queue.process(item.id))
      );
      
      const processed = await Promise.all(
        items.map(item => waitForJob(item.id, { timeout: 5000 }))
      );
      
      processed.forEach((item, i) => {
        expect(item.status).toBe("done");
        expect(item.sourceUrl).toBe(urls[i]);
        expect(item.extractedData).toBeDefined();
      });
    });
  });
});
```

**Mock Strategy:**

* **Queue:** Use local pgboss test harness
* **Database:** Use Supabase local instance for state tracking
* **Apify/Gemini:** Mocked as above

***

### 5. State Machine & Status Transitions

**Objective:** Verify correct status flow and prevent invalid transitions.

#### Test Suite: `tests/integration/state-machine.test.ts`

```typescript
describe("SavedItem Status State Machine", () => {
  test("Valid status transitions", async () => {
    const item = await createSavedItem({ url: testUrl, userId: testUser.id });
    
    expect(item.status).toBe("pending");
    
    await item.setStatus("processing");
    expect(item.status).toBe("processing");
    
    await item.setStatus("done");
    expect(item.status).toBe("done");
  });

  test("Prevents invalid transitions", async () => {
    const item = await createSavedItem({ url: testUrl, userId: testUser.id });
    
    // Cannot go from pending directly to done (must go through processing)
    await expect(item.setStatus("done")).rejects.toThrow(
      "Invalid transition from pending to done"
    );
  });

  test("Allows retry from failed state", async () => {
    const item = await createSavedItem({ url: testUrl, userId: testUser.id });
    
    await item.setStatus("processing");
    await item.setStatus("failed");
    
    // Should allow retry back to pending
    await expect(item.setStatus("pending")).resolves.toBeDefined();
  });
});
```

***

## Test Data Inventory

Store all test URLs and fixtures in `tests/fixtures/`

### TikTok URLs

```json
{
  "valid": [
    {
      "url": "https://www.tiktok.com/@creator_name/video/1234567890123456789",
      "category": "food",
      "description": "Restaurant review / food content",
      "fixture": "tiktok-restaurant-video.json"
    },
    {
      "url": "https://vm.tiktok.com/ZME1a2bcD/",
      "category": "fitness",
      "description": "Workout routine",
      "fixture": "tiktok-workout-video.json"
    },
    {
      "url": "https://www.tiktok.com/@creator/video/1111111111111111111",
      "category": "recipe",
      "description": "Cooking recipe",
      "fixture": "tiktok-recipe-video.json"
    },
    {
      "url": "https://www.tiktok.com/@creator/video/2222222222222222222",
      "category": "how-to",
      "description": "DIY / step-by-step guide",
      "fixture": "tiktok-howto-video.json"
    }
  ],
  "invalid": [
    "https://www.tiktok.com/@creator",
    "https://www.tiktok.com/discover/xyz",
    "https://tiktok.com",
    "",
    "not a url"
  ]
}
```

### Instagram URLs

```json
{
  "valid": [
    {
      "url": "https://www.instagram.com/p/AbC1De2FgH/",
      "category": "food",
      "description": "Restaurant post",
      "fixture": "instagram-restaurant-post.json"
    },
    {
      "url": "https://www.instagram.com/reel/AbC1De2FgH/",
      "category": "fitness",
      "description": "Fitness reel",
      "fixture": "instagram-fitness-reel.json"
    }
  ],
  "invalid": [
    "https://www.instagram.com/username/",
    "https://www.instagram.com/stories/username/",
    "https://www.instagram.com/explore/tags/food/"
  ]
}
```

***

## QA Environment Setup

### Local QA Environment (Docker)

**File: `docker-compose.test.yml`**

```yaml
version: "3.9"
services:
  supabase:
    image: supabase/postgres:15-latest
    environment:
      POSTGRES_PASSWORD: testpass
      POSTGRES_DB: fileaway_test
    ports:
      - "5432:5432"
    volumes:
      - ./tests/db/schema.sql:/docker-entrypoint-initdb.d/00-schema.sql

  pgboss:
    image: pgboss/pgboss:latest
    depends_on:
      - supabase
    environment:
      DB_HOST: supabase
      DB_PORT: 5432
      DB_NAME: fileaway_test
      DB_USER: postgres
      DB_PASSWORD: testpass
    ports:
      - "5433:5433"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

**Setup Script: `tests/setup-qa-env.sh`**

```bash
#!/bin/bash

# Spin up local Supabase + pgboss + Redis
docker-compose -f docker-compose.test.yml up -d

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 10

# Apply test database schema
psql -h localhost -U postgres -d fileaway_test -a -f tests/db/schema.sql

# Create test user
psql -h localhost -U postgres -d fileaway_test -c "INSERT INTO users (id, email) VALUES (test-user-123, test@fileaway.app);"

echo "QA environment ready!"
echo "Supabase: localhost:5432"
echo "pgboss: localhost:5433"
echo "Redis: localhost:6379"
```

### Running Tests

**Local dev test run:**

```bash
npm run test:integration
```

**QA environment test run:**

```bash
bash tests/setup-qa-env.sh
npm run test:qa
```

***

## Failure Mode Test Cases

### Network & API Failures

| Scenario                 | Test Case           | Expected Behavior                                               |
| ------------------------ | ------------------- | --------------------------------------------------------------- |
| Apify timeout on scrape  | Mock 30s delay      | Job retries 3x, then transitions to `failed` with error message |
| Gemini API down          | Mock 500 error      | Job retries with exponential backoff, eventually marks `failed` |
| Supabase connection lost | Mock db disconnect  | Job queues but processing waits; no data corruption             |
| Rate limit from platform | Mock 429 from Apify | Retry with backoff; respect Retry-After header                  |

### Content Failures

| Scenario               | Test Case                   | Expected Behavior                                              |
| ---------------------- | --------------------------- | -------------------------------------------------------------- |
| Deleted post           | Mock empty Apify response   | Item status → `failed`, error \= "Content no longer available" |
| Private account        | Mock auth-required response | Item status → `failed`, error \= "Content is private"          |
| Unsupported media type | Mock PDF/doc URL            | Detect in URL validation, reject before queueing               |
| Malformed URL          | Test with `normalizeUrl()`  | Normalize if possible, reject if not                           |

### Processing Failures

| Scenario                   | Test Case                      | Expected Behavior                                 |
| -------------------------- | ------------------------------ | ------------------------------------------------- |
| AI cannot categorize       | Mock ambiguous Gemini response | Fallback to "other" category; allow user override |
| Extraction schema mismatch | Mock incomplete Gemini output  | Store partial data; flag for manual review        |
| Large video (>500MB)       | Mock Apify with large file     | Skip download; capture metadata only; warn in UI  |

### Database Failures

| Scenario                         | Test Case                  | Expected Behavior                                              |
| -------------------------------- | -------------------------- | -------------------------------------------------------------- |
| Duplicate URL from same user     | Insert same URL twice      | Second save returns existing SavedItem or creates new revision |
| Concurrent saves of same URL     | Race condition test        | One succeeds, other gets conflict; no duplicate processing     |
| SavedItem deleted mid-processing | Delete item while in queue | Job gracefully handles missing item; logs error                |

***

## Coverage Goals

**Target:** 85% line coverage for Phase 1 critical path

```
URL Validation:        95% (pure logic, easy to test)
Apify Integration:     80% (heavily mocked)
Gemini Integration:    80% (heavily mocked)
Job Queue:             85% (pgboss test harness)
Status Machine:        95% (pure state logic)
API Handlers:          75% (integration dependent)
```

***

## Test Execution Timeline

| Week       | Milestone                                                           |
| ---------- | ------------------------------------------------------------------- |
| Week 1     | Engineer implements Phase 1 features + QA provides test scaffolding |
| Week 1 End | Run unit tests locally; aim for 70% passing                         |
| Week 2     | Integration tests run against QA env; 85%+ passing                  |
| Week 3     | Full E2E tests on staging; final regression pass                    |

***

## Blockers & Dependencies

* **Need Apify API keys:** To create realistic fixtures from actual scrape responses
* **Need Gemini API keys:** To capture real categorization & extraction outputs
* **Need Next.js handlers:** API routes must be implemented before integration tests run
* **Need database schema:** Supabase migrations must be applied for test setup

***

## Success Criteria

✅ All unit tests pass locally
✅ All integration tests pass on QA env
✅ >85% code coverage on Phase 1 handlers
✅ No flaky tests (100% deterministic)
✅ Zero production blockers identified before Week 3
✅ Engineer can pick up test implementation from this plan on Week 1 with minimal clarification
