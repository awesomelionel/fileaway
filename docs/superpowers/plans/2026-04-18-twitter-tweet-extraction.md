# Twitter/X Tweet Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract structured data from a single X/Twitter tweet URL using Apify's tweet scraper, following the same pipeline pattern as TikTok and Instagram.

**Architecture:** Add `scrapeTwitter` to `convex/processUrl.ts` as a new case in the existing `scrapeUrl` switch — same pattern as `scrapeTikTok`/`scrapeInstagram`. Apify calls the `apidojo/twitter-scraper-lite` actor, returns tweet text + author + media + engagement stats, which flows into the existing Gemini categorise → extract → persist pipeline unchanged.

**Tech Stack:** Apify Client (already installed), `apidojo/twitter-scraper-lite` Apify actor, Convex Node action (`"use node"`), Jest + ts-jest for unit tests.

---

## Architecture Decision: Why Not Playwright?

Playwright/headless browsers are **not viable** on this stack:

| Option | Verdict | Reason |
|--------|---------|--------|
| **Playwright on Convex** | ❌ Not viable | Convex Node actions cannot install system binaries (Chromium ~200 MB). No filesystem access for browser installation. |
| **Playwright on Vercel** | ❌ Not viable | Serverless function limit is 50 MB; Chromium alone is ~300 MB. No persistent process. |
| **Playwright on a separate service** | ⚠️ Possible but complex | Would require a dedicated VM/container (e.g., Railway, Render, Fly.io), adding a new service boundary with its own auth and cost. Over-engineered for a single platform. |
| **Twitter API v2 (official)** | ⚠️ Paid | Free tier is now extremely limited (1,500 reads/month). Basic tier costs $100/month. Good for high volume but adds auth complexity. |
| **RapidAPI Twitter scrapers** | ⚠️ Viable alternative | Multiple providers (e.g., `Twitter154`, `Twitter API v2`). Monthly cost $0–$50 depending on tier. Adds a new credential but avoids Apify dependency for Twitter. |
| **Nitter (open-source frontend)** | ❌ Unreliable | Public instances are frequently rate-limited, down, or behind Cloudflare challenges. No stable hosted option. |
| **Apify `apidojo/twitter-scraper-lite`** | ✅ Recommended | Already in stack. Same `ApifyClient` pattern as TikTok/Instagram. Pay-per-use. No new credentials. |

**Chosen approach:** Apify `apidojo/twitter-scraper-lite` — lowest friction, consistent with existing patterns.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `convex/processUrl.ts` | Modify | Add `ApifyTweet` interface, `mapApifyTweetToScrapeResult`, `scrapeTwitter`; update `scrapeUrl` switch |
| `tests/unit/twitter-scraping.test.ts` | Create | Unit tests for `mapApifyTweetToScrapeResult` |
| `tests/fixtures/sample-urls.ts` | Modify | Add Twitter Apify fixture data |
| `.env.local` | Note only | Add `APIFY_ACTOR_TWITTER=apidojo/twitter-scraper-lite` (not committed) |
| `CLAUDE.md` | Modify | Document the new env var |

---

## Task 1: Add ApifyTweet interface and export mapApifyTweetToScrapeResult

Define the shape of what Apify returns for a tweet and write the mapping function. Exporting it lets us unit test it without running Apify.

**Files:**
- Modify: `convex/processUrl.ts`

- [ ] **Step 1: Add the ApifyTweet interface**

In `convex/processUrl.ts`, add immediately after the existing `ScrapeResult` interface (after line 44):

```typescript
export interface ApifyTweet {
  id?: string;
  text?: string;
  author?: {
    name?: string;
    userName?: string;
    profilePicture?: string;
  };
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  viewCount?: number;
  bookmarkCount?: number;
  media?: Array<{
    type?: string;       // "photo" | "video" | "gif"
    url?: string;        // photo URL, or video stream URL
    thumbnailUrl?: string; // video poster frame
  }>;
  hashtags?: string[];
  createdAt?: string;
  twitterUrl?: string;
  conversationId?: string;
}
```

