"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { ApifyClient } from "apify-client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import * as fs from "fs/promises";
import * as path from "path";
import type { Id } from "./_generated/dataModel";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlatformType = "tiktok" | "instagram" | "youtube" | "twitter" | "other";
type CategoryType = string;

interface ScrapeResult {
  platform: PlatformType;
  title?: string;
  description?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  authorName?: string;
  authorHandle?: string;
  likeCount?: number;
  viewCount?: number;
  hashtags?: string[];
  metadata: Record<string, unknown>;
}

// ─── Platform detection ────────────────────────────────────────────────────────

function detectPlatform(url: string): PlatformType {
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/twitter\.com|x\.com/i.test(url)) return "twitter";
  return "other";
}

// ─── Apify scraping ───────────────────────────────────────────────────────────

const ACTOR_TIKTOK =
  process.env.APIFY_ACTOR_TIKTOK ?? "clockworks/tiktok-video-scraper";
const ACTOR_INSTAGRAM =
  process.env.APIFY_ACTOR_INSTAGRAM ?? "apify/instagram-scraper";

function getApifyClient(): ApifyClient {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN is not configured");
  return new ApifyClient({ token });
}

async function resolveFinalUrl(inputUrl: string): Promise<string> {
  try {
    const res = await fetch(inputUrl, { redirect: "follow" });
    // We only need the final resolved URL; don't buffer the body.
    res.body?.cancel();
    return res.url || inputUrl;
  } catch {
    return inputUrl;
  }
}

function pickTikTokVideoUrl(item: Record<string, unknown>): string | undefined {
  return (
    (item.videoUrl as string | undefined) ??
    (item.webVideoUrl as string | undefined) ??
    undefined
  );
}

function pickTikTokThumbnailUrl(
  item: Record<string, unknown>,
): string | undefined {
  return (
    (item["videoMeta.coverUrl"] as string | undefined) ??
    ((item.videoMeta as Record<string, unknown> | undefined)?.coverUrl as
      | string
      | undefined) ??
    (item.coverUrl as string | undefined) ??
    (item.thumbnailUrl as string | undefined) ??
    (item.videoThumbnail as string | undefined) ??
    undefined
  );
}

async function scrapeTikTok(url: string): Promise<ScrapeResult> {
  const client = getApifyClient();
  const resolvedUrl = await resolveFinalUrl(url);
  const run = await client.actor(ACTOR_TIKTOK).call({
    // clockworks/tiktok-video-scraper expects "postURLs".
    postURLs: [resolvedUrl],
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
  });
  const { items } = await client
    .dataset(run.defaultDatasetId)
    .listItems({ limit: 1 });

  if (!items.length) {
    console.warn("[processUrl/tiktok] No items returned for URL:", resolvedUrl);
    return {
      platform: "tiktok",
      metadata: { url, resolvedUrl, empty: true },
    };
  }

  const item = items[0] as Record<string, unknown>;
  return {
    platform: "tiktok",
    title: (item.text as string | undefined) ?? undefined,
    description: (item.text as string | undefined) ?? undefined,
    videoUrl: pickTikTokVideoUrl(item),
    thumbnailUrl: pickTikTokThumbnailUrl(item),
    authorName: (
      item.authorMeta as Record<string, unknown> | undefined
    )?.name as string | undefined,
    authorHandle: (
      item.authorMeta as Record<string, unknown> | undefined
    )?.nickName as string | undefined,
    likeCount: (item.diggCount as number | undefined) ?? undefined,
    viewCount: (item.playCount as number | undefined) ?? undefined,
    hashtags: (
      (item.hashtags as Array<{ name: string }> | undefined) ?? []
    ).map((h) => h.name),
    metadata: item,
  };
}

export const __testables = {
  pickTikTokVideoUrl,
  pickTikTokThumbnailUrl,
};

