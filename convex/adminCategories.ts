import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertAdmin } from "./admin";

const BUILT_IN_SEED = [
  {
    slug: "food",
    label: "Food",
    sortOrder: 0,
    categorizationHint:
      "restaurants, food spots, dishes to try, cafe/bar recommendations",
    extractionPrompt: `Return JSON:
{
  "name": "<restaurant or food item name — use creator's exact wording or infer from post>",
  "address": "<full address if mentioned; infer city/neighbourhood from hashtags like #NYC or #LondonEats; null only if truly unknown>",
  "cuisine": "<cuisine type — infer from dish names, hashtags (#italian #ramen), or location>",
  "why_visit": "<one compelling reason to visit, written as a recommendation — infer from the vibe/tone of the post if not stated explicitly>",
  "price_range": "<$ | $$ | $$$ — infer from context clues like 'budget', 'Michelin', 'street food'; null if no clues>",
  "dishes_mentioned": ["<every dish, food item, or drink mentioned or shown — infer from emojis like 🍕🍜 if no text>"]
}`,
  },
  {
    slug: "recipe",
    label: "Recipe",
    sortOrder: 1,
    categorizationHint: "cooking instructions, ingredients lists, baking steps",
    extractionPrompt: `Return JSON:
{
  "dish_name": "<name of the dish — use post title or infer from ingredients shown>",
  "ingredients": ["<ingredient with quantity — reconstruct from what's shown; include obvious staples if recipe type is clear>"],
  "steps": ["<step 1>", "<step 2>", "<infer likely steps from recipe type if not all listed>"],
  "prep_time_minutes": <number — infer from recipe complexity if not stated; null only if truly unknowable>,
  "cook_time_minutes": <number — infer from recipe type (e.g. cookies ~12 min); null only if truly unknowable>,
  "servings": <number — infer from context ('serves 4', 'family size', 'single serving'); null if no clues>
}`,
  },
  {
    slug: "fitness",
    label: "Fitness",
    sortOrder: 2,
    categorizationHint: "workouts, exercise routines, gym tips, sports drills",
    extractionPrompt: `Return JSON:
{
  "workout_name": "<name or description of the workout — use post title or infer from exercises>",
  "exercises": [{"name": "<exercise name>", "sets": <number — infer standard sets (3) if not specified>, "reps": <number or string like "30 seconds" — infer standard reps if not stated>}],
  "muscle_groups": ["<muscle groups targeted — infer from exercise names; e.g. squats → legs, glutes>"],
  "duration_minutes": <number — infer from number of exercises × typical time; null if no basis>,
  "difficulty": "<beginner | intermediate | advanced — infer from exercise complexity and intensity>"
}`,
  },
  {
    slug: "how-to",
    label: "How-To",
    sortOrder: 3,
    categorizationHint:
      "tutorials, life hacks, DIY projects, step-by-step guides (non-recipe)",
    extractionPrompt: `Return JSON:
{
  "title": "<short descriptive title of what this guide teaches — infer from hashtags or context if not explicit>",
  "summary": "<one sentence describing the outcome or main benefit of following this guide>",
  "steps": ["<step 1>", "<step 2>", "<step 3 — infer likely steps from context if not all listed>"],
  "tools_needed": ["<tool or material — omit array if none mentioned>"],
  "difficulty": "<easy | medium | hard | null>",
  "time_required": "<estimated time as a string, e.g. '10 minutes' — null if unknown>"
}`,
  },
  {
    slug: "video-analysis",
    label: "Video Analysis",
    sortOrder: 4,
    categorizationHint: "general video content where full analysis is needed",
    extractionPrompt: `Return JSON:
{
  "title": "<short descriptive title — use the post title, infer from caption/hashtags if missing>",
  "summary": "<2-3 sentence summary of the video's main content and takeaway>",
  "key_points": ["<key point 1>", "<key point 2>", "<key point 3 if applicable>"],
  "topics": ["<topic tag>"],
  "sentiment": "<positive | neutral | negative>"
}`,
  },
  {
    slug: "other",
    label: "Other",
    sortOrder: 5,
    categorizationHint: "everything else",
    extractionPrompt: `Return JSON:
{
  "title": "<short descriptive title — infer from caption, hashtags, or creator context>",
  "summary": "<2-3 sentence description of what this post is about and why someone saved it>",
  "topics": ["<topic tag>"]
}`,
  },
] as const;

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const categories = await ctx.db.query("categories").collect();
    return categories.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const listCategorySlugsAndHints = internalQuery({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db.query("categories").collect();
    return categories
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({
        slug: c.slug,
        categorizationHint: c.categorizationHint,
      }));
  },
});

export const getCategoryBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
  },
});

export const getCategory = query({
  args: { id: v.id("categories") },
  handler: async (ctx, { id }) => {
    await assertAdmin(ctx);
    return await ctx.db.get(id);
  },
});

export const createCategory = mutation({
  args: {
    slug: v.string(),
    label: v.string(),
    extractionPrompt: v.string(),
    categorizationHint: v.string(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    await assertAdmin(ctx);

    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) {
      throw new Error("Category slug already exists");
    }

    return await ctx.db.insert("categories", {
      slug: args.slug,
      label: args.label,
      extractionPrompt: args.extractionPrompt,
      categorizationHint: args.categorizationHint,
      sortOrder: args.sortOrder,
      isBuiltIn: false,
    });
  },
});

export const updateCategory = mutation({
  args: {
    id: v.id("categories"),
    label: v.optional(v.string()),
    extractionPrompt: v.optional(v.string()),
    categorizationHint: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, { id, label, extractionPrompt, categorizationHint, sortOrder }) => {
    await assertAdmin(ctx);

    const row = await ctx.db.get(id);
    if (!row) throw new Error("Category not found");

    const patch: {
      label?: string;
      extractionPrompt?: string;
      categorizationHint?: string;
      sortOrder?: number;
    } = {};
    if (label !== undefined) patch.label = label;
    if (extractionPrompt !== undefined) patch.extractionPrompt = extractionPrompt;
    if (categorizationHint !== undefined) patch.categorizationHint = categorizationHint;
    if (sortOrder !== undefined) patch.sortOrder = sortOrder;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(id, patch);
    }
  },
});

export const deleteCategory = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, { id }) => {
    await assertAdmin(ctx);

    const row = await ctx.db.get(id);
    if (!row) throw new Error("Category not found");
    if (row.isBuiltIn) {
      throw new Error("Cannot delete built-in category");
    }

    await ctx.db.delete(id);
  },
});

export const seedCategories = mutation({
  args: {},
  handler: async (ctx) => {
    await assertAdmin(ctx);

    let inserted = 0;
    for (const cat of BUILT_IN_SEED) {
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", cat.slug))
        .unique();
      if (!existing) {
        await ctx.db.insert("categories", {
          slug: cat.slug,
          label: cat.label,
          extractionPrompt: cat.extractionPrompt,
          categorizationHint: cat.categorizationHint,
          sortOrder: cat.sortOrder,
          isBuiltIn: true,
        });
        inserted++;
      }
    }

    const all = await ctx.db.query("categories").collect();
    return { inserted, total: all.length };
  },
});
