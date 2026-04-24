"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { ApifyClient } from "apify-client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as fs from "fs/promises";
import * as path from "path";
import type { Id } from "./_generated/dataModel";
import { captureServer, SERVER_EVENTS } from "./analytics";

async function emitAiGeneration(
  distinctId: string,
  props: {
    item_id: string;
    category: string | null;
    model: string;
    span: "categorize" | "extract" | "extract_video";
    latency_ms: number;
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    error?: string;
  },
) {
  await captureServer({
    distinctId,
    event: SERVER_EVENTS.LLM_GENERATION,
    properties: {
      $ai_provider: "google",
      $ai_model: props.model,
      $ai_latency: props.latency_ms / 1000,
      $ai_input_tokens: props.input_tokens ?? null,
      $ai_output_tokens: props.output_tokens ?? null,
      $ai_total_tokens: props.total_tokens ?? null,
      $ai_is_error: !!props.error,
      $ai_error: props.error ?? null,
      item_id: props.item_id,
      category: props.category,
      span: props.span,
    },
  });
}

function getR2Client(): S3Client {
  const raw = process.env.R2_ENDPOINT_URL ?? "";
  const endpoint = raw.startsWith("https://") ? raw : `https://${raw}`;
  return new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });
}

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

export interface XApiTweet {
  data: {
    id: string;
    text: string;
    author_id: string;
    created_at?: string;
    public_metrics?: {
      like_count: number;
      retweet_count: number;
      reply_count: number;
      impression_count: number;
      bookmark_count?: number;
    };
    entities?: {
      hashtags?: Array<{ tag: string }>;
    };
    attachments?: {
      media_keys?: string[];
    };
  };
  includes?: {
    users?: Array<{ id: string; name: string; username: string }>;
    media?: Array<{
      media_key: string;
      type: string;
      url?: string;
      preview_image_url?: string;
    }>;
  };
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

export function extractTweetId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/);
  return match ? match[1] : null;
}

export function mapXApiTweetToScrapeResult(
  response: XApiTweet,
  originalUrl: string,
): ScrapeResult {
  const tweet = response.data;
  const author = response.includes?.users?.find((u) => u.id === tweet.author_id);
  const tweetText = (tweet.text ?? "").trim();
  const hashtags = (tweet.entities?.hashtags ?? []).map((h) => h.tag);

  const mediaKeys = tweet.attachments?.media_keys ?? [];
  const allMedia = response.includes?.media ?? [];
  const firstMedia = allMedia.find((m) => mediaKeys.includes(m.media_key));
  const thumbnailUrl =
    firstMedia?.preview_image_url ??
    (firstMedia?.type === "photo" ? firstMedia.url : undefined);

  return {
    platform: "twitter",
    title: tweetText || undefined,
    description: tweetText || undefined,
    thumbnailUrl,
    authorName: author?.name,
    authorHandle: author?.username,
    likeCount: tweet.public_metrics?.like_count,
    viewCount: tweet.public_metrics?.impression_count,
    hashtags: hashtags.length ? hashtags : undefined,
    metadata: {
      url: originalUrl,
      twitterId: tweet.id,
      retweetCount: tweet.public_metrics?.retweet_count,
      replyCount: tweet.public_metrics?.reply_count,
      bookmarkCount: tweet.public_metrics?.bookmark_count,
      createdAt: tweet.created_at,
      xApiResponse: response,
    },
  };
}

