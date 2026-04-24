import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type PlatformType = "tiktok" | "instagram" | "youtube" | "twitter" | "other";
type CategoryType = string;
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
    thumbnailR2Key?: string;
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

async function getOwnedItem(
  ctx: { db: { get: (id: Id<"savedItems">) => Promise<any> } },
  userId: Id<"users">,
  id: Id<"savedItems">,
) {
  const item = await ctx.db.get(id);
  if (!item || item.userId !== userId) throw new Error("Item not found");
  return item;
}

/** Returns true if the item is eligible for re-processing with a new category. */
export function canReprocess(status: ItemStatus): boolean {
  return status === "done";
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
        const thumbnailUrl = await resolveThumbnailUrl(ctx, item);
        return toResponse(item, thumbnailUrl);
      }),
    );
  },
});

export async function resolveThumbnailUrl(
  ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } },
  item: {
    thumbnailStorageId?: Id<"_storage">;
    thumbnailR2Key?: string;
    extractedData?: unknown;
    rawContent?: unknown;
  },
): Promise<string | null> {
  const r2PublicUrl = process.env.R2_PUBLIC_URL;
  if (item.thumbnailR2Key && r2PublicUrl) {
    return `${r2PublicUrl}/${item.thumbnailR2Key}`;
  }
  if (item.thumbnailStorageId) {
    const url = await ctx.storage.getUrl(item.thumbnailStorageId);
    if (url) return url;
  }
  const extracted = (item.extractedData as Record<string, unknown> | null) ?? null;
  const raw = (item.rawContent as Record<string, unknown> | null) ?? null;
  return extractThumbnailUrl(extracted, raw);
}

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
      distinctId: userId,
    });

    return id;
  },
});

/** Updates the category override for a saved item. */
export const updateCategory = mutation({
  args: {
    id: v.id("savedItems"),
    category: v.string(),
  },
  handler: async (ctx, { id, category }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await getOwnedItem(ctx, userId, id);

    await ctx.db.patch(id, { category });
    return true;
  },
});

/** Saves a user correction note and optionally re-categorises the item. */
export const saveCorrection = mutation({
  args: {
    id: v.id("savedItems"),
    note: v.string(),
    correctedCategory: v.optional(v.string()),
  },
  handler: async (ctx, { id, note, correctedCategory }) => {
    if (!note.trim()) throw new Error("Correction note cannot be empty");

    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await getOwnedItem(ctx, userId, id);

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

    await getOwnedItem(ctx, userId, id);

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

    const item = await getOwnedItem(ctx, userId, id);
    if (item.status !== "failed") throw new Error("Only failed items can be retried");

    await ctx.db.patch(id, { status: "pending" });
    await ctx.scheduler.runAfter(0, internal.processUrl.processItem, {
      savedItemId: id,
      url: item.sourceUrl,
      distinctId: userId,
    });
    return true;
  },
});

/** Re-processes a done item with a user-specified category override. */
export const reprocessWithCategory = mutation({
  args: {
    id: v.id("savedItems"),
    category: v.string(),
  },
  handler: async (ctx, { id, category }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const item = await getOwnedItem(ctx, userId, id);
    if (!canReprocess(item.status)) {
      throw new Error("Only done items can be re-processed");
    }

    await ctx.db.patch(id, { status: "pending", category });
    await ctx.scheduler.runAfter(0, internal.processUrl.processItem, {
      savedItemId: id,
      url: item.sourceUrl,
      overrideCategory: category,
      distinctId: userId,
    });
    return true;
  },
});

// ─── Internal mutations (called from processUrl action) ───────────────────────

