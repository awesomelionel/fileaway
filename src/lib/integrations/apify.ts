/**
 * Apify integration stub.
 *
 * Handles scraping of TikTok and Instagram URLs using Apify actors.
 * Currently logs intent — wire up ApifyClient with real actor IDs when ready.
 *
 * Apify actors to use (add to .env):
 *   - TikTok: clockworks/tiktok-scraper
 *   - Instagram: apify/instagram-scraper
 */

import { ApifyClient } from "apify-client";
import type { PlatformType } from "@/lib/supabase/types";

const APIFY_ACTORS: Record<string, string> = {
  tiktok: "clockworks/tiktok-scraper",
  instagram: "apify/instagram-scraper",
};

export interface ScrapeResult {
  platform: PlatformType;
  title?: string;
  description?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  transcript?: string;
  metadata: Record<string, unknown>;
}

export async function scrapeUrl(url: string, platform: PlatformType): Promise<ScrapeResult> {
  const apiToken = process.env.APIFY_API_TOKEN;

  if (!apiToken) {
    throw new Error("APIFY_API_TOKEN is not configured");
  }

  const actorId = APIFY_ACTORS[platform];
  if (!actorId) {
    console.log(`[apify] No actor configured for platform "${platform}" — skipping scrape`);
    return {
      platform,
      metadata: { url, note: "No actor configured for this platform" },
    };
  }

  // TODO: Replace stub with actual actor run
  console.log(`[apify] Would run actor "${actorId}" for URL: ${url}`);
  console.log(`[apify] Platform: ${platform}`);
  console.log(`[apify] API token present: ${Boolean(apiToken)}`);

  // Stub return — replace with real ApifyClient call:
  //
  // const client = new ApifyClient({ token: apiToken });
  // const run = await client.actor(actorId).call({ startUrls: [{ url }] });
  // const dataset = await client.dataset(run.defaultDatasetId).listItems();
  // const item = dataset.items[0];
  // return mapActorOutput(platform, item);

  return {
    platform,
    metadata: { url, stub: true },
  };
}

export function detectPlatform(url: string): PlatformType {
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/twitter\.com|x\.com/i.test(url)) return "twitter";
  return "other";
}

// Re-export for convenience
export { ApifyClient };