async function scrapeTwitter(url: string): Promise<ScrapeResult> {
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) throw new Error("X_BEARER_TOKEN is not configured");

  const tweetId = extractTweetId(url);
  if (!tweetId) {
    console.warn(`[processUrl/twitter] Could not extract tweet ID from URL: ${url}`);
    return { platform: "twitter", metadata: { url, error: "invalid_url" } };
  }

  console.log(`[processUrl/twitter] Fetching tweet ${tweetId} via X API`);

  const params = new URLSearchParams({
    "tweet.fields": "text,author_id,created_at,public_metrics,entities,attachments",
    "expansions": "author_id,attachments.media_keys",
    "user.fields": "name,username",
    "media.fields": "url,preview_image_url,type",
  });

  const response = await fetch(
    `https://api.x.com/2/tweets/${tweetId}?${params}`,
    { headers: { Authorization: `Bearer ${bearerToken}` } },
  );

  if (!response.ok) {
    const body = await response.text();
    console.warn(`[processUrl/twitter] X API error — HTTP ${response.status}: ${body}`);
    return { platform: "twitter", metadata: { url, error: `http_${response.status}` } };
  }

  const xResponse = await response.json() as XApiTweet;
  if (!xResponse.data?.text) {
    console.warn(`[processUrl/twitter] X API returned empty tweet data for: ${url}`);
    return { platform: "twitter", metadata: { url, empty: true } };
  }

  const result = mapXApiTweetToScrapeResult(xResponse, url);
  console.log(
    `[processUrl/twitter] Done — author: @${result.authorHandle ?? "unknown"}, ` +
    `text: ${xResponse.data.text.length} chars, hasMedia: ${!!(xResponse.includes?.media?.length)}`,
  );
  return result;
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
    case "twitter":
      return scrapeTwitter(url);
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
    (category === "video-analysis" || category === "travel") &&
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

const TRAVEL_VIDEO_PROMPT = `You are analyzing a travel video. Watch it carefully and extract EVERY distinct location/place shown or clearly implied.

Return a JSON object with exactly this structure:

{
  "title": "<short descriptive title for the travel video>",
  "summary": "<2-3 sentence overview of the route / destination / vibe>",
  "primary_location": "<city/region/country if inferable, else null>",
  "itinerary": [
    {
      "order": "<1..N in the sequence shown>",
      "timestamp": "<approximate timestamp e.g. '0:05' — null if unknown>",
      "name": "<place name (POI, neighborhood, viewpoint, museum, cafe, etc.)>",
      "type": "<attraction | neighborhood | viewpoint | cafe | restaurant | hotel | beach | hike | market | museum | transit | other>",
      "location_text": "<city + area, or best available location description>",
      "what_you_see": "<1 sentence describing what is shown here>",
      "why_go": "<1 sentence describing why a traveler should go>",
      "google_maps_query": "<a query string that would find it in Google Maps>",
      "google_maps_url": "<https://maps.google.com/?q=... built from name + location_text>",
      "tips": ["<0-5 practical tips: timing, tickets, reservations, costs, crowds, best photo spot, etc.>"]
    }
  ],
  "highlights": ["<3-10 standout moments/places>"],
  "bullets": ["<5-15 bullet points in chronological order capturing the itinerary and key context>"]
}

Guidelines:
- Include 3 to 12 itinerary stops if present. If the video shows more, include them all.
- Prefer specific proper names from on-screen text/signage. If you cannot identify the exact name, use a descriptive placeholder and make google_maps_query as findable as possible.
- Return ONLY valid JSON. No markdown fences, no explanation, no extra fields.`;