async function scrapeInstagram(url: string): Promise<ScrapeResult> {
  const client = getApifyClient();
  const run = await client.actor(ACTOR_INSTAGRAM).call({
    directUrls: [url],
    resultsType: "posts",
    resultsLimit: 1,
  });
  const { items } = await client
    .dataset(run.defaultDatasetId)
    .listItems({ limit: 1 });

  if (!items.length) {
    console.warn("[processUrl/instagram] No items returned for URL:", url);
    return { platform: "instagram", metadata: { url, empty: true } };
  }

  const item = items[0] as Record<string, unknown>;
  return {
    platform: "instagram",
    title: (item.caption as string | undefined) ?? undefined,
    description: (item.caption as string | undefined) ?? undefined,
    videoUrl: (item.videoUrl as string | undefined) ?? undefined,
    thumbnailUrl: (item.displayUrl as string | undefined) ?? undefined,
    authorName: (item.ownerFullName as string | undefined) ?? undefined,
    authorHandle: (item.ownerUsername as string | undefined) ?? undefined,
    likeCount: (item.likesCount as number | undefined) ?? undefined,
    viewCount: (item.videoViewCount as number | undefined) ?? undefined,
    hashtags: ((item.hashtags as string[] | undefined) ?? []),
    metadata: item,
  };
}

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

// ─── Gemini AI ────────────────────────────────────────────────────────────────

const FLASH_MODEL = "gemini-2.5-flash";
const PRO_MODEL = "gemini-2.5-pro";

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

