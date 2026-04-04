# Clickable Cards + Video Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all feed cards clickable to open a URL-synced detail modal, and enrich video-analysis items from TikTok/Instagram with a Gemini-powered shot-by-shot breakdown and actionable takeaways.

**Architecture:** A `?item=<id>` query param drives a new `DetailModal` component rendered in `FeedApp`. The card root gains an onClick handler; action buttons stop propagation. For video-analysis on TikTok/Instagram/Twitter, `processUrl.ts` downloads the video, uploads it to Gemini Files API, runs a multimodal extraction, then deletes the upload — falling back to text extraction on any failure.

**Tech Stack:** Next.js 14 App Router (`useSearchParams`, `useRouter`), React 18, Convex, `@google/generative-ai` + `@google/generative-ai/server` (GoogleAIFileManager), Tailwind CSS, Jest + ts-jest.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `convex/processUrl.ts` | Add `shouldUseVideoAnalysis()` + `extractWithVideo()` functions; branch in `extractStructuredData` |
| Modify | `tests/unit/processUrl.test.ts` | Tests for video analysis branching logic |
| Create | `src/components/feed/DetailModal.tsx` | Full-detail modal with per-category renderers + video storyboard |
| Modify | `src/components/feed/FeedApp.tsx` | Read `?item=` param; render `DetailModal`; pass `onCardClick` to `ItemCard` |
| Modify | `src/components/feed/ItemCard.tsx` | Accept `onCardClick` prop; make card root clickable; stop propagation on action buttons; remove `GuideModal` render |

---

## Task 1: Add video analysis branching logic to processUrl.ts

**Files:**
- Modify: `convex/processUrl.ts`
- Modify: `tests/unit/processUrl.test.ts`

- [ ] **Step 1: Write failing tests for `shouldUseVideoAnalysis`**

Add to `tests/unit/processUrl.test.ts`:

```typescript
import { WRAPPER_INSTRUCTIONS, shouldUseVideoAnalysis } from "../../convex/processUrl";

describe("shouldUseVideoAnalysis", () => {
  it("returns true for tiktok video-analysis with a videoUrl", () => {
    expect(shouldUseVideoAnalysis("video-analysis", "tiktok", "https://cdn.tiktok.com/v.mp4")).toBe(true);
  });

  it("returns true for instagram video-analysis with a videoUrl", () => {
    expect(shouldUseVideoAnalysis("video-analysis", "instagram", "https://cdn.instagram.com/v.mp4")).toBe(true);
  });

  it("returns true for twitter video-analysis with a videoUrl", () => {
    expect(shouldUseVideoAnalysis("video-analysis", "twitter", "https://video.twimg.com/v.mp4")).toBe(true);
  });

  it("returns false for youtube even with a videoUrl", () => {
    expect(shouldUseVideoAnalysis("video-analysis", "youtube", "https://yt.com/v.mp4")).toBe(false);
  });

  it("returns false for other platform", () => {
    expect(shouldUseVideoAnalysis("video-analysis", "other", "https://example.com/v.mp4")).toBe(false);
  });

  it("returns false for non-video-analysis category", () => {
    expect(shouldUseVideoAnalysis("recipe", "tiktok", "https://cdn.tiktok.com/v.mp4")).toBe(false);
  });

  it("returns false when videoUrl is absent", () => {
    expect(shouldUseVideoAnalysis("video-analysis", "tiktok", undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=processUrl --verbose
```

Expected: FAIL — `shouldUseVideoAnalysis is not a function` (or similar export error)

- [ ] **Step 3: Export `shouldUseVideoAnalysis` from processUrl.ts**

Add this function near the top of the Gemini AI section in `convex/processUrl.ts` (after the model constants, before `categorizeContent`):

```typescript
export function shouldUseVideoAnalysis(
  category: CategoryType,
  platform: PlatformType,
  videoUrl: string | undefined,
): boolean {
  return (
    category === "video-analysis" &&
    (platform === "tiktok" || platform === "instagram" || platform === "twitter") &&
    !!videoUrl
  );
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- --testPathPattern=processUrl --verbose
```