async function extractWithVideo(
  videoUrl: string,
  itemId: string,
  distinctId: string,
  category: string,
  prompt: string = VIDEO_ANALYSIS_PROMPT,
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const tmpPath = path.join("/tmp", `fileaway-video-${itemId}.mp4`);
  const t0 = Date.now();

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

    const result = await model.generateContent([
      {
        fileData: {
          fileUri: file.uri,
          mimeType: file.mimeType ?? "video/mp4",
        },
      },
      prompt,
    ]);
    const videoUsage = (result.response as unknown as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } }).usageMetadata;
    await emitAiGeneration(distinctId, {
      item_id: itemId,
      category,
      model: PRO_MODEL,
      span: "extract_video",
      latency_ms: Date.now() - t0,
      input_tokens: videoUsage?.promptTokenCount,
      output_tokens: videoUsage?.candidatesTokenCount,
      total_tokens: videoUsage?.totalTokenCount,
    });
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
    await emitAiGeneration(distinctId, {
      item_id: itemId,
      category,
      model: PRO_MODEL,
      span: "extract_video",
      latency_ms: Date.now() - t0,
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}

async function categorizeContent(
  ctx: { runQuery: (ref: any, args: any) => Promise<any> },
  scrape: ScrapeResult,
  itemId: string,
  distinctId: string,
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
    await emitAiGeneration(distinctId, {
      item_id: itemId,
      category: null,
      model: FLASH_MODEL,
      span: "categorize",
      latency_ms: Date.now() - t0,
      error: err instanceof Error ? err.message : "unknown",
    });
    throw err;
  }
  const raw = result.response.text().trim().toLowerCase();
  const catUsage = (result.response as unknown as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } }).usageMetadata;
  await emitAiGeneration(distinctId, {
    item_id: itemId,
    category: null,
    model: FLASH_MODEL,
    span: "categorize",
    latency_ms: Date.now() - t0,
    input_tokens: catUsage?.promptTokenCount,
    output_tokens: catUsage?.candidatesTokenCount,
    total_tokens: catUsage?.totalTokenCount,
  });
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
- For ALL array fields (exercises, ingredients, steps, dishes, tools, shots, takeaways): extract EVERY item shown, mentioned, or clearly implied. Never stop early. Never truncate. If 6 exercises are shown, return all 6. If 10 ingredients are listed, return all 10. If a how-to has 12 distinct beats, return 12 shots.
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
    "Additional required fields:",
    '- Always include "bullets": an array of 3-15 short bullet points summarizing the key details (chronological if applicable).',
    '- If category is "how-to", "video-analysis", or "other", also include "shots": an array of scene/moment objects with { timestamp (string|null), description, detail }. For how-to and video-analysis, use one shot per distinct beat or scene in order; infer from caption/hashtags/on-screen text if you lack video frames.',
    "",
    "Post content:",
    contentBlock,
    "",
    'Return ONLY valid JSON matching the schema above. No markdown fences, no explanation, no extra fields.',
    'Important: string values must be valid JSON strings. Do NOT include raw double-quotes inside a string value unless you escape them (use \\"like this\\"). Prefer avoiding quotes entirely.',
  ].join("\n");
}

const BUILT_IN_ACTIONS: Record<string, string> = {
  food: "Save to Google Maps",
  recipe: "Export ingredient list",
  fitness: "Add to my routine",
  "how-to": "Save as guide",
  "video-analysis": "Save transcript",
  travel: "Open itinerary in Maps",
  other: "Save for later",
};

