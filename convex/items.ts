import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type PlatformType = "tiktok" | "instagram" | "youtube" | "twitter" | "other";
type CategoryType =
  | "food"
  | "fitness"
  | "recipe"
  | "how-to"
  | "video-analysis"
  | "other";
type ItemStatus = "pending" | "processing" | "done" | "failed";

function detectPlatform(url: string): PlatformType {
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/twitter\.com|x\.com/i.test(url)) return "twitter";
  return "other";
}

function extractThumbnailUrl(
  extractedData: Record<string, unknown> | null,
): string | null {
  if (!extractedData) return null;
  const url =
    extractedData.thumbnailUrl ??
    extractedData.thumbnail_url ??
    extractedData.displayUrl;
  return typeof url === "string" ? url : null;
}

function toResponse(item: {
  _id: Id<"savedItems">;
  _creationTime: number;
  userId: Id<"users">;
  sourceUrl: string;
  platform: PlatformType;
  category: CategoryType;
  rawContent?: unknown;
  extractedData?: unknown;
  actionTaken?: string;
  userCorrection?: string;
  status: ItemStatus;
}) {
  const extractedData =
    (item.extractedData as Record<string, unknown> | null) ?? null;
  return {
    id: item._id as string,
    source_url: item.sourceUrl,
    platform: item.platform,
    category: item.category,
    extracted_data: extractedData,
    action_taken: item.actionTaken ?? null,
    status: item.status,
    thumbnail_url: extractThumbnailUrl(extractedData),
    created_at: new Date(item._creationTime).toISOString(),
    processed_at:
      item.status === "done"
        ? new Date(item._creationTime).toISOString()
        : null,
  };
}

// ─── Public queries ───────────────────────────────────────────────────────────

/** Returns all saved items for the authenticated user. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const items = await ctx.db
      .query("savedItems")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);

    return items.map(toResponse);
  },
});

// ─── Public mutations ─────────────────────────────────────────────────────────

/** Creates a new saved item and enqueues background processing. */
export const save = mutation({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const platform = detectPlatform(url);

    const id = await ctx.db.insert("savedItems", {
      userId,
      sourceUrl: url,
      platform,
      category: "other",
      status: "pending",
    });

    // Schedule URL processing immediately
    await ctx.scheduler.runAfter(0, internal.processUrl.processItem, {
      savedItemId: id,
      url,
    });

    return id;
  },
});

/** Updates the category override for a saved item. */
export const updateCategory = mutation({
  args: {
    id: v.id("savedItems"),
    category: v.union(
      v.literal("food"),
      v.literal("fitness"),
      v.literal("recipe"),
      v.literal("how-to"),
      v.literal("video-analysis"),
      v.literal("other"),
    ),
  },
  handler: async (ctx, { id, category }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const item = await ctx.db.get(id);
    if (!item || item.userId !== userId) throw new Error("Item not found");

    await ctx.db.patch(id, { category });
    return true;
  },
});

// ─── Internal mutations (called from processUrl action) ───────────────────────

/** Marks item as processing. */
export const markProcessing = internalMutation({
  args: { id: v.id("savedItems") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "processing" });
  },
});

/** Updates item with processed results. */
export const updateResult = internalMutation({
  args: {
    id: v.id("savedItems"),
    platform: v.union(
      v.literal("tiktok"),
      v.literal("instagram"),
      v.literal("youtube"),
      v.literal("twitter"),
      v.literal("other"),
    ),
    category: v.union(
      v.literal("food"),
      v.literal("fitness"),
      v.literal("recipe"),
      v.literal("how-to"),
      v.literal("video-analysis"),
      v.literal("other"),
    ),
    rawContent: v.optional(v.any()),
    extractedData: v.optional(v.any()),
    actionTaken: v.optional(v.string()),
  },
  handler: async (ctx, { id, platform, category, rawContent, extractedData, actionTaken }) => {
    await ctx.db.patch(id, {
      platform,
      category,
      rawContent,
      extractedData,
      actionTaken,
      status: "done",
    });
  },
});

/** Marks item as failed. */
export const markFailed = internalMutation({
  args: { id: v.id("savedItems") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "failed" });
  },
});
