import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getQueue, JOB_NAMES, type ProcessUrlJobData } from "@/lib/queue/boss";
import { detectPlatform } from "@/lib/integrations/apify";

/**
 * POST /api/save
 *
 * Accepts a URL, creates a SavedItem record, queues a background processing job,
 * and returns the job ID with a pending status.
 *
 * Body: { url: string }
 * Response: { jobId: string, savedItemId: string, status: "pending" }
 */
export async function POST(request: NextRequest) {
  let body: { url?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url } = body;

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // Basic URL validation
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: "URL must use http or https" }, { status: 400 });
  }

  // TODO: Add auth check when Supabase Auth is wired up
  // const supabase = await createClient();
  // const { data: { user } } = await supabase.auth.getUser();
  // if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const platform = detectPlatform(url);

  // Use service client to insert (bypasses RLS for now — swap to user client once auth is ready)
  const supabase = createServiceClient();

  // Placeholder userId — replace with real user.id once auth is wired up
  const PLACEHOLDER_USER_ID = "00000000-0000-0000-0000-000000000001";

  const { data: savedItem, error: insertError } = await supabase
    .from("saved_items")
    .insert({
      user_id: PLACEHOLDER_USER_ID,
      source_url: url,
      platform,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !savedItem) {
    console.error("[/api/save] DB insert error:", insertError);
    return NextResponse.json({ error: "Failed to save item" }, { status: 500 });
  }

  // Queue background job
  let jobId: string;
  try {
    const boss = await getQueue();
    const jobData: ProcessUrlJobData = {
      savedItemId: savedItem.id,
      url,
    };
    jobId = (await boss.send(JOB_NAMES.PROCESS_URL, jobData)) ?? savedItem.id;
  } catch (queueError) {
    console.error("[/api/save] Queue error:", queueError);
    // Don't fail the request — item is saved, job can be retried
    jobId = savedItem.id;
  }

  return NextResponse.json(
    {
      jobId,
      savedItemId: savedItem.id,
      status: "pending",
    },
    { status: 202 }
  );
}