const BUILT_IN_EXTRACTION_PROMPTS: Record<string, string> = {
  food: `Extract ALL details about this restaurant or food spot. Return JSON:
{
  "name": "<restaurant or food item name>",
  "address": "<full address; infer city/neighbourhood from hashtags or handle; null only if truly unknown>",
  "cuisine": "<cuisine type>",
  "why_visit": "<the most compelling reason to visit, based on what's shown>",
  "price_range": "<$ | $$ | $$$ — infer from context if not stated>",
  "dishes_mentioned": ["<every dish, drink, or food item shown or mentioned>"],
  "bullets": ["<3-10 short key details as bullet points: what to order, vibe, location hints, pricing clues, etc.>"],
  "hours": "<opening hours if mentioned, else null>",
  "phone": "<phone number if mentioned, else null>"
}`,
  recipe: `Extract ALL details from this recipe video or post. Return JSON:
{
  "dish_name": "<name of the dish>",
  "ingredients": ["<every ingredient with quantity and unit — list ALL of them>"],
  "steps": ["<every step in order — list ALL of them>"],
  "bullets": ["<3-10 short key details as bullet points: tips, substitutions, temps, texture cues, etc.>"],
  "prep_time_minutes": "<number or null>",
  "cook_time_minutes": "<number or null>",
  "servings": "<number or null>",
  "cuisine": "<cuisine type if known>",
  "dietary_tags": ["<e.g. vegan, gluten-free, dairy-free — infer from ingredients>"]
}
IMPORTANT: List EVERY ingredient and EVERY step. Never truncate.`,
  fitness: `Extract ALL details from this fitness/workout video. Return JSON:
{
  "workout_name": "<descriptive name of the workout>",
  "exercises": [
    {
      "name": "<exercise name>",
      "sets": "<number>",
      "reps": "<number or range e.g. '10-12'>",
      "notes": "<form tip, tempo, or variation if mentioned>"
    }
  ],
  "muscle_groups": ["<every muscle group targeted>"],
  "equipment": ["<every piece of equipment shown or mentioned>"],
  "bullets": ["<3-10 short key details as bullet points: cues, common mistakes, progression/regression, etc.>"],
  "duration_minutes": "<total estimated duration as number>",
  "difficulty": "<beginner | intermediate | advanced>",
  "rest_between_sets": "<rest period if mentioned, else null>"
}
IMPORTANT: List EVERY exercise shown or performed. Do not stop after 2-3. If 6 exercises are demonstrated, return all 6.`,
  "how-to": `Extract ALL details from this how-to or tutorial. Use the same JSON shape and depth as a full video analysis: chronological beats ("shots"), rich summary, actionable takeaways, and memorable key points. Return JSON:
{
  "title": "<short descriptive title>",
  "summary": "<2-3 sentence summary of the full tutorial: what you will achieve, who it suits, and how the sequence flows>",
  "shots": [
    {
      "timestamp": "<approximate timestamp e.g. '0:05' — infer sequence if unknown>",
      "description": "<one-line label for this beat (prep, technique, troubleshooting, wrap-up, etc.)>",
      "detail": "<1-2 sentences: the specific action, tools/materials/settings involved, and why this beat matters>"
    }
  ],
  "bullets": ["<5-15 short bullet points in chronological order: measurements, materials, app settings, safety, order of operations — be exhaustive>"],
  "takeaways": ["<specific actionable items the viewer can do after following this>"],
  "key_points": ["<insights, pro tips, warnings, shortcuts, difficulty or time estimates, common mistakes — one string each>"],
  "topics": ["<topic tags>"]
}
Include one shot per distinct instructional beat in order — list ALL beats (never truncate; if twelve steps are implied, return twelve shots). Include at least 3 shots and 3 takeaways when the content supports it; add more whenever the tutorial has more beats or outcomes. Put tools/materials/app names inside shot detail and key_points as appropriate. Infer shots from caption/hashtags/on-screen text if no video is available.`,
  "video-analysis": `Extract ALL details from this video. Return JSON:
{
  "title": "<short descriptive title>",
  "summary": "<2-3 sentence summary of the full video>",
  "shots": [
    {
      "timestamp": "<approximate timestamp e.g. '0:05' — infer sequence if unknown>",
      "description": "<one-line label for this scene>",
      "detail": "<1-2 sentences on what happens and why it matters>"
    }
  ],
  "bullets": ["<5-15 short bullet points in chronological order capturing what happens, beat-by-beat>"],
  "takeaways": ["<specific actionable item the viewer can act on>"],
  "key_points": ["<key point or insight from the video>"],
  "topics": ["<topic tag>"]
}
Include 3-8 shots and 3-6 takeaways. Infer shots from caption/hashtags if no video available.`,
  travel: `Extract ALL travel-relevant details from this post/video. You MUST infer locations and places shown from visual cues, on-screen text, captions, hashtags, and creator context.

Return JSON:
{
  "title": "<short descriptive title>",
  "summary": "<2-3 sentence overview of the trip/route>",
  "primary_location": "<city/region/country if inferable, else null>",
  "itinerary": [
    {
      "order": "<1..N in the sequence shown>",
      "name": "<place name as shown/mentioned (POI, neighborhood, viewpoint, museum, cafe, etc.)>",
      "type": "<attraction | neighborhood | viewpoint | cafe | restaurant | hotel | beach | hike | market | museum | transit | other>",
      "location_text": "<city + area, or best available location description>",
      "why_go": "<1 sentence: what you do/see here>",
      "google_maps_query": "<a query string that would find it in Google Maps>",
      "google_maps_url": "<https://maps.google.com/?q=... built from name + location_text>",
      "tips": ["<0-5 practical tips: timing, tickets, reservations, costs, crowds, best photo spot, etc.>"]
    }
  ],
  "highlights": ["<3-10 standout moments/places>"],
  "bullets": ["<5-15 bullet points in chronological order>"]
}

Rules:
- Itinerary must include EVERY distinct place shown or clearly implied (don’t stop at 3-4).
- Always include google_maps_query and google_maps_url for each itinerary stop.
- If a stop’s exact name is unknown, use a descriptive placeholder (e.g. "Riverside night market") and make the google_maps_query as findable as possible.
- Return ONLY valid JSON. No markdown fences, no extra fields.`,
  other: `Extract the key details from this saved post. If it appears to describe a video or sequence of events, infer a shot-by-shot breakdown from captions/hashtags. Return JSON:
{
  "title": "<short descriptive title>",
  "summary": "<2-3 sentence description of what this is about>",
  "bullets": ["<3-15 bullet points of the most important details (facts, claims, steps, items, recommendations, etc.)>"],
  "shots": [
    {
      "timestamp": "<optional; set to null if unknown>",
      "description": "<one-line label for this moment/scene>",
      "detail": "<1-2 sentences describing what happens or what the caption implies>"
    }
  ],
  "topics": ["<relevant topic tags>"]
}`,
};

