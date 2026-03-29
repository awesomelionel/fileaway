/**
 * Background worker: process-url
 *
 * Picks up PROCESS_URL jobs from pg-boss, runs the full pipeline:
 *   1. Scrape URL via Apify
 *   2. Categorize content via Gemini Flash
 *   3. Extract structured data via Gemini Flash/Pro
 *   4. Save results back to saved_items
 *
 * Run with: npx tsx src/workers/process-url.ts
 * Or via package.json script: npm run worker
 */

import { getQueue, JOB_NAMES, type ProcessUrlJobData } from "@/lib/queue/boss";
import { scrapeUrl } from "@/lib/integrations/apify";
import { categorizeContent, extractStructuredData } from "@/lib/integrations/gemini";
import { createServiceClient } from "@/lib/supabase/server";

async function processUrlJobs(jobs: { id: string; data: ProcessUrlJobData }[]): Promise<void> {
  await Promise.all(jobs.map(processOne));
}

async function processOne(job: { id: string; data: ProcessUrlJobData }): Promise<void> {
  const { savedItemId, url } = job.data;
  const supabase = createServiceClient();

  console.log(`[worker] Processing job ${job.id} — savedItemId: ${savedItemId}, url: ${url}`);

  // Mark as processing
  await supabase
    .from("saved_items")
    .update({ status: "processing" })
    .eq("id", savedItemId);

  try {
    // 1. Detect platform + scrape
    const { detectPlatform } = await import("@/lib/integrations/apify");
    const platform = detectPlatform(url);
    const scrapeResult = await scrapeUrl(url, platform);

    console.log(`[worker] Scrape complete — platform: ${platform}`);

    // 2. Categorize
    const category = await categorizeContent(scrapeResult);
    console.log(`[worker] Category: ${category}`);

    // 3. Extract structured data
    const extraction = await extractStructuredData(scrapeResult, category);
    console.log(`[worker] Extraction complete — action: ${extraction.actionTaken}`);

    // 4. Persist results
    const { error } = await supabase
      .from("saved_items")
      .update({
        platform,
        category,
        raw_content: scrapeResult.metadata,
        extracted_data: extraction.extractedData,
        action_taken: extraction.actionTaken,
        status: "done",
      })
      .eq("id", savedItemId);

    if (error) {
      console.error(`[worker] DB update failed:`, error);
      throw error;
    }

    console.log(`[worker] Job ${job.id} complete`);
  } catch (err) {
    console.error(`[worker] Job ${job.id} failed:`, err);

    await supabase
      .from("saved_items")
      .update({ status: "failed" })
      .eq("id", savedItemId);

    // Re-throw so pg-boss marks the job as failed (enabling retry)
    throw err;
  }
}

async function main(): Promise<void> {
  console.log("[worker] Starting process-url worker...");

  const boss = await getQueue();

  await boss.work<ProcessUrlJobData>(JOB_NAMES.PROCESS_URL, processUrlJobs);

  console.log("[worker] Listening for jobs. Press Ctrl+C to stop.");

  // Keep process alive
  process.on("SIGINT", async () => {
    console.log("[worker] Shutting down...");
    await boss.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await boss.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
