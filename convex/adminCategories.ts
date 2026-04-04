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
        extractionPrompt: `Extract ALL details about this restaurant or food spot. Return JSON:
{
  "name": "<restaurant or food item name>",
  "address": "<full address; infer city/neighbourhood from hashtags or handle; null only if truly unknown>",
  "cuisine": "<cuisine type>",
  "why_visit": "<the most compelling reason to visit, based on what's shown>",
  "price_range": "<$ | $$ | $$$ — infer from context if not stated>",
  "dishes_mentioned": ["<every dish, drink, or food item shown or mentioned>"],
  "hours": "<opening hours if mentioned, else null>",
  "phone": "<phone number if mentioned, else null>"
}`,
      },
      {
        slug: "recipe",
        label: "Recipe",
        sortOrder: 1,
        categorizationHint: "cooking instructions, ingredients lists, baking steps",
        extractionPrompt: `Extract ALL details from this recipe video or post. Return JSON:
{
  "dish_name": "<name of the dish>",
  "ingredients": ["<every ingredient with quantity and unit — list ALL of them>"],
  "steps": ["<every step in order — list ALL of them>"],
  "prep_time_minutes": "<number or null>",
  "cook_time_minutes": "<number or null>",
  "servings": "<number or null>",
  "cuisine": "<cuisine type if known>",
  "dietary_tags": ["<e.g. vegan, gluten-free, dairy-free — infer from ingredients>"]
}
IMPORTANT: List EVERY ingredient and EVERY step. Never truncate.`,
      },
      {
        slug: "fitness",
        label: "Fitness",
        sortOrder: 2,
        categorizationHint: "workouts, exercise routines, gym tips, sports drills",
        extractionPrompt: `Extract ALL details from this fitness/workout video. Return JSON:
{
  "workout_name": "<descriptive name of the workout>",
  "exercises": [
    {
      "name": "<exercise name>",
      "sets": "<number>",
      "reps": "<number or range e.g. '10-12'>",
      "notes": "<form tip, tempo, or variation if mentioned>"
    }
  ],
  "muscle_groups": ["<every muscle group targeted>"],
  "equipment": ["<every piece of equipment shown or mentioned>"],
  "duration_minutes": "<total estimated duration as number>",
  "difficulty": "<beginner | intermediate | advanced>",
  "rest_between_sets": "<rest period if mentioned, else null>"
}
IMPORTANT: List EVERY exercise shown or performed. Do not stop after 2-3. If 6 exercises are demonstrated, return all 6.`,
      },
      {
        slug: "how-to",
        label: "How-To",
        sortOrder: 3,
        categorizationHint: "tutorials, life hacks, DIY projects, step-by-step guides (non-recipe)",
        extractionPrompt: `Extract ALL details from this how-to or tutorial. Return JSON:
{
  "title": "<short descriptive title for what is being taught>",
  "summary": "<one sentence describing the end result or skill gained>",
  "steps": ["<every step in order — be specific and actionable, list ALL steps>"],
  "tools_needed": ["<every tool, material, or app required>"],
  "difficulty": "<easy | medium | hard>",
  "time_required": "<estimated total time as a string, e.g. '30 minutes'>",
  "tips": ["<any pro tips, warnings, or shortcuts mentioned>"]
}`,
      },
      {
        slug: "video-analysis",
        label: "Video Analysis",
        sortOrder: 4,
        categorizationHint: "general video content where full analysis is needed",
        extractionPrompt: `Extract ALL details from this video. Return JSON:
{
  "title": "<short descriptive title>",
  "summary": "<2-3 sentence summary of the full video>",
  "shots": [
    {
      "timestamp": "<approximate timestamp e.g. '0:05' — infer sequence if unknown>",
      "description": "<one-line label for this scene>",
      "detail": "<1-2 sentences on what happens and why it matters>"
    }
  ],
  "takeaways": ["<specific actionable item the viewer can act on>"],
  "key_points": ["<key point or insight from the video>"],
  "topics": ["<topic tag>"]
}
Include 3-8 shots and 3-6 takeaways. Infer shots from caption/hashtags if no video available.`,
      },
      {
        slug: "other",
        label: "Other",
        sortOrder: 5,
        categorizationHint: "everything else",
        extractionPrompt: `Extract the key details from this saved post. Return JSON:
{
  "title": "<short descriptive title>",
  "summary": "<2-3 sentence description of what this is about>",
  "topics": ["<relevant topic tags>"]
}`,
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
