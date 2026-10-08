"use node";

import { v } from "convex/values";
import { PostHog } from "posthog-node";
import { internalAction } from "./_generated/server";

export const SERVER_EVENTS = {
  ITEM_PROCESSING_STARTED: "item_processing_started",
  ITEM_SCRAPE_COMPLETED: "item_scrape_completed",
  ITEM_SCRAPE_FAILED: "item_scrape_failed",
  ITEM_CATEGORIZED: "item_categorized",
  ITEM_EXTRACTION_COMPLETED: "item_extraction_completed",
  ITEM_EXTRACTION_FAILED: "item_extraction_failed",
  ITEM_PROCESSING_FAILED: "item_processing_failed",
  EXTRACTION_FIELD_MISSING: "extraction_field_missing",
  LLM_GENERATION: "$ai_generation",
  /** Cross-user processed-result reuse. `result` is "hit" or "miss". */
  ITEM_SAVE_REUSE: "item_save_reuse",
} as const;

export type ServerEventName = (typeof SERVER_EVENTS)[keyof typeof SERVER_EVENTS];

type CaptureInput = {
  distinctId: string;
  event: ServerEventName;
  properties: Record<string, unknown>;
};

let client: PostHog | null = null;

function getClient(): PostHog | null {
  const token = process.env.NEXT_PUBLIC_POSTHOG_TOKEN;
  if (!token) return null;
  if (!client) {
    client = new PostHog(token, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

export async function captureServer({ distinctId, event, properties }: CaptureInput): Promise<void> {
  const c = getClient();
  if (!c) return;
  c.capture({ distinctId, event, properties });
  await c.flush();
}

/** Scheduled from `items.save`. Properties stay free of any other user's id. */
export const captureSaveReuse = internalAction({
  args: {
    distinctId: v.string(),
    result: v.union(v.literal("hit"), v.literal("miss")),
    platform: v.string(),
    urlHost: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, { distinctId, result, platform, urlHost }) => {
    await captureServer({
      distinctId,
      event: SERVER_EVENTS.ITEM_SAVE_REUSE,
      properties: {
        result,
        platform,
        url_host: urlHost,
      },
    });
    return null;
  },
});