/** Marks item as processing. */
export const markProcessing = internalMutation({
  args: { id: v.id("savedItems") },
  handler: async (ctx, { id }) => {
    const item = await ctx.db.get(id);
    if (!item) return;
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
    category: v.string(),
    rawContent: v.optional(v.any()),
    extractedData: v.optional(v.any()),
    actionTaken: v.optional(v.string()),
    thumbnailStorageId: v.optional(v.id("_storage")),
    thumbnailR2Key: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { id, platform, category, rawContent, extractedData, actionTaken, thumbnailStorageId, thumbnailR2Key },
  ) => {
    const item = await ctx.db.get(id);
    if (!item) return;
    await ctx.db.patch(id, {
      platform,
      category,
      rawContent,
      extractedData,
      actionTaken,
      thumbnailStorageId,
      thumbnailR2Key,
      status: "done",
    });
  },
});

/** Returns done items that have a CDN thumbnail URL but no stored thumbnail (Convex or R2). */
export const listItemsNeedingThumbnail = internalQuery({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db
      .query("savedItems")
      .withIndex("by_status", (q) => q.eq("status", "done"))
      .collect();

    const results: { id: string; cdnUrl: string }[] = [];
    for (const item of items) {
      if (item.thumbnailR2Key || item.thumbnailStorageId) continue;
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
    const item = await ctx.db.get(id);
    if (!item) return;
    await ctx.db.patch(id, { thumbnailStorageId: storageId });
  },
});

/** Sets the R2 key for a migrated thumbnail. */
export const setThumbnailR2Key = internalMutation({
  args: {
    id: v.id("savedItems"),
    r2Key: v.string(),
  },
  handler: async (ctx, { id, r2Key }) => {
    const item = await ctx.db.get(id);
    if (!item) return;
    await ctx.db.patch(id, { thumbnailR2Key: r2Key });
  },
});

/** Returns done items with Convex storage thumbnails that haven't been migrated to R2 yet. */
export const listItemsNeedingR2Migration = internalQuery({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db
      .query("savedItems")
      .withIndex("by_status", (q) => q.eq("status", "done"))
      .collect();

    const results: { id: string; storageUrl: string }[] = [];
    for (const item of items) {
      if (item.thumbnailR2Key || !item.thumbnailStorageId) continue;
      const url = await ctx.storage.getUrl(item.thumbnailStorageId);
      if (url) results.push({ id: item._id, storageUrl: url });
    }
    return results;
  },
});

/** Marks item as failed. */
export const markFailed = internalMutation({
  args: { id: v.id("savedItems") },
  handler: async (ctx, { id }) => {
    const item = await ctx.db.get(id);
    if (!item) return;
    await ctx.db.patch(id, { status: "failed" });
  },
});

function hasOkGeocoding(extractedData: unknown, category: string): boolean {
  if (!extractedData || typeof extractedData !== "object") return false;
  const d = extractedData as Record<string, unknown>;
  if (category === "food") {
    const p = d.place as Record<string, unknown> | undefined;
    return !!p && p.geocoder_status === "OK";
  }
  if (category === "travel") {
    const it = Array.isArray(d.itinerary) ? (d.itinerary as Array<Record<string, unknown>>) : [];
    if (!it.length) return true;
    return it.every((s) => {
      const p = s.place as Record<string, unknown> | undefined;
      return !!p && p.geocoder_status === "OK";
    });
  }
  return true;
}

export const listMissingGeocoding = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("savedItems")
      .withIndex("by_status", (q) => q.eq("status", "done"))
      .collect();

    return rows
      .filter((r) => r.category === "food" || r.category === "travel")
      .filter((r) => !hasOkGeocoding(r.extractedData, r.category))
      .map((r) => ({
        id: r._id,
        userId: r.userId,
        category: r.category as "food" | "travel",
        extractedData: r.extractedData ?? null,
      }));
  },
});

export const updateExtractedData = internalMutation({
  args: {
    id: v.id("savedItems"),
    extractedData: v.any(),
  },
  handler: async (ctx, { id, extractedData }) => {
    const item = await ctx.db.get(id);
    if (!item) return;
    await ctx.db.patch(id, { extractedData });
  },
});
