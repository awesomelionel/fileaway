"use node";

import { PostHog } from "posthog-node";

export const SERVER_EVENTS = {
  ITEM_PROCESSING_STARTED: "item_processing_started",
  ITEM_SCRAPE_COMPLETED: "item_scrape_completed",
  ITEM_SCRAPE_FAILED: "item_scrape_failed",
  ITEM_CATEGORIZED: "item_categorized",
  ITEM_EXTRACTION_COMPLETED: "item_extraction_completed",
  ITEM_EXTRACTION_FAILED: "item_extraction_failed",
  ITEM_PROCESSING_FAILED: "item_processing_failed",
  EXTRACTION_FIELD_MISSING: "extraction_field_missing",
  ITEM_GEOCODED: "item_geocoded",
  ITEM_GEOCODE_FAILED: "item_geocode_failed",
  LLM_GENERATION: "$ai_generation",
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