- [ ] **Step 2: Add the ACTOR_TWITTER constant near the other actor constants**

After `ACTOR_INSTAGRAM` (around line 61 currently):

```typescript
const ACTOR_TWITTER =
  process.env.APIFY_ACTOR_TWITTER ?? "apidojo/twitter-scraper-lite";
```

- [ ] **Step 3: Export mapApifyTweetToScrapeResult**

Add this function after `scrapeInstagram` in `convex/processUrl.ts`:

```typescript
export function mapApifyTweetToScrapeResult(
  item: ApifyTweet,
  originalUrl: string,
): ScrapeResult {
  const tweetText = (item.text ?? "").trim();
  const hashtags = (item.hashtags ?? []).map((h) => h.replace(/^#/, ""));

  // Pick thumbnail: prefer explicit thumbnailUrl (video poster), then first photo URL
  const firstMedia = (item.media ?? [])[0];
  const thumbnailUrl =
    firstMedia?.thumbnailUrl ??
    (firstMedia?.type === "photo" ? firstMedia.url : undefined);

  return {
    platform: "twitter",
    title: tweetText || undefined,
    description: tweetText || undefined,
    thumbnailUrl,
    authorName: item.author?.name,
    authorHandle: item.author?.userName,
    likeCount: item.likeCount,
    viewCount: item.viewCount,
    hashtags: hashtags.length ? hashtags : undefined,
    metadata: {
      url: originalUrl,
      twitterId: item.id,
      retweetCount: item.retweetCount,
      replyCount: item.replyCount,
      bookmarkCount: item.bookmarkCount,
      createdAt: item.createdAt,
      apifyTweet: item,
    },
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add convex/processUrl.ts
git commit -m "feat(twitter): add ApifyTweet interface and mapApifyTweetToScrapeResult"
```

---

## Task 2: Unit tests for mapApifyTweetToScrapeResult

**Files:**
- Modify: `tests/fixtures/sample-urls.ts`
- Create: `tests/unit/twitter-scraping.test.ts`

- [ ] **Step 1: Add Twitter Apify fixtures to sample-urls.ts**

Append to the bottom of `tests/fixtures/sample-urls.ts`:

```typescript
import type { ApifyTweet } from "../../convex/processUrl";

export const SAMPLE_APIFY_TWEETS: Record<string, ApifyTweet> = {
  textOnly: {
    id: "1001",
    text: "Just shipped a new feature for Ethereum devs 🚀 #ethereum #dev",
    author: { name: "Leopard Racer", userName: "leopardracer" },
    likeCount: 100,
    retweetCount: 20,
    replyCount: 5,
    viewCount: 1000,
    hashtags: ["ethereum", "dev"],
    createdAt: "2024-01-01T10:00:00.000Z",
    twitterUrl: "https://x.com/leopardracer/status/1001",
  },
  withPhoto: {
    id: "1002",
    text: "Amazing view from the summit 🏔️",
    author: { name: "Hiker Jane", userName: "hikerjane" },
    likeCount: 500,
    viewCount: 8000,
    media: [
      { type: "photo", url: "https://pbs.twimg.com/media/photo123.jpg" },
    ],
    hashtags: [],
    createdAt: "2024-02-15T08:30:00.000Z",
    twitterUrl: "https://x.com/hikerjane/status/1002",
  },
  withVideo: {
    id: "1003",
    text: "Watch this incredible trick 🎯",
    author: { name: "Trick Master", userName: "trickmaster" },
    likeCount: 2000,
    viewCount: 50000,
    media: [
      {
        type: "video",
        url: "https://video.twimg.com/ext_tw_video/1003.mp4",
        thumbnailUrl: "https://pbs.twimg.com/ext_tw_video_thumb/1003/pu/img/thumb.jpg",
      },
    ],
    hashtags: [],
    createdAt: "2024-03-10T15:00:00.000Z",
    twitterUrl: "https://x.com/trickmaster/status/1003",
  },
  emptyText: {
    id: "1004",
    text: "",
    author: { name: "Silent Bob", userName: "silentbob" },
    twitterUrl: "https://x.com/silentbob/status/1004",
  },
  hashtagsWithHash: {
    id: "1005",
    text: "Tweet with prefixed hashtags",
    author: { name: "Tagger", userName: "tagger" },
    hashtags: ["#web3", "#zkp", "noprefix"],
    twitterUrl: "https://x.com/tagger/status/1005",
  },
};
```

