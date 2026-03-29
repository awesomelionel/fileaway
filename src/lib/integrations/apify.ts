/**
 * Apify integration.
 *
 * Scrapes TikTok and Instagram URLs using Apify actors.
 *
 * Actors used:
 *   - TikTok:    clockworks/tiktok-scraper
 *   - Instagram: apify/instagram-scraper
 */

import { ApifyClient } from "apify-client";
import type { PlatformType } from "@/lib/supabase/types";

// Actor IDs — override via env if needed
const ACTOR_TIKTOK = process.env.APIFY_ACTOR_TIKTOK ?? "clockworks/tiktok-scraper";
const ACTOR_INSTAGRAM = process.env.APIFY_ACTOR_INSTAGRAM ?? "apify/instagram-scraper";

export interface ScrapeResult {
  platform: PlatformType;
  title?: string;
  description?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  displayUrl?: string;
  transcript?: string;
  authorName?: string;
  authorHandle?: string;
  likeCount?: number;
  viewCount?: number;
  hashtags?: string[];
  metadata: Record<string, unknown>;
}

function getClient(): ApifyClient {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN is not configured");
  return new ApifyClient({ token });
}

// ─── TikTok ──────────────────────────────────────────────────────────────────

async function scrapeTikTok(url: string): Promise<ScrapeResult> {
  const client = getClient();

  const run = await client.actor(ACTOR_TIKTOK).call({
    postURLs: [url],
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 1 });

  if (!items.length) {
    console.warn("[apify/tiktok] No items returned for URL:", url);
    return { platform: "tiktok", metadata: { url, empty: true } };
  }

  const item = items[0] as Record<string, unknown>;

  return {
    platform: "tiktok",
    title: (item.text as string | undefined) ?? undefined,
    description: (item.text as string | undefined) ?? undefined,
    videoUrl: (item.videoUrl as string | undefined) ?? undefined,
    thumbnailUrl: (item.coverUrl as string | undefined) ?? undefined,
    authorName: (item.authorMeta as Record<string, unknown> | undefined)?.name as string | undefined,
    authorHandle: (item.authorMeta as Record<string, unknown> | undefined)?.nickName as string | undefined,
    likeCount: (item.diggCount as number | undefined) ?? undefined,
    viewCount: (item.playCount as number | undefined) ?? undefined,
    hashtags: ((item.hashtags as Array<{ name: string }> | undefined) ?? []).map((h) => h.name),
    metadata: item,
  };
}

// ─── Instagram ───────────────────────────────────────────────────────────────

async function scrapeInstagram(url: string): Promise<ScrapeResult> {
  const client = getClient();

  const run = await client.actor(ACTOR_INSTAGRAM).call({
    directUrls: [url],
    resultsType: "posts",
    resultsLimit: 1,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 1 });

  if (!items.length) {
    console.warn("[apify/instagram] No items returned for URL:", url);
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

// ─── Public API ──────────────────────────────────────────────────────────────

export async function scrapeUrl(url: string, platform: PlatformType): Promise<ScrapeResult> {
  console.log(`[apify] Scraping ${platform} URL: ${url}`);

  switch (platform) {
    case "tiktok":
      return scrapeTikTok(url);
    case "instagram":
      return scrapeInstagram(url);
    default:
      console.log(`[apify] No actor configured for platform "${platform}" — skipping`);
      return { platform, metadata: { url, note: "Platform not supported yet" } };
  }
}

export function detectPlatform(url: string): PlatformType {
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/twitter\.com|x\.com/i.test(url)) return "twitter";
  return "other";
}

export { ApifyClient };