Expected: All `shouldUseVideoAnalysis` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/processUrl.ts tests/unit/processUrl.test.ts
git commit -m "feat: add shouldUseVideoAnalysis helper with tests"
```

---

## Task 2: Implement `extractWithVideo` in processUrl.ts

**Files:**
- Modify: `convex/processUrl.ts`

Note: `GoogleAIFileManager` is available from `@google/generative-ai/server`. It requires writing the video to `/tmp/` before uploading. Convex Node actions have access to `/tmp/`.

- [ ] **Step 1: Add import for `GoogleAIFileManager` and `fs/promises` at the top of processUrl.ts**

Add after the existing imports:

```typescript
import { GoogleAIFileManager } from "@google/generative-ai/server";
import * as fs from "fs/promises";
import * as path from "path";
```

- [ ] **Step 2: Add `extractWithVideo` function**

Add this function in `convex/processUrl.ts` after `shouldUseVideoAnalysis` and before `extractStructuredData`:

```typescript
const VIDEO_ANALYSIS_PROMPT = `You are analyzing a short social media video. Watch it carefully and return a JSON object with exactly this structure:

{
  "title": "<short descriptive title for the video>",
  "summary": "<2-3 sentence overview of the full video>",
  "shots": [
    {
      "timestamp": "<approximate timestamp e.g. '0:05'>",
      "description": "<one-line label for this scene e.g. 'Overhead ingredient shot'>",
      "detail": "<1-2 sentences explaining what is happening and why it matters in context — e.g. technique being used, location detail, exercise being performed>"
    }
  ],
  "takeaways": [
    "<specific actionable item the viewer can act on>"
  ]
}

Guidelines:
- Include 3 to 8 shots covering the key moments in the video.
- Make each shot description concise (5-10 words) and each detail 1-2 sentences.
- Include 3-6 takeaways that are specific and actionable, not generic.
- Return ONLY valid JSON. No markdown fences, no explanation, no extra fields.`;