function getDefaultAction(category: CategoryType): string {
  return BUILT_IN_ACTIONS[category] ?? "Save for later";
}

async function extractStructuredData(
  ctx: { runQuery: (ref: any, args: any) => Promise<any> },
  scrape: ScrapeResult,
  category: CategoryType,
  itemId: string,
  distinctId: string,
): Promise<ExtractionResult> {
  // Video analysis path: use Gemini Files API with actual video
  if (shouldUseVideoAnalysis(category, scrape.platform, scrape.videoUrl)) {
    console.log(`[gemini/extract] Using video analysis path — platform: ${scrape.platform}`);
    const prompt = category === "travel" ? TRAVEL_VIDEO_PROMPT : VIDEO_ANALYSIS_PROMPT;
    const videoData = await extractWithVideo(scrape.videoUrl!, itemId, distinctId, category, prompt);
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
  // Prefer cockpit/DB prompt (so edits take effect), fall back to built-in defaults.
  const extractionPrompt = categoryRow?.extractionPrompt ??
  BUILT_IN_EXTRACTION_PROMPTS[category] ??
    `Return JSON:\n{\n  "title": "<short descriptive title>",\n  "summary": "<2-3 sentence description>",\n  "topics": ["<topic tag>"]\n}`;

  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0,
      // Instruct Gemini SDK to return machine-parseable JSON.
      // This is best-effort (model can still misbehave), so we still keep the parse fallback below.
      responseMimeType: "application/json",
    },
  });

  const prompt = buildExtractionPrompt(scrape, category, extractionPrompt);
  console.log(`[gemini/extract] Prompt length: ${prompt.length} chars`);

  const t0 = Date.now();
  let result;
  try {
    result = await model.generateContent(prompt);
  } catch (err) {
    console.error(`[gemini/extract] API error after ${Date.now() - t0}ms — model: ${modelName}, category: ${category}`, err);
    await emitAiGeneration(distinctId, {
      item_id: itemId,
      category,
      model: modelName,
      span: "extract",
      latency_ms: Date.now() - t0,
      error: err instanceof Error ? err.message : "unknown",
    });
    throw err;
  }
  const raw = result.response.text().trim();
  const extractUsage = (result.response as unknown as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } }).usageMetadata;
  await emitAiGeneration(distinctId, {
    item_id: itemId,
    category,
    model: modelName,
    span: "extract",
    latency_ms: Date.now() - t0,
    input_tokens: extractUsage?.promptTokenCount,
    output_tokens: extractUsage?.candidatesTokenCount,
    total_tokens: extractUsage?.totalTokenCount,
  });
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
    distinctId: v.string(),
  },
  handler: async (ctx, { savedItemId, url, overrideCategory, distinctId }) => {
    console.log(`[processUrl] Processing item ${savedItemId} — url: ${url}`);
    await ctx.runMutation(internal.items.markProcessing, { id: savedItemId });

    const pipelineStart = Date.now();
    const platform = detectPlatform(url);
    let urlHostname = "invalid";
    try {
      urlHostname = new URL(url).hostname;
    } catch {
      // leave as invalid
    }

    await captureServer({
      distinctId,
      event: SERVER_EVENTS.ITEM_PROCESSING_STARTED,
      properties: { item_id: savedItemId, platform, url_host: urlHostname },
    });

    try {
      console.log(`[processUrl] Scraping url via Apify...`);
      const scrapeStart = Date.now();
      let scrapeResult;
      try {
        scrapeResult = await scrapeUrl(url, platform);
      } catch (scrapeErr) {
        await captureServer({
          distinctId,
          event: SERVER_EVENTS.ITEM_SCRAPE_FAILED,
          properties: {
            item_id: savedItemId,
            platform,
            duration_ms: Date.now() - scrapeStart,
            error_message: scrapeErr instanceof Error ? scrapeErr.message : "unknown",
          },
        });
        throw scrapeErr;
      }
      await captureServer({
        distinctId,
        event: SERVER_EVENTS.ITEM_SCRAPE_COMPLETED,
        properties: {
          item_id: savedItemId,
          platform,
          duration_ms: Date.now() - scrapeStart,
          has_title: !!scrapeResult.title,
          has_description: !!scrapeResult.description,
          has_video: !!scrapeResult.videoUrl,
          has_thumbnail: !!scrapeResult.thumbnailUrl,
          description_chars: (scrapeResult.description ?? "").length,
          hashtag_count: (scrapeResult.hashtags ?? []).length,
        },
      });
      console.log(`[processUrl] Scrape complete in ${Date.now() - scrapeStart}ms — platform: ${platform}, title: ${scrapeResult.title ?? "(none)"}, hasVideo: ${!!scrapeResult.videoUrl}, hashtags: ${(scrapeResult.hashtags ?? []).length}`);

      console.log(`[processUrl] Categorizing content...`);
      const categorizeStart = Date.now();
      const category = overrideCategory ?? (await categorizeContent(ctx, scrapeResult, savedItemId, distinctId));
      await captureServer({
        distinctId,
        event: SERVER_EVENTS.ITEM_CATEGORIZED,
        properties: {
          item_id: savedItemId,
          platform,
          category,
          was_override: !!overrideCategory,
          duration_ms: Date.now() - categorizeStart,
        },
      });
      console.log(`[processUrl] Category resolved: ${category}`);

      console.log(`[processUrl] Extracting structured data...`);
      const extractStart = Date.now();
      let extraction;
      try {
        extraction = await extractStructuredData(ctx, scrapeResult, category, savedItemId, distinctId);
      } catch (extractErr) {
        await captureServer({
          distinctId,
          event: SERVER_EVENTS.ITEM_EXTRACTION_FAILED,
          properties: {
            item_id: savedItemId,
            platform,
            category,
            duration_ms: Date.now() - extractStart,
            error_message: extractErr instanceof Error ? extractErr.message : "unknown",
          },
        });
        throw extractErr;
      }
      const extractedKeys = Object.keys(extraction.extractedData);
      await captureServer({
        distinctId,
        event: SERVER_EVENTS.ITEM_EXTRACTION_COMPLETED,
        properties: {
          item_id: savedItemId,
          platform,
          category: extraction.category,
          duration_ms: Date.now() - extractStart,
          extracted_field_count: extractedKeys.length,
          parse_error: extractedKeys.includes("parse_error"),
        },
      });
      console.log(`[processUrl] Extraction complete — category: ${extraction.category}, action: ${extraction.actionTaken}, dataKeys: ${extractedKeys.join(", ")}`);

      let thumbnailR2Key: string | undefined;
      if (scrapeResult.thumbnailUrl) {
        try {
          console.log(`[processUrl] Downloading thumbnail from CDN...`);
          const imgResponse = await fetch(scrapeResult.thumbnailUrl);
          if (imgResponse.ok) {
            const blob = await imgResponse.blob();
            const r2Key = `thumbs/${savedItemId}`;
            const s3 = getR2Client();
            await s3.send(new PutObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: r2Key,
              Body: Buffer.from(await blob.arrayBuffer()),
              ContentType: blob.type,
              CacheControl: "public, max-age=31536000, immutable",
            }));
            thumbnailR2Key = r2Key;
            console.log(`[processUrl] Thumbnail uploaded to R2 — key: ${r2Key}`);
          } else {
            console.warn(`[processUrl] Thumbnail download failed — status: ${imgResponse.status}`);
          }
        } catch (thumbErr) {
          console.warn(`[processUrl] Thumbnail upload error:`, thumbErr);
        }
      }

      await ctx.runMutation(internal.items.updateResult, {
        id: savedItemId,
        platform,
        category,
        rawContent: scrapeResult.metadata,
        extractedData: extraction.extractedData,
        actionTaken: extraction.actionTaken,
        thumbnailR2Key,
      });

      console.log(`[processUrl] Item ${savedItemId} done in ${Date.now() - pipelineStart}ms`);
    } catch (err) {
      const elapsed = Date.now() - pipelineStart;
      console.error(`[processUrl] Item ${savedItemId} failed after ${elapsed}ms:`, err);
      await captureServer({
        distinctId,
        event: SERVER_EVENTS.ITEM_PROCESSING_FAILED,
        properties: {
          item_id: savedItemId,
          platform,
          duration_ms: elapsed,
          error_message: err instanceof Error ? err.message : "unknown",
        },
      });
      await ctx.runMutation(internal.items.markFailed, { id: savedItemId });
    }
  },
});

