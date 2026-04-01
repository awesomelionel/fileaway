import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
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

export function extractThumbnailUrl(
  extractedData: Record<string, unknown> | null,
  rawContent: Record<string, unknown> | null,
): string | null {
  if (extractedData) {
    const url =
      extractedData.thumbnailUrl ??
      extractedData.thumbnail_url ??
      extractedData.displayUrl;
    if (typeof url === "string") return url;
  }

  if (rawContent) {
    const url =
      rawContent.coverUrl ??
      rawContent.displayUrl ??
      rawContent.thumbnailUrl;
    if (typeof url === "string") return url;
  }

  return null;
}

function toResponse(
  item: {
    _id: Id<"savedItems">;
    _creationTime: number;
    userId: Id<"users">;
    sourceUrl: string;
    platform: PlatformType;
    category: CategoryType;
    rawContent?: unknown;
    extractedData?: unknown;
    thumbnailStorageId?: Id<"_storage">;
    actionTaken?: string;
    userCorrection?: string;
    status: ItemStatus;
    archived?: boolean;
  },
  thumbnailUrl: string | null,
) {
  const extractedData =
    (item.extractedData as Record<string, unknown> | null) ?? null;
  return {
    id: item._id as string,
    source_url: item.sourceUrl,
    platform: item.platform,
    category: item.category,
    extracted_data: extractedData,
    action_taken: item.actionTaken ?? null,
    user_correction: item.userCorrection ?? null,
    status: item.status,
    archived: item.archived === true,
    thumbnail_url: thumbnailUrl,
    created_at: new Date(item._creationTime).toISOString(),
    processed_at:
      item.status === "done"
        ? new Date(item._creationTime).toISOString()
        : null,
  };
}

// ─── Public queries ───────────────────────────────────────────────────────────

const LIST_SCAN = 250;
const LIST_LIMIT = 100;

/** Returns saved items for the authenticated user (main feed or archive). */
export const list = query({
  args: {
    view: v.optional(v.union(v.literal("feed"), v.literal("archive"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const wantArchived = (args.view ?? "feed") === "archive";
    const rows = await ctx.db
      .query("savedItems")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(LIST_SCAN);

    const matched = rows.filter((item) =>
      wantArchived ? item.archived === true : !item.archived,
    );
    const items = matched.slice(0, LIST_LIMIT);

    return Promise.all(
      items.map(async (item) => {
        let thumbnailUrl: string | null = null;
        if (item.thumbnailStorageId) {
          thumbnailUrl = await ctx.storage.getUrl(item.thumbnailStorageId);
        }
        if (!thumbnailUrl) {
          const extracted = (item.extractedData as Record<string, unknown> | null) ?? null;
          const raw = (item.rawContent as Record<string, unknown> | null) ?? null;
          thumbnailUrl = extractThumbnailUrl(extracted, raw);
        }
        return toResponse(item, thumbnailUrl);
      }),
    );
  },
});

/** Returns aggregate stats for the authenticated user's saved items. */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const items = await ctx.db
      .query("savedItems")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      // Cap at 200 to keep stats queries fast; list query caps at 100.
      // Users with >200 items will see approximate counts.
      .take(200);

    const byCategory: Record<string, number> = {};
    let failedCount = 0;
    let processingCount = 0;

    for (const item of items) {
      if (item.archived) continue;
      if (item.status === "done") {
        byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
      }
      if (item.status === "failed") failedCount++;
      if (item.status === "processing" || item.status === "pending") processingCount++;
    }

    const activeItems = items.filter((i) => !i.archived);
    const recent = activeItems.slice(0, 5).map((i) => ({
      id: i._id as string,
      sourceUrl: i.sourceUrl,
      category: i.category,
      status: i.status,
      createdAt: new Date(i._creationTime).toISOString(),
    }));

    return {
      total: activeItems.length,
      byCategory,
      failedCount,
      processingCount,
      recentItems: recent,
    };
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
      archived: false,
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

/** Saves a user correction note and optionally re-categorises the item. */
export const saveCorrection = mutation({
  args: {
    id: v.id("savedItems"),
    note: v.string(),
    correctedCategory: v.optional(
      v.union(
        v.literal("food"),
        v.literal("fitness"),
        v.literal("recipe"),
        v.literal("how-to"),
        v.literal("video-analysis"),
        v.literal("other"),
      ),
    ),
  },
  handler: async (ctx, { id, note, correctedCategory }) => {
    if (!note.trim()) throw new Error("Correction note cannot be empty");

    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const item = await ctx.db.get(id);
    if (!item || item.userId !== userId) throw new Error("Item not found");

    const correction = JSON.stringify({
      note,
      correctedCategory: correctedCategory ?? null,
    });

    const patch: {
      userCorrection: string;
      category?: CategoryType;
    } = { userCorrection: correction };

    if (correctedCategory) patch.category = correctedCategory;

    await ctx.db.patch(id, patch);
    return true;
  },
});

/** Archive or restore a saved item. */
export const setArchived = mutation({
  args: {
    id: v.id("savedItems"),
    archived: v.boolean(),
  },
  handler: async (ctx, { id, archived }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const item = await ctx.db.get(id);
    if (!item || item.userId !== userId) throw new Error("Item not found");

    await ctx.db.patch(id, { archived });
    return true;
  },
});

/** Resets a failed item to pending and re-schedules processing. */
export const retryItem = mutation({
  args: { id: v.id("savedItems") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const item = await ctx.db.get(id);
    if (!item || item.userId !== userId) throw new Error("Item not found");
    if (item.status !== "failed") throw new Error("Only failed items can be retried");

    await ctx.db.patch(id, { status: "pending" });
    await ctx.scheduler.runAfter(0, internal.processUrl.processItem, {
      savedItemId: id,
      url: item.sourceUrl,
    });
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
    thumbnailStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, { id, platform, category, rawContent, extractedData, actionTaken, thumbnailStorageId }) => {
    await ctx.db.patch(id, {
      platform,
      category,
      rawContent,
      extractedData,
      actionTaken,
      thumbnailStorageId,
      status: "done",
    });
  },
});

/** Returns done items that have a CDN thumbnail URL but no stored thumbnail. */
export const listItemsNeedingThumbnail = internalQuery({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db
      .query("savedItems")
      .withIndex("by_status", (q) => q.eq("status", "done"))
      .collect();

    const results: { id: string; cdnUrl: string }[] = [];
    for (const item of items) {
      if (item.thumbnailStorageId) continue;
      const extracted = (item.extractedData as Record<string, unknown> | null) ?? null;
      const raw = (item.rawContent as Record<string, unknown> | null) ?? null;
      const url = extractThumbnailUrl(extracted, raw);
      if (url) results.push({ id: item._id, cdnUrl: url });
    }
    return results;
  },
});

/** Stores a downloaded thumbnail for a specific item. */
export const setThumbnailStorage = internalMutation({
  args: {
    id: v.id("savedItems"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { id, storageId }) => {
    await ctx.db.patch(id, { thumbnailStorageId: storageId });
  },
});

/** Marks item as failed. */
export const markFailed = internalMutation({
  args: { id: v.id("savedItems") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "failed" });
  },
});