async function extractWithVideo(
  videoUrl: string,
  itemId: string,
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const tmpPath = path.join("/tmp", `fileaway-video-${itemId}.mp4`);

  try {
    console.log(`[gemini/video] Downloading video for item ${itemId}...`);
    const response = await fetch(videoUrl);
    if (!response.ok) {
      console.warn(`[gemini/video] Video download failed — HTTP ${response.status}`);
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(tmpPath, buffer);
    console.log(`[gemini/video] Video written to ${tmpPath} (${buffer.length} bytes)`);

    const fileManager = new GoogleAIFileManager(apiKey);
    console.log(`[gemini/video] Uploading to Gemini Files API...`);
    const uploadResult = await fileManager.uploadFile(tmpPath, {
      mimeType: "video/mp4",
      displayName: `fileaway-${itemId}`,
    });
    console.log(`[gemini/video] Uploaded — uri: ${uploadResult.file.uri}`);

    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: PRO_MODEL });

    const t0 = Date.now();
    const result = await model.generateContent([
      {
        fileData: {
          fileUri: uploadResult.file.uri,
          mimeType: "video/mp4",
        },
      },
      VIDEO_ANALYSIS_PROMPT,
    ]);
    console.log(`[gemini/video] Extraction complete in ${Date.now() - t0}ms`);

    // Cleanup uploaded file from Gemini
    try {
      await fileManager.deleteFile(uploadResult.file.name);
      console.log(`[gemini/video] Deleted uploaded file from Gemini Files API`);
    } catch (deleteErr) {
      console.warn(`[gemini/video] Failed to delete uploaded file:`, deleteErr);
    }

    const raw = result.response.text().trim()
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "");

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      console.log(`[gemini/video] JSON parsed — keys: ${Object.keys(parsed).join(", ")}`);
      return parsed;
    } catch (parseErr) {
      console.warn(`[gemini/video] JSON parse failed:`, parseErr);
      return null;
    }
  } catch (err) {
    console.warn(`[gemini/video] extractWithVideo failed:`, err);
    return null;
  } finally {
    // Always clean up tmp file
    await fs.unlink(tmpPath).catch(() => {});
  }
}
```

- [ ] **Step 3: Update `extractStructuredData` to branch on `shouldUseVideoAnalysis`**

In `convex/processUrl.ts`, find the `extractStructuredData` function. Replace the body with the version below (the only new code is the `if (shouldUseVideoAnalysis(...))` block at the start; everything else is unchanged):

```typescript
async function extractStructuredData(
  ctx: { runQuery: (ref: any, args: any) => Promise<any> },
  scrape: ScrapeResult,
  category: CategoryType,
): Promise<ExtractionResult> {
  // Video analysis path: use Gemini Files API with actual video
  if (shouldUseVideoAnalysis(category, scrape.platform, scrape.videoUrl)) {
    console.log(`[gemini/extract] Using video analysis path — platform: ${scrape.platform}`);
    const videoData = await extractWithVideo(scrape.videoUrl!, "tmp");
    if (videoData) {
      return {
        category,
        extractedData: videoData,
        actionTaken: getDefaultAction(category),
      };
    }
    console.warn(`[gemini/extract] Video analysis failed, falling back to text extraction`);
  }

  // Text extraction path (unchanged)
  const useProModel = ["food", "recipe", "fitness"].includes(category);
  const modelName = useProModel ? PRO_MODEL : FLASH_MODEL;
  console.log(`[gemini/extract] Starting — model: ${modelName}, category: ${category}, useProModel: ${useProModel}`);

  const categoryRow = await ctx.runQuery(internal.adminCategories.getCategoryBySlug, { slug: category });
  const extractionPrompt = categoryRow?.extractionPrompt ??
    `Return JSON:\n{\n  "title": "<short descriptive title>",\n  "summary": "<2-3 sentence description>",\n  "topics": ["<topic tag>"]\n}`;

  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: modelName });

  const prompt = buildExtractionPrompt(scrape, category, extractionPrompt);
  console.log(`[gemini/extract] Prompt length: ${prompt.length} chars`);

  const t0 = Date.now();
  let result;
  try {
    result = await model.generateContent(prompt);
  } catch (err) {
    console.error(`[gemini/extract] API error after ${Date.now() - t0}ms — model: ${modelName}, category: ${category}`, err);
    throw err;
  }
  const raw = result.response.text().trim();
  console.log(`[gemini/extract] Response in ${Date.now() - t0}ms — raw length: ${raw.length} chars`);
  console.log(`[gemini/extract] Raw response: ${raw.slice(0, 500)}${raw.length > 500 ? "…" : ""}`);

  let extractedData: Record<string, unknown>;
  try {
    const jsonStr = raw
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "");
    extractedData = JSON.parse(jsonStr);
    console.log(`[gemini/extract] JSON parsed successfully — keys: ${Object.keys(extractedData).join(", ")}`);
  } catch (parseErr) {
    console.warn(`[gemini/extract] JSON parse failed, storing raw response`, parseErr);
    extractedData = { raw_response: raw, parse_error: true };
  }

  return {
    category,
    extractedData,
    actionTaken: getDefaultAction(category),
  };
}
```

- [ ] **Step 4: Pass the real item ID into `extractWithVideo`**

In the `extractStructuredData` function above, the call `extractWithVideo(scrape.videoUrl!, "tmp")` uses a placeholder ID. We need to thread `savedItemId` down from the main `processItem` handler. Update `extractStructuredData` signature and the call site:

Change the signature:
```typescript
async function extractStructuredData(
  ctx: { runQuery: (ref: any, args: any) => Promise<any> },
  scrape: ScrapeResult,
  category: CategoryType,
  itemId: string,         // add this
): Promise<ExtractionResult>
```

Change the `extractWithVideo` call inside it:
```typescript
const videoData = await extractWithVideo(scrape.videoUrl!, itemId);
```

In `processItem` handler, update the call to `extractStructuredData`:
```typescript
const extraction = await extractStructuredData(ctx, scrapeResult, category, savedItemId);
```

- [ ] **Step 5: Run all tests to verify nothing is broken**

```bash
npm test -- --verbose
```

Expected: All existing tests PASS. (The `extractWithVideo` function is not unit-tested directly because it requires live network/API calls — it is covered by integration testing in Task 3.)

- [ ] **Step 6: Commit**

```bash
git add convex/processUrl.ts
git commit -m "feat: add Gemini video file analysis for video-analysis category"
```

---

## Task 3: Update video-analysis extraction prompt in DB

The text-only fallback path for `video-analysis` still uses the old extraction prompt (title, summary, key_points). Update it via the Convex dashboard so the fallback also requests the new schema.

**Files:**
- No code files — this is a data update via Convex dashboard.

- [ ] **Step 1: Open Convex dashboard and run a mutation**

Navigate to your Convex dashboard → Functions → Run function.

Run `internal.adminCategories.getCategoryBySlug` with `{ slug: "video-analysis" }` to get the current document `_id`.

Then run `api.adminCategories.updateCategory` (or use the Convex dashboard data editor) to set `extractionPrompt` on the `video-analysis` category to:

```
Return JSON matching this schema exactly:
{
  "title": "<short descriptive title>",
  "summary": "<2-3 sentence overview>",
  "shots": [
    {
      "timestamp": "<e.g. '0:05' — infer from context if unknown>",
      "description": "<one-line scene label>",
      "detail": "<1-2 sentences on what happens and why it matters>"
    }
  ],
  "takeaways": ["<specific actionable item>"]
}