/** Downloads thumbnails from CDN URLs and stores them in R2 for existing items without an R2 key. */
export const backfillThumbnails = internalAction({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.runQuery(internal.items.listItemsNeedingThumbnail);
    console.log(`[backfill] Found ${items.length} items needing thumbnail storage`);

    let success = 0;
    let failed = 0;
    const s3 = getR2Client();
    for (const item of items) {
      try {
        const response = await fetch(item.cdnUrl);
        if (!response.ok) {
          console.warn(`[backfill] ${item.id} — HTTP ${response.status}`);
          failed++;
          continue;
        }
        const blob = await response.blob();
        const r2Key = `thumbs/${item.id}`;
        await s3.send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: r2Key,
          Body: Buffer.from(await blob.arrayBuffer()),
          ContentType: blob.type,
          CacheControl: "public, max-age=31536000, immutable",
        }));
        await ctx.runMutation(internal.items.setThumbnailR2Key, {
          id: item.id as Id<"savedItems">,
          r2Key,
        });
        success++;
      } catch (err) {
        console.warn(`[backfill] ${item.id} — error:`, err);
        failed++;
      }
    }
    console.log(`[backfill] Done — ${success} stored in R2, ${failed} failed`);
  },
});

/** Migrates existing Convex storage thumbnails to R2. */
export const migrateConvexThumbnailsToR2 = internalAction({
  args: {},
  handler: async (ctx) => {
    const items: { id: string; storageUrl: string }[] = await ctx.runQuery(
      internal.items.listItemsNeedingR2Migration,
    );
    console.log(`[r2-migrate] Found ${items.length} items with Convex thumbnails to migrate`);

    let success = 0;
    let failed = 0;
    const s3 = getR2Client();
    for (const item of items) {
      try {
        const response = await fetch(item.storageUrl);
        if (!response.ok) {
          console.warn(`[r2-migrate] ${item.id} — HTTP ${response.status}`);
          failed++;
          continue;
        }
        const blob = await response.blob();
        const r2Key = `thumbs/${item.id}`;
        await s3.send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: r2Key,
          Body: Buffer.from(await blob.arrayBuffer()),
          ContentType: blob.type,
          CacheControl: "public, max-age=31536000, immutable",
        }));
        await ctx.runMutation(internal.items.setThumbnailR2Key, {
          id: item.id as Id<"savedItems">,
          r2Key,
        });
        success++;
      } catch (err) {
        console.warn(`[r2-migrate] ${item.id} — error:`, err);
        failed++;
      }
    }
    console.log(`[r2-migrate] Done — ${success} migrated to R2, ${failed} failed`);
  },
});