- [ ] **Step 2: Write the failing tests**

Create `tests/unit/twitter-scraping.test.ts`:

```typescript
import { mapApifyTweetToScrapeResult } from "../../convex/processUrl";
import { SAMPLE_APIFY_TWEETS } from "../fixtures/sample-urls";

describe("mapApifyTweetToScrapeResult", () => {
  describe("text mapping", () => {
    it("maps tweet text to title and description", () => {
      const result = mapApifyTweetToScrapeResult(
        SAMPLE_APIFY_TWEETS.textOnly,
        "https://x.com/leopardracer/status/1001",
      );
      expect(result.platform).toBe("twitter");
      expect(result.title).toBe(
        "Just shipped a new feature for Ethereum devs 🚀 #ethereum #dev",
      );
      expect(result.description).toBe(result.title);
    });

    it("returns undefined title and description for empty tweet text", () => {
      const result = mapApifyTweetToScrapeResult(
        SAMPLE_APIFY_TWEETS.emptyText,
        "https://x.com/silentbob/status/1004",
      );
      expect(result.title).toBeUndefined();
      expect(result.description).toBeUndefined();
    });
  });

  describe("author mapping", () => {
    it("maps author name and handle", () => {
      const result = mapApifyTweetToScrapeResult(
        SAMPLE_APIFY_TWEETS.textOnly,
        "https://x.com/leopardracer/status/1001",
      );
      expect(result.authorName).toBe("Leopard Racer");
      expect(result.authorHandle).toBe("leopardracer");
    });
  });

  describe("hashtag mapping", () => {
    it("strips leading # from hashtags", () => {
      const result = mapApifyTweetToScrapeResult(
        SAMPLE_APIFY_TWEETS.hashtagsWithHash,
        "https://x.com/tagger/status/1005",
      );
      expect(result.hashtags).toEqual(["web3", "zkp", "noprefix"]);
    });

    it("returns undefined hashtags when array is empty", () => {
      const result = mapApifyTweetToScrapeResult(
        SAMPLE_APIFY_TWEETS.withPhoto,
        "https://x.com/hikerjane/status/1002",
      );
      expect(result.hashtags).toBeUndefined();
    });
  });

  describe("thumbnail mapping", () => {
    it("uses photo url as thumbnailUrl for photo tweets", () => {
      const result = mapApifyTweetToScrapeResult(
        SAMPLE_APIFY_TWEETS.withPhoto,
        "https://x.com/hikerjane/status/1002",
      );
      expect(result.thumbnailUrl).toBe(
        "https://pbs.twimg.com/media/photo123.jpg",
      );
    });

    it("uses video thumbnailUrl (poster frame) for video tweets", () => {
      const result = mapApifyTweetToScrapeResult(
        SAMPLE_APIFY_TWEETS.withVideo,
        "https://x.com/trickmaster/status/1003",
      );
      expect(result.thumbnailUrl).toBe(
        "https://pbs.twimg.com/ext_tw_video_thumb/1003/pu/img/thumb.jpg",
      );
    });

    it("returns undefined thumbnailUrl when no media", () => {
      const result = mapApifyTweetToScrapeResult(
        SAMPLE_APIFY_TWEETS.textOnly,
        "https://x.com/leopardracer/status/1001",
      );
      expect(result.thumbnailUrl).toBeUndefined();
    });
  });

  describe("engagement stats", () => {
    it("maps likeCount and viewCount", () => {
      const result = mapApifyTweetToScrapeResult(
        SAMPLE_APIFY_TWEETS.textOnly,
        "https://x.com/leopardracer/status/1001",
      );
      expect(result.likeCount).toBe(100);
      expect(result.viewCount).toBe(1000);
    });

    it("stores retweetCount and replyCount in metadata", () => {
      const result = mapApifyTweetToScrapeResult(
        SAMPLE_APIFY_TWEETS.textOnly,
        "https://x.com/leopardracer/status/1001",
      );
      expect((result.metadata as Record<string, unknown>).retweetCount).toBe(20);
      expect((result.metadata as Record<string, unknown>).replyCount).toBe(5);
    });
  });
});
```