Infer shots from the caption, hashtags, and content type. Include 3-5 inferred shots and 3-5 takeaways.
```

- [ ] **Step 2: Verify the prompt is saved**

Run `internal.adminCategories.getCategoryBySlug` with `{ slug: "video-analysis" }` again and confirm `extractionPrompt` contains the new schema.

---

## Task 4: Create `DetailModal` component

**Files:**
- Create: `src/components/feed/DetailModal.tsx`

- [ ] **Step 1: Create the file with full per-category content renderers**

```typescript
"use client";

import type { SavedItemResponse } from "@/lib/api/types";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// ─── Per-category detail renderers ───────────────────────────────────────────

function FoodDetail({ data }: { data: Record<string, unknown> }) {
  const name = data.name as string | undefined;
  const address = data.address as string | undefined;
  const cuisine = data.cuisine as string | undefined;
  const whyVisit = data.why_visit as string | undefined;
  const priceRange = data.price_range as string | undefined;
  const hours = data.hours as string | undefined;
  const phone = data.phone as string | undefined;

  return (
    <div className="space-y-3">
      {name && <p className="font-semibold text-fa-primary text-base leading-tight">{name}</p>}
      <div className="flex flex-wrap gap-2">
        {cuisine && <span className="text-xs text-fa-dim bg-fa-chip px-2 py-0.5 rounded">{cuisine}</span>}
        {priceRange && <span className="text-xs text-[#f97316] font-mono bg-fa-chip px-2 py-0.5 rounded">{priceRange}</span>}
      </div>
      {address && (
        <p className="text-sm text-fa-secondary-alt flex items-start gap-1.5">
          <span className="mt-0.5 flex-shrink-0">📍</span>
          <span>{address}</span>
        </p>
      )}
      {whyVisit && (
        <p className="text-sm text-fa-soft leading-relaxed border-l-2 border-[#f97316]/30 pl-3 italic">{whyVisit}</p>
      )}
      {hours && (
        <p className="text-xs text-fa-dim">
          <span className="font-medium text-fa-subtle">Hours: </span>{hours}
        </p>
      )}
      {phone && (
        <p className="text-xs text-fa-dim">
          <span className="font-medium text-fa-subtle">Phone: </span>{phone}
        </p>
      )}
    </div>
  );
}

