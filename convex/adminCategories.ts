import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertAdmin } from "./admin";

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
      throw new Error(`Category with slug "${args.slug}" already exists`);
    }
    return await ctx.db.insert("categories", {
      ...args,
      isBuiltIn: false,
    });
  },
});

export const updateCategory = mutation({
  args: {
    id: v.id("categories"),
    label: v.string(),
    extractionPrompt: v.string(),
    categorizationHint: v.string(),
    sortOrder: v.number(),
  },
  handler: async (ctx, { id, ...fields }) => {
    await assertAdmin(ctx);
    const category = await ctx.db.get(id);
    if (!category) throw new Error("Category not found");
    await ctx.db.patch(id, fields);
    return true;
  },
});

export const deleteCategory = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, { id }) => {
    await assertAdmin(ctx);
    const category = await ctx.db.get(id);
    if (!category) throw new Error("Category not found");
    if (category.isBuiltIn) {
      throw new Error("Cannot delete built-in categories");
    }
    await ctx.db.delete(id);
    return true;
  },
});

export const seedCategories = mutation({
  args: {},
  handler: async (ctx) => {
    await assertAdmin(ctx);

    const SEED_DATA = [
      {
        slug: "food",
        label: "Food",
        sortOrder: 0,
        categorizationHint: "restaurants, food spots, dishes to try, cafe/bar recommendations",
        extractionPrompt: `Return JSON:\n{\n  "name": "<restaurant or food item name>",\n  "address": "<full address if mentioned; infer city/neighbourhood from hashtags; null only if truly unknown>",\n  "cuisine": "<cuisine type>",\n  "why_visit": "<one compelling reason to visit>",\n  "price_range": "<$ | $$ | $$$; null if no clues>",\n  "dishes_mentioned": ["<every dish, food item, or drink mentioned or shown>"]\n}`,
      },
      {
        slug: "recipe",
        label: "Recipe",
        sortOrder: 1,
        categorizationHint: "cooking instructions, ingredients lists, baking steps",
        extractionPrompt: `Return JSON:\n{\n  "dish_name": "<name of the dish>",\n  "ingredients": ["<ingredient with quantity>"],\n  "steps": ["<step 1>", "<step 2>"],\n  "prep_time_minutes": "<number or null>",\n  "cook_time_minutes": "<number or null>",\n  "servings": "<number or null>"\n}`,
      },
      {
        slug: "fitness",
        label: "Fitness",
        sortOrder: 2,
        categorizationHint: "workouts, exercise routines, gym tips, sports drills",
        extractionPrompt: `Return JSON:\n{\n  "workout_name": "<name or description of the workout>",\n  "exercises": [{"name": "<exercise name>", "sets": "<number>", "reps": "<number or string>"}],\n  "muscle_groups": ["<muscle groups targeted>"],\n  "duration_minutes": "<number or null>",\n  "difficulty": "<beginner | intermediate | advanced>"\n}`,
      },
      {
        slug: "how-to",
        label: "How-To",
        sortOrder: 3,
        categorizationHint: "tutorials, life hacks, DIY projects, step-by-step guides (non-recipe)",
        extractionPrompt: `Return JSON:\n{\n  "title": "<short descriptive title>",\n  "summary": "<one sentence describing the outcome>",\n  "steps": ["<step 1>", "<step 2>", "<step 3>"],\n  "tools_needed": ["<tool or material>"],\n  "difficulty": "<easy | medium | hard | null>",\n  "time_required": "<estimated time as string or null>"\n}`,
      },
      {
        slug: "video-analysis",
        label: "Video Analysis",
        sortOrder: 4,
        categorizationHint: "general video content where full analysis is needed",
        extractionPrompt: `Return JSON:\n{\n  "title": "<short descriptive title>",\n  "summary": "<2-3 sentence summary>",\n  "key_points": ["<key point 1>", "<key point 2>"],\n  "topics": ["<topic tag>"],\n  "sentiment": "<positive | neutral | negative>"\n}`,
      },
      {
        slug: "other",
        label: "Other",
        sortOrder: 5,
        categorizationHint: "everything else",
        extractionPrompt: `Return JSON:\n{\n  "title": "<short descriptive title>",\n  "summary": "<2-3 sentence description>",\n  "topics": ["<topic tag>"]\n}`,
      },
    ];

    let inserted = 0;
    for (const data of SEED_DATA) {
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", data.slug))
        .unique();
      if (!existing) {
        await ctx.db.insert("categories", { ...data, isBuiltIn: true });
        inserted++;
      }
    }
    return { inserted, total: SEED_DATA.length };
  },
});