- [ ] **Step 3: Run the tests — expect failures (ApifyTweet not exported yet)**

```bash
cd /Users/lioneltan/.paperclip/instances/default/workspaces/12251c6d-5e5c-41f6-8962-6da2b528691d/fileaway
npm test -- tests/unit/twitter-scraping.test.ts
```

Expected: TypeScript compile error — `ApifyTweet` is not exported. This confirms the test is wired and failing for the right reason.

- [ ] **Step 4: Run tests again — all pass**

The `ApifyTweet` interface was already marked `export` in Task 1, Step 1. If the previous task was committed, the tests should now pass:

```bash
npm test -- tests/unit/twitter-scraping.test.ts
```

Expected: All 9 tests pass.

- [ ] **Step 5: Run full test suite — no regressions**

```bash
npm test
```

Expected: All existing tests + new twitter tests pass.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/twitter-scraping.test.ts tests/fixtures/sample-urls.ts
git commit -m "test(twitter): unit tests for mapApifyTweetToScrapeResult"
```

---

## Task 3: Implement scrapeTwitter and wire up in scrapeUrl

**Files:**
- Modify: `convex/processUrl.ts`

- [ ] **Step 1: Add scrapeTwitter function**

Add this function after `mapApifyTweetToScrapeResult` in `convex/processUrl.ts`:

```typescript
async function scrapeTwitter(url: string): Promise<ScrapeResult> {
  const client = getApifyClient();
  console.log(`[processUrl/twitter] Fetching tweet — url: ${url}`);

  const run = await client.actor(ACTOR_TWITTER).call({
    includeSearchTerms: false,
    maxItems: 1,
    sort: "Latest",
    startUrls: [url],
  });
  const { items } = await client
    .dataset(run.defaultDatasetId)
    .listItems({ limit: 1 });

  if (!items.length) {
    console.warn(`[processUrl/twitter] No items returned for URL: ${url}`);
    return {
      platform: "twitter",
      metadata: { url, empty: true },
    };
  }

  const item = items[0] as unknown as ApifyTweet;
  const result = mapApifyTweetToScrapeResult(item, url);
  console.log(
    `[processUrl/twitter] Done — author: @${result.authorHandle ?? "unknown"}, ` +
    `text: ${(item.text ?? "").length} chars, hasMedia: ${!!(item.media?.length)}`,
  );
  return result;
}
```

- [ ] **Step 2: Wire up in scrapeUrl**

In `convex/processUrl.ts`, find the `scrapeUrl` function (around line 184). Change:

```typescript
async function scrapeUrl(
  url: string,
  platform: PlatformType,
): Promise<ScrapeResult> {
  switch (platform) {
    case "tiktok":
      return scrapeTikTok(url);
    case "instagram":
      return scrapeInstagram(url);
    default:
      return {
        platform,
        metadata: { url, note: "Platform not supported for scraping" },
      };
  }
}
```

To:

```typescript
async function scrapeUrl(
  url: string,
  platform: PlatformType,
): Promise<ScrapeResult> {
  switch (platform) {
    case "tiktok":
      return scrapeTikTok(url);
    case "instagram":
      return scrapeInstagram(url);
    case "twitter":
      return scrapeTwitter(url);
    default:
      return {
        platform,
        metadata: { url, note: "Platform not supported for scraping" },
      };
  }
}
```

- [ ] **Step 3: Run full test suite — no regressions**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add convex/processUrl.ts
git commit -m "feat(twitter): add scrapeTwitter via Apify apidojo/twitter-scraper-lite"
```