function RecipeDetail({ data }: { data: Record<string, unknown> }) {
  const dishName = data.dish_name as string | undefined;
  const ingredients = data.ingredients as string[] | undefined;
  const steps = data.steps as string[] | undefined;
  const prepTime = data.prep_time_minutes as number | undefined;
  const cookTime = data.cook_time_minutes as number | undefined;
  const servings = data.servings as number | undefined;

  return (
    <div className="space-y-4">
      {dishName && <p className="font-semibold text-fa-primary text-base leading-tight">{dishName}</p>}
      <div className="flex gap-4 text-xs text-fa-secondary-alt">
        {prepTime !== undefined && <span>Prep {prepTime}m</span>}
        {cookTime !== undefined && cookTime > 0 && <span>Cook {cookTime}m</span>}
        {servings !== undefined && <span>Serves {servings}</span>}
      </div>
      {ingredients && ingredients.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle mb-2">Ingredients</p>
          <ul className="space-y-1">
            {ingredients.map((ing, i) => (
              <li key={i} className="text-sm text-fa-soft flex items-start gap-2">
                <span className="text-[#22c55e] mt-0.5 flex-shrink-0">·</span>
                {ing}
              </li>
            ))}
          </ul>
        </div>
      )}
      {steps && steps.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle mb-2">Steps</p>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#22c55e20] border border-[#22c55e40] text-[#22c55e] text-[10px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-fa-secondary leading-relaxed pt-0.5">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FitnessDetail({ data }: { data: Record<string, unknown> }) {
  const workoutName = data.workout_name as string | undefined;
  const exercises = data.exercises as Array<{ name: string; sets: number; reps: number | string }> | undefined;
  const muscleGroups = data.muscle_groups as string[] | undefined;
  const duration = data.duration_minutes as number | undefined;
  const difficulty = data.difficulty as string | undefined;
  const notes = data.notes as string | undefined;

  return (
    <div className="space-y-4">
      {workoutName && <p className="font-semibold text-fa-primary text-base leading-tight">{workoutName}</p>}
      <div className="flex gap-3 flex-wrap">
        {duration && <span className="text-xs text-[#3b82f6] bg-[#3b82f610] px-2 py-0.5 rounded font-mono">{duration}m</span>}
        {difficulty && <span className="text-xs text-fa-dim bg-fa-chip px-2 py-0.5 rounded">{difficulty}</span>}
      </div>
      {muscleGroups && muscleGroups.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {muscleGroups.map((g) => (
            <span key={g} className="text-xs text-[#3b82f6]/70 bg-[#3b82f608] border border-[#3b82f620] px-2 py-0.5 rounded">{g}</span>
          ))}
        </div>
      )}
      {exercises && exercises.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle mb-2">Exercises</p>
          <div className="space-y-1.5">
            {exercises.map((ex, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-fa-separator last:border-0">
                <span className="text-fa-mid">{ex.name}</span>
                <span className="text-[#3b82f6] font-mono text-xs">
                  {ex.sets > 1 ? `${ex.sets}×` : ""}{ex.reps}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {notes && <p className="text-xs text-fa-soft leading-relaxed italic border-l-2 border-[#3b82f6]/30 pl-3">{notes}</p>}
    </div>
  );
}

function HowToDetail({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string | undefined;
  const summary = data.summary as string | undefined;
  const steps = data.steps as string[] | undefined;

  return (
    <div className="space-y-4">
      {title && <p className="font-semibold text-fa-primary text-base leading-tight">{title}</p>}
      {summary && <p className="text-sm text-fa-dim leading-relaxed">{summary}</p>}
      {steps && steps.length > 0 && (
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#a855f720] border border-[#a855f740] text-[#a855f7] text-[11px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <p className="text-sm text-fa-secondary leading-relaxed pt-0.5">{step}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Shot {
  timestamp: string;
  description: string;
  detail: string;
}

function VideoAnalysisDetail({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string | undefined;
  const summary = data.summary as string | undefined;
  const shots = data.shots as Shot[] | undefined;
  const takeaways = data.takeaways as string[] | undefined;
  const keyPoints = data.key_points as string[] | undefined; // legacy fallback field

  // If no shots, fall back to summary + key_points display
  if (!shots || shots.length === 0) {
    return (
      <div className="space-y-3">
        {title && <p className="font-semibold text-fa-primary text-base leading-tight">{title}</p>}
        {summary && <p className="text-sm text-fa-soft leading-relaxed">{summary}</p>}
        {keyPoints && keyPoints.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle">Key Points</p>
            {keyPoints.map((pt, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-[#14b8a6] flex-shrink-0 mt-0.5">→</span>
                <span className="text-fa-dim">{pt}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {title && <p className="font-semibold text-fa-primary text-base leading-tight">{title}</p>}
      {summary && <p className="text-sm text-fa-soft leading-relaxed">{summary}</p>}

      {/* Storyboard */}
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle mb-3">Shot Breakdown</p>
        <div className="space-y-3">
          {shots.map((shot, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 font-mono text-[10px] text-[#14b8a6] bg-[#14b8a610] border border-[#14b8a630] px-1.5 py-0.5 rounded mt-0.5 whitespace-nowrap">
                {shot.timestamp}
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-fa-primary leading-snug">{shot.description}</p>
                <p className="text-xs text-fa-soft leading-relaxed">{shot.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Takeaways */}
      {takeaways && takeaways.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle mb-2">Takeaways</p>
          <ul className="space-y-1.5">
            {takeaways.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-[#14b8a6] flex-shrink-0 mt-0.5">✓</span>
                <span className="text-fa-dim leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function OtherDetail({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string | undefined;
  const summary = data.summary as string | undefined;
  const topics = data.topics as string[] | undefined;

  return (
    <div className="space-y-3">
      {title && <p className="font-semibold text-fa-primary text-base leading-tight">{title}</p>}
      {summary && <p className="text-sm text-fa-soft leading-relaxed">{summary}</p>}
      {topics && topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topics.map((t) => (
            <span key={t} className="text-xs text-fa-subtle bg-fa-chip px-2 py-0.5 rounded">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailContent({ item }: { item: SavedItemResponse }) {
  const data = item.extracted_data ?? {};
  switch (item.category) {
    case "food": return <FoodDetail data={data} />;
    case "recipe": return <RecipeDetail data={data} />;
    case "fitness": return <FitnessDetail data={data} />;
    case "how-to": return <HowToDetail data={data} />;
    case "video-analysis": return <VideoAnalysisDetail data={data} />;
    case "other": return <OtherDetail data={data} />;
    default: return <OtherDetail data={data} />;
  }
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  food: "Food",
  recipe: "Recipe",
  fitness: "Fitness",
  "how-to": "How-To Guide",
  "video-analysis": "Video Analysis",
  other: "Saved Item",
};

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  twitter: "X/Twitter",
  other: "Web",
};

interface DetailModalProps {
  item: SavedItemResponse;
}

export function DetailModal({ item }: DetailModalProps) {
  const router = useRouter();

  const close = () => router.back();

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const categoryLabel = CATEGORY_LABELS[item.category] ?? item.category;
  const platformLabel = PLATFORM_LABELS[item.platform] ?? item.platform;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 pt-16 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-full max-w-xl bg-fa-surface border border-fa-line rounded-xl shadow-2xl mb-8">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-fa-separator">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle">
                {categoryLabel}
              </span>
              <span className="text-fa-faint text-[10px]">·</span>
              <span className="text-[10px] text-fa-faint">{platformLabel}</span>
            </div>
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-fa-subtle hover:text-fa-muted transition-colors font-mono truncate block max-w-xs"
            >
              {item.source_url}
            </a>
          </div>
          <button
            onClick={close}
            className="text-fa-subtle hover:text-fa-dim text-lg leading-none mt-0.5 ml-4 flex-shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Thumbnail */}
        {item.thumbnail_url && (
          <img
            src={item.thumbnail_url}
            alt=""
            referrerPolicy="no-referrer"
            className="w-full h-48 object-cover"
            loading="lazy"
          />
        )}

        {/* Body */}
        <div className="p-5">
          <DetailContent item={item} />
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-fa-subtle hover:text-fa-muted transition-colors"
          >
            View original source ↗
          </a>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
npm run build 2>&1 | head -40
```

Expected: No TypeScript errors for `DetailModal.tsx`. (Other build errors unrelated to this file are acceptable at this stage.)

- [ ] **Step 3: Commit**

```bash
git add src/components/feed/DetailModal.tsx
git commit -m "feat: add DetailModal with per-category detail renderers and video storyboard"
```

---

## Task 5: Wire DetailModal into FeedApp and make cards clickable

**Files:**
- Modify: `src/components/feed/FeedApp.tsx`
- Modify: `src/components/feed/ItemCard.tsx`

### Part A — FeedApp changes

- [ ] **Step 1: Add DetailModal import and `?item=` param reading to FeedApp**

In `src/components/feed/FeedApp.tsx`, add the import at the top:

```typescript
import { DetailModal } from "@/components/feed/DetailModal";
```

In the `FeedApp` function body, after the existing `useSearchParams` / `useRouter` / `usePathname` declarations, add:

```typescript
const activeItemId = searchParams.get("item");
const activeItem = activeItemId ? allItems.find((i) => i.id === activeItemId) ?? null : null;

const openItem = useCallback(
  (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("item", id);
    router.push(`${pathname}?${params.toString()}`);
  },
  [searchParams, router, pathname],
);
```

- [ ] **Step 2: Pass `onCardClick` to `ItemCard` and render `DetailModal`**

In the `filteredItems.map(...)` call inside the `<main>` section of `FeedApp`, update the `ItemCard` render:

```tsx
filteredItems.map((item) => (
  <ItemCard
    key={item.id}
    item={item}
    categories={categories.map((c) => ({ slug: c.slug, label: c.label }))}
    onCardClick={openItem}
  />
))
```

At the very end of the `FeedApp` return, just before the closing `</div>`, add:

```tsx
{activeItem && <DetailModal item={activeItem} />}
```

### Part B — ItemCard changes

- [ ] **Step 3: Add `onCardClick` prop to `ItemCardProps` and make the card root clickable**

In `src/components/feed/ItemCard.tsx`, update the `ItemCardProps` interface:

```typescript
interface ItemCardProps {
  item: SavedItemResponse;
  categories?: { slug: string; label: string }[];
  onCardClick?: (id: string) => void;
}
```

Update the `ItemCard` function signature:

```typescript
export function ItemCard({ item, categories, onCardClick }: ItemCardProps) {
```

Update the card root `<div>` (currently has `className="relative bg-fa-surface..."`) to add `onClick` and cursor:

```tsx
<div
  className={`relative bg-fa-surface border border-fa-line border-l-4 ${meta.border} rounded-lg overflow-hidden transition-all duration-200 hover:border-fa-strong hover:shadow-lg hover:shadow-fa-card flex flex-col ${onCardClick && item.status === "done" ? "cursor-pointer" : ""}`}
  onClick={() => {
    if (onCardClick && item.status === "done") onCardClick(item.id);
  }}
>
```

- [ ] **Step 4: Stop propagation on action buttons and links to prevent double-firing**

In `ItemCard.tsx`, update the `ActionButton` component to stop propagation. Find the `ActionButton` return statements and wrap the outermost element's onClick. The cleanest way is to add a `stopPropagation` wrapper div around the `ActionButton` render in the footer:

Find the footer section (around line 860) and wrap the action button div:

```tsx
<div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
  <ActionButton item={item} category={item.category} />
  <button
    onClick={(e) => { e.stopPropagation(); setShowCorrection(true); }}
    className="text-[11px] text-fa-faint hover:text-[#ef4444] transition-colors px-1"
    title="Report a correction"
  >
    ✗
  </button>
</div>
```

Also stop propagation on the archive button in the header:

```tsx
<button
  type="button"
  onClick={(e) => { e.stopPropagation(); handleArchiveToggle(); }}
  ...
>
```

And on the category override select:

```tsx
<div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
```

And on the "View Original" link:

```tsx
<a
  href={item.source_url}
  target="_blank"
  rel="noopener noreferrer"
  onClick={(e) => e.stopPropagation()}
  ...
>
```

- [ ] **Step 5: Remove the `onGuideOpen` prop from `ActionButton` and the `GuideModal` render**

The how-to guide now lives in `DetailModal`. In `ItemCard.tsx`:

Remove `onGuideOpen` from `ActionButton`'s props interface and the call site in the footer.

Remove the `guideItem` state and the `GuideModal` render at the bottom of `ItemCard`:
```tsx
// DELETE these:
const [guideItem, setGuideItem] = useState<SavedItemResponse | null>(null);
// ...
{guideItem && (
  <GuideModal item={guideItem} onClose={() => setGuideItem(null)} />
)}
```

In the `ActionButton` for `how-to`, replace `onGuideOpen?.(item)` with a no-op (the card click handles opening the modal now). Since the action button still shows "View guide", keep the button but make it do nothing visible — the card click opens the detail modal. You can simplify the `how-to` action button to just show a label:

```tsx
if (category === "how-to") {
  return (
    <span className="text-xs px-3 py-1.5 rounded bg-[#a855f715] text-[#a855f7] border border-[#a855f730] font-medium">
      View guide ↗
    </span>
  );
}
```

- [ ] **Step 6: Run the dev server and manually verify**

```bash
npm run dev
```

1. Open `http://localhost:3000`
2. Click a completed card — confirm the modal opens and the URL changes to `?item=<id>`
3. Press browser back — confirm the modal closes and URL reverts
4. Open the URL directly in a new tab — confirm the modal opens on load
5. Click outside the modal or press Escape — confirm it closes
6. Verify action buttons (Copy, Maps, etc.) do NOT open the modal when clicked

- [ ] **Step 7: Commit**

```bash
git add src/components/feed/FeedApp.tsx src/components/feed/ItemCard.tsx
git commit -m "feat: make cards clickable with URL-synced detail modal"
```

---

## Task 6: Build verification and cleanup

**Files:**
- Verify: all modified files

- [ ] **Step 1: Run full test suite**

```bash
npm test -- --verbose
```

Expected: All tests PASS.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No errors. Fix any lint warnings introduced by the new files.

- [ ] **Step 3: Run build**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Final commit if any lint fixes were needed**

```bash
git add -p   # stage only the lint fixes
git commit -m "chore: fix lint issues in DetailModal and ItemCard"
```

---

## Verification Checklist

- [ ] Clicking a done card opens the DetailModal
- [ ] URL shows `?item=<id>` when modal is open
- [ ] Browser back closes the modal
- [ ] Sharing the URL with `?item=<id>` opens the modal on load
- [ ] Escape key closes the modal
- [ ] Clicking outside the modal closes it
- [ ] Action buttons (Copy, Maps, Save to routine) do NOT trigger the modal
- [ ] Archive button does NOT trigger the modal
- [ ] Pending/Processing/Failed cards are NOT clickable
- [ ] Video-analysis items from TikTok/Instagram show storyboard + takeaways in modal (after re-processing)
- [ ] Video-analysis items from YouTube show summary + key_points in modal (fallback)
- [ ] All existing tests pass
- [ ] Build succeeds
