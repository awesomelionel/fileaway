"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { ApifyClient } from "apify-client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Id } from "./_generated/dataModel";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlatformType = "tiktok" | "instagram" | "youtube" | "twitter" | "other";
type CategoryType =
  | "food"
  | "fitness"
  | "recipe"
  | "how-to"
  | "video-analysis"
  | "other";

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
  process.env.APIFY_ACTOR_TIKTOK ?? "apidojo/tiktok-scraper";
const ACTOR_INSTAGRAM =
  process.env.APIFY_ACTOR_INSTAGRAM ?? "apify/instagram-scraper";

function getApifyClient(): ApifyClient {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN is not configured");
  return new ApifyClient({ token });
}

async function scrapeTikTok(url: string): Promise<ScrapeResult> {
  const client = getApifyClient();
  const run = await client.actor(ACTOR_TIKTOK).call({
    postURLs: [url],
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
  });
  const { items } = await client
    .dataset(run.defaultDatasetId)
    .listItems({ limit: 1 });

  if (!items.length) {
    console.warn("[processUrl/tiktok] No items returned for URL:", url);
    return { platform: "tiktok", metadata: { url, empty: true } };
  }

  const item = items[0] as Record<string, unknown>;
  return {
    platform: "tiktok",
    title: (item.text as string | undefined) ?? undefined,
    description: (item.text as string | undefined) ?? undefined,
    videoUrl: (item.videoUrl as string | undefined) ?? undefined,
    thumbnailUrl: (item.coverUrl as string | undefined) ?? undefined,
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

const VALID_CATEGORIES: CategoryType[] = [
  "food",
  "fitness",
  "recipe",
  "how-to",
  "video-analysis",
  "other",
];

function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenerativeAI(apiKey);
}

async function categorizeContent(
  scrape: ScrapeResult,
): Promise<CategoryType> {
  console.log(`[gemini/categorize] Starting — model: ${FLASH_MODEL}, platform: ${scrape.platform}`);
  console.log(`[gemini/categorize] Input — title: ${scrape.title ?? "(none)"}, description: ${(scrape.description ?? "").slice(0, 200)}, hashtags: ${(scrape.hashtags ?? []).join(", ") || "(none)"}`);

  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: FLASH_MODEL });

  const parts: string[] = [
    "You are classifying a saved social media post. Respond with ONLY one of these exact category labels — no explanation:",
    "food | recipe | fitness | how-to | video-analysis | other",
    "",
    "Guidelines:",
    "- food: restaurants, food spots, dishes to try, cafe/bar recommendations",
    "- recipe: cooking instructions, ingredients lists, baking steps",
    "- fitness: workouts, exercise routines, gym tips, sports drills",
    "- how-to: tutorials, life hacks, DIY projects, step-by-step guides (non-recipe)",
    "- video-analysis: general video content where full analysis is needed",
    "- other: everything else",
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

  const matched = VALID_CATEGORIES.find((c) => raw.includes(c));
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

function buildExtractionPrompt(
  scrape: ScrapeResult,
  category: CategoryType,
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

  const schemas: Record<CategoryType, string> = {
    food: `Return JSON:
{
  "name": "<restaurant or food item name>",
  "address": "<full address if mentioned, else null>",
  "cuisine": "<cuisine type>",
  "why_visit": "<one-sentence reason to visit>",
  "price_range": "<$ | $$ | $$$ | null>",
  "dishes_mentioned": ["<dish1>", "<dish2>"]
}`,
    recipe: `Return JSON:
{
  "dish_name": "<name of the dish>",
  "ingredients": ["<ingredient with quantity>"],
  "steps": ["<step 1>", "<step 2>"],
  "prep_time_minutes": <number or null>,
  "cook_time_minutes": <number or null>,
  "servings": <number or null>
}`,
    fitness: `Return JSON:
{
  "workout_name": "<name or description>",
  "exercises": [{"name": "<exercise>", "sets": <number or null>, "reps": <number or null>}],
  "muscle_groups": ["<muscle group>"],
  "duration_minutes": <number or null>,
  "difficulty": "<beginner | intermediate | advanced | null>"
}`,
    "how-to": `Return JSON:
{
  "title": "<short descriptive title of what this guide teaches — infer from hashtags or context if not explicit>",
  "summary": "<one sentence describing the outcome or main benefit of following this guide>",
  "steps": ["<step 1>", "<step 2>", "<step 3 — infer likely steps from context if not all listed>"],
  "tools_needed": ["<tool or material — omit array if none mentioned>"],
  "difficulty": "<easy | medium | hard | null>",
  "time_required": "<estimated time as a string, e.g. '10 minutes' — null if unknown>"
}`,
    "video-analysis": `Return JSON:
{
  "summary": "<2-3 sentence summary of the video content>",
  "key_points": ["<key point 1>", "<key point 2>"],
  "topics": ["<topic>"],
  "sentiment": "<positive | neutral | negative>"
}`,
    other: `Return JSON:
{
  "summary": "<brief description of the content>",
  "topics": ["<topic>"]
}`,
  };

  return [
    `You are extracting structured data from a saved social media post. Category: ${category}`,
    "",
    schemas[category],
    "",
    "Post content:",
    contentBlock,
    "",
    "Return ONLY valid JSON, no markdown, no explanation.",
  ].join("\n");
}

function getDefaultAction(category: CategoryType): string {
  const actions: Record<CategoryType, string> = {
    food: "Save to Google Maps",
    recipe: "Export ingredient list",
    fitness: "Add to my routine",
    "how-to": "Save as guide",
    "video-analysis": "Save transcript",
    other: "Save for later",
  };
  return actions[category];
}

async function extractStructuredData(
  scrape: ScrapeResult,
  category: CategoryType,
): Promise<ExtractionResult> {
  const useProModel = ["food", "recipe", "fitness"].includes(category);
  const modelName = useProModel ? PRO_MODEL : FLASH_MODEL;
  console.log(`[gemini/extract] Starting — model: ${modelName}, category: ${category}, useProModel: ${useProModel}`);

  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: modelName });

  const prompt = buildExtractionPrompt(scrape, category);
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
  },
  handler: async (ctx, { savedItemId, url }) => {
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
      const category = await categorizeContent(scrapeResult);
      console.log(`[processUrl] Category resolved: ${category}`);

      console.log(`[processUrl] Extracting structured data...`);
      const extraction = await extractStructuredData(scrapeResult, category);
      console.log(`[processUrl] Extraction complete — category: ${extraction.category}, action: ${extraction.actionTaken}, dataKeys: ${Object.keys(extraction.extractedData).join(", ")}`);

      await ctx.runMutation(internal.items.updateResult, {
        id: savedItemId,
        platform,
        category,
        rawContent: scrapeResult.metadata,
        extractedData: extraction.extractedData,
        actionTaken: extraction.actionTaken,
      });

      console.log(`[processUrl] Item ${savedItemId} done in ${Date.now() - pipelineStart}ms`);
    } catch (err) {
      const elapsed = Date.now() - pipelineStart;
      console.error(`[processUrl] Item ${savedItemId} failed after ${elapsed}ms:`, err);
      await ctx.runMutation(internal.items.markFailed, { id: savedItemId });
    }
  },
});
