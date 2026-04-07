import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  savedItems: defineTable({
    userId: v.id("users"),
    sourceUrl: v.string(),
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
    thumbnailStorageId: v.optional(v.id("_storage")),
    thumbnailR2Key: v.optional(v.string()),
    actionTaken: v.optional(v.string()),
    userCorrection: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("failed"),
    ),
    archived: v.optional(v.boolean()),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"]),
  categories: defineTable({
    slug: v.string(),
    label: v.string(),
    extractionPrompt: v.string(),
    categorizationHint: v.string(),
    sortOrder: v.number(),
    isBuiltIn: v.boolean(),
  })
    .index("by_slug", ["slug"]),
});