function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenerativeAI(apiKey);
}

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
    const contentType = response.headers.get("content-type") ?? "video/mp4";
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(tmpPath, buffer);
    console.log(`[gemini/video] Video written to ${tmpPath} (${buffer.length} bytes)`);

    const fileManager = new GoogleAIFileManager(apiKey);
    console.log(`[gemini/video] Uploading to Gemini Files API...`);
    const uploadResult = await fileManager.uploadFile(tmpPath, {
      mimeType: contentType,
      displayName: `fileaway-${itemId}`,
    });
    console.log(`[gemini/video] Uploaded — uri: ${uploadResult.file.uri}`);

    const { FileState } = await import("@google/generative-ai/server");

    let file = uploadResult.file;
    while (file.state === FileState.PROCESSING) {
      await new Promise((r) => setTimeout(r, 2000));
      file = await fileManager.getFile(file.name);
      console.log(`[gemini/video] File state: ${file.state}`);
    }
    if (file.state === FileState.FAILED) {
      console.warn(`[gemini/video] File processing failed`);
      return null;
    }

    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: PRO_MODEL,
      generationConfig: { temperature: 0 },
    });

    const t0 = Date.now();
    const result = await model.generateContent([
      {
        fileData: {
          fileUri: file.uri,
          mimeType: file.mimeType ?? "video/mp4",
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

async function categorizeContent(
  ctx: { runQuery: (ref: any, args: any) => Promise<any> },
  scrape: ScrapeResult,
): Promise<CategoryType> {
  console.log(`[gemini/categorize] Starting — model: ${FLASH_MODEL}, platform: ${scrape.platform}`);
  console.log(`[gemini/categorize] Input — title: ${scrape.title ?? "(none)"}, description: ${(scrape.description ?? "").slice(0, 200)}, hashtags: ${(scrape.hashtags ?? []).join(", ") || "(none)"}`);

  const dbCategories = await ctx.runQuery(internal.adminCategories.listCategorySlugsAndHints, {});
  if (!dbCategories.length) {
    console.warn(`[gemini/categorize] No categories found in DB, defaulting to "other"`);
    return "other";
  }

  const validSlugs = dbCategories.map((c: { slug: string }) => c.slug);
  const guidelines = dbCategories.map(
    (c: { slug: string; categorizationHint: string }) => `- ${c.slug}: ${c.categorizationHint}`,
  );

  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: FLASH_MODEL,
    generationConfig: { temperature: 0 },
  });

  const parts: string[] = [
    "You are classifying a saved social media post. Respond with ONLY one of these exact category labels — no explanation:",
    validSlugs.join(" | "),
    "",
    "Guidelines:",
    ...guidelines,
    "",
    "Post content:",
  ];

  if (scrape.title) parts.push(`Title: ${scrape.title}`);
  if (scrape.description && scrape.description !== scrape.title) {
    parts.push(`Description: ${scrape.description}`);
  }
  if (scrape.hashtags?.length) {
    parts.push(`Hashtags: ${scrape.hashtags.join(", ")}`);
  }
  parts.push(`Platform: ${scrape.platform}`);

  const t0 = Date.now();
  let result;
  try {
    result = await model.generateContent(parts.join("\n"));
  } catch (err) {
    console.error(`[gemini/categorize] API error after ${Date.now() - t0}ms — model: ${FLASH_MODEL}`, err);
    throw err;
  }
  const raw = result.response.text().trim().toLowerCase();
  console.log(`[gemini/categorize] Response in ${Date.now() - t0}ms — raw: "${raw}"`);

  const matched = validSlugs.find((c: string) => raw.includes(c));
  if (!matched) {
    console.warn(`[gemini/categorize] No valid category matched in response, defaulting to "other"`);
  }
  return matched ?? "other";
}

interface ExtractionResult {
  category: CategoryType;
  extractedData: Record<string, unknown>;
  actionTaken: string;
}

export const WRAPPER_INSTRUCTIONS = `You are extracting structured data from a saved social media post. Your job is to be thorough and complete — extract EVERYTHING visible or inferable.

CRITICAL RULES:
- For ALL array fields (exercises, ingredients, steps, dishes, tools): extract EVERY item shown, mentioned, or clearly implied. Never stop early. Never truncate. If 6 exercises are shown, return all 6. If 10 ingredients are listed, return all 10.
- Never return null for a string field if you can make a reasonable inference from hashtags, emojis, author name, platform context, or visual cues.
- Infer missing numeric values from context (e.g. duration from number of exercises × typical set time).
- Prefer a specific inferred value over null — e.g. infer cuisine from #italian or #pasta, infer location from @restaurantname or city hashtags.
- If the caption is brief or emoji-heavy, use ALL available signals: hashtags, creator handle, audio cues described, on-screen text, and common knowledge about the content type.`;

function buildExtractionPrompt(
  scrape: ScrapeResult,
  category: CategoryType,
  extractionPrompt: string,
): string {
  const contentBlock = [
    `Platform: ${scrape.platform}`,
    scrape.title ? `Title: ${scrape.title}` : null,
    scrape.description && scrape.description !== scrape.title
      ? `Description: ${scrape.description}`
      : null,
    scrape.authorHandle ? `Author: @${scrape.authorHandle}` : null,
    scrape.hashtags?.length ? `Hashtags: ${scrape.hashtags.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    `${WRAPPER_INSTRUCTIONS}`,
    `Category: ${category}`,
    "",
    extractionPrompt,
    "",
    "Post content:",
    contentBlock,
    "",
    "Return ONLY valid JSON matching the schema above. No markdown fences, no explanation, no extra fields.",
  ].join("\n");
}

const BUILT_IN_ACTIONS: Record<string, string> = {
  food: "Save to Google Maps",
  recipe: "Export ingredient list",
  fitness: "Add to my routine",
  "how-to": "Save as guide",
  "video-analysis": "Save transcript",
  other: "Save for later",
};

function getDefaultAction(category: CategoryType): string {
  return BUILT_IN_ACTIONS[category] ?? "Save for later";
}

async function extractStructuredData(
  ctx: { runQuery: (ref: any, args: any) => Promise<any> },
  scrape: ScrapeResult,
  category: CategoryType,
  itemId: string,
): Promise<ExtractionResult> {
  // Video analysis path: use Gemini Files API with actual video
  if (shouldUseVideoAnalysis(category, scrape.platform, scrape.videoUrl)) {
    console.log(`[gemini/extract] Using video analysis path — platform: ${scrape.platform}`);
    const videoData = await extractWithVideo(scrape.videoUrl!, itemId);
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
  const model = client.getGenerativeModel({
    model: modelName,
    generationConfig: { temperature: 0 },
  });

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

// ─── Main action ──────────────────────────────────────────────────────────────

export const processItem = internalAction({
  args: {
    savedItemId: v.id("savedItems"),
    url: v.string(),
    overrideCategory: v.optional(v.string()),
  },
  handler: async (ctx, { savedItemId, url, overrideCategory }) => {
    console.log(
      `[processUrl] Processing item ${savedItemId} — url: ${url}`,
    );

    // Mark as processing
    await ctx.runMutation(internal.items.markProcessing, {
      id: savedItemId,
    });

    const pipelineStart = Date.now();
    try {
      const platform = detectPlatform(url);
      console.log(`[processUrl] Detected platform: ${platform}`);

      console.log(`[processUrl] Scraping url via Apify...`);
      const scrapeStart = Date.now();
      const scrapeResult = await scrapeUrl(url, platform);
      console.log(`[processUrl] Scrape complete in ${Date.now() - scrapeStart}ms — platform: ${platform}, title: ${scrapeResult.title ?? "(none)"}, hasVideo: ${!!scrapeResult.videoUrl}, hashtags: ${(scrapeResult.hashtags ?? []).length}`);

      console.log(`[processUrl] Categorizing content...`);
      const category = overrideCategory ?? await categorizeContent(ctx, scrapeResult);
      console.log(`[processUrl] Category resolved: ${category}`);

      console.log(`[processUrl] Extracting structured data...`);
      const extraction = await extractStructuredData(ctx, scrapeResult, category, savedItemId);
      console.log(`[processUrl] Extraction complete — category: ${extraction.category}, action: ${extraction.actionTaken}, dataKeys: ${Object.keys(extraction.extractedData).join(", ")}`);

      // Download thumbnail and upload to Convex storage
      let thumbnailStorageId: Id<"_storage"> | undefined;
      if (scrapeResult.thumbnailUrl) {
        try {
          console.log(`[processUrl] Downloading thumbnail from CDN...`);
          const imgResponse = await fetch(scrapeResult.thumbnailUrl);
          if (imgResponse.ok) {
            const blob = await imgResponse.blob();
            const storageId = await ctx.storage.store(blob);
            thumbnailStorageId = storageId;
            console.log(`[processUrl] Thumbnail stored — storageId: ${storageId}`);
          } else {
            console.warn(`[processUrl] Thumbnail download failed — status: ${imgResponse.status}`);
          }
        } catch (thumbErr) {
          console.warn(`[processUrl] Thumbnail download error:`, thumbErr);
        }
      }

      await ctx.runMutation(internal.items.updateResult, {
        id: savedItemId,
        platform,
        category,
        rawContent: scrapeResult.metadata,
        extractedData: extraction.extractedData,
        actionTaken: extraction.actionTaken,
        thumbnailStorageId,
      });

      console.log(`[processUrl] Item ${savedItemId} done in ${Date.now() - pipelineStart}ms`);
    } catch (err) {
      const elapsed = Date.now() - pipelineStart;
      console.error(`[processUrl] Item ${savedItemId} failed after ${elapsed}ms:`, err);
      await ctx.runMutation(internal.items.markFailed, { id: savedItemId });
    }
  },
});

/** Downloads thumbnails from CDN URLs and stores them in Convex for existing items. */
export const backfillThumbnails = internalAction({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.runQuery(internal.items.listItemsNeedingThumbnail);
    console.log(`[backfill] Found ${items.length} items needing thumbnail storage`);

    let success = 0;
    let failed = 0;
    for (const item of items) {
      try {
        const response = await fetch(item.cdnUrl);
        if (!response.ok) {
          console.warn(`[backfill] ${item.id} — HTTP ${response.status}`);
          failed++;
          continue;
        }
        const blob = await response.blob();
        const storageId = await ctx.storage.store(blob);
        await ctx.runMutation(internal.items.setThumbnailStorage, {
          id: item.id as Id<"savedItems">,
          storageId,
        });
        success++;
      } catch (err) {
        console.warn(`[backfill] ${item.id} — error:`, err);
        failed++;
      }
    }
    console.log(`[backfill] Done — ${success} stored, ${failed} failed`);
  },
});