---

## Task 4: Document the new env var

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md Environment Variables section**

In `CLAUDE.md`, update the "Environment Variables" block to add `APIFY_ACTOR_TWITTER`:

```markdown
Required in `.env.local`:
```
CONVEX_DEPLOYMENT=dev:your-project-name
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
APIFY_API_TOKEN=...
APIFY_ACTOR_TWITTER=apidojo/twitter-scraper-lite   # optional, this is the default
GEMINI_API_KEY=...
```
```

- [ ] **Step 2: Add APIFY_ACTOR_TWITTER to your local .env.local**

```
APIFY_ACTOR_TWITTER=apidojo/twitter-scraper-lite
```

(The code defaults to this value — adding it explicitly makes intent clear.)

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document APIFY_ACTOR_TWITTER env var for Twitter scraping"
```

---

## Task 5: Manual smoke test

- [ ] **Step 1: Start the dev environment in two terminals**

```bash
# Terminal 1
npx convex dev

# Terminal 2
npm run dev
```

- [ ] **Step 2: Save a text-only tweet**

In the app at `http://localhost:3000`, paste a tweet URL such as:
`https://x.com/sama/status/1900297590492168450`

Check Convex dashboard logs for:
- `[processUrl/twitter] Fetching tweet — url: ...`
- `[processUrl/twitter] Done — author: @sama, text: N chars, hasMedia: false`
- `[processUrl] Category resolved: <something>`
- `[gemini/extract] JSON parsed successfully`
- Item appears in feed with extracted content (not blank/failed)

- [ ] **Step 3: Save a tweet with an image**

Find a tweet with an attached photo. Save the URL.

Check Convex logs for:
- `hasMedia: true`

Check the item card: it should display the tweet's photo as the thumbnail.

- [ ] **Step 4: Confirm YouTube/other URLs still skip scraping**

Save `https://www.youtube.com/watch?v=dQw4w9WgXcQ` — confirm the item processes without calling Apify for twitter, reaches Gemini with whatever metadata is available, and does not error.

- [ ] **Step 5: Check Apify usage dashboard**

Visit `https://console.apify.com` → Runs. Confirm one `apidojo/twitter-scraper-lite` run appears for each tweet URL you saved.

---

## Self-Review

**Spec coverage:**
- ✅ Extract tweet text, author, engagement stats, hashtags: `mapApifyTweetToScrapeResult` maps all fields.
- ✅ Thumbnail extraction: picks video poster frame or first photo URL.
- ✅ Suitable for Vercel + Convex: runs in existing Convex Node action; no new services needed.
- ✅ Architecture rationale documented: Playwright ruled out with reasons, Apify chosen as lowest-friction.
- ✅ Follows existing patterns: `scrapeTwitter` is structurally identical to `scrapeTikTok` and `scrapeInstagram`.
- ✅ No changes to Gemini categorize/extract pipeline: tweet content flows in via `ScrapeResult.description`.
- ✅ Tests: 9 unit tests covering text, author, hashtag, thumbnail, and engagement mapping.

**Placeholder scan:** No TBDs, TODOs, or "handle edge cases" phrases present. All code blocks are complete and copy-pasteable.

**Type consistency:**
- `ApifyTweet` is defined once and used in `mapApifyTweetToScrapeResult` and `scrapeTwitter` — consistent.
- `mapApifyTweetToScrapeResult` returns `ScrapeResult` — same type as `scrapeTikTok` and `scrapeInstagram` — consistent.
- `scrapeTwitter` returns `Promise<ScrapeResult>` — same signature as `scrapeTikTok` and `scrapeInstagram` — consistent.
- `ACTOR_TWITTER` constant follows the same naming and fallback pattern as `ACTOR_TIKTOK` and `ACTOR_INSTAGRAM` — consistent.
