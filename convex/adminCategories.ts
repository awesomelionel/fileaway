import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertAdmin } from "./admin";

type BuiltInSeedCategory = {
  slug: string;
  label: string;
  sortOrder: number;
  categorizationHint: string;
  extractionPrompt: string;
};

const BUILT_IN_SEED_CATEGORIES: BuiltInSeedCategory[] = [
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
  "bullets": ["<3-10 short key details as bullet points: what to order, vibe, location hints, pricing clues, etc.>"],
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
  "bullets": ["<3-10 short key details as bullet points: tips, substitutions, temps, texture cues, etc.>"],
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
  "bullets": ["<3-10 short key details as bullet points: cues, common mistakes, progression/regression, etc.>"],
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
  "bullets": ["<3-10 short key details as bullet points: gotchas, key measurements, safety notes, etc.>"],
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
  "bullets": ["<5-15 short bullet points in chronological order capturing what happens, beat-by-beat>"],
  "takeaways": ["<specific actionable item the viewer can act on>"],
  "key_points": ["<key point or insight from the video>"],
  "topics": ["<topic tag>"]
}
Include 3-8 shots and 3-6 takeaways. Infer shots from caption/hashtags if no video available.`,
  },
  {
    slug: "travel",
    label: "Travel",
    sortOrder: 5,
    categorizationHint:
      "travel destinations, itineraries, sightseeing, city guides, hotels, attractions, neighborhood walks, places to visit",
    extractionPrompt: `Extract ALL travel-relevant details from this post/video. You MUST infer locations and places shown from visual cues, on-screen text, captions, hashtags, and creator context.

Return JSON:
{
  "title": "<short descriptive title>",
  "summary": "<2-3 sentence overview of the trip/route>",
  "primary_location": "<city/region/country if inferable, else null>",
  "itinerary": [
    {
      "order": "<1..N in the sequence shown>",
      "name": "<place name as shown/mentioned (POI, neighborhood, viewpoint, museum, cafe, etc.)>",
      "type": "<attraction | neighborhood | viewpoint | cafe | restaurant | hotel | beach | hike | market | museum | transit | other>",
      "location_text": "<city + area, or best available location description>",
      "why_go": "<1 sentence: what you do/see here>",
      "google_maps_query": "<a query string that would find it in Google Maps>",
      "google_maps_url": "<https://maps.google.com/?q=... built from name + location_text>",
      "tips": ["<0-5 practical tips: timing, tickets, reservations, costs, crowds, best photo spot, etc.>"]
    }
  ],
  "highlights": ["<3-10 standout moments/places>"],
  "bullets": ["<5-15 bullet points in chronological order>"]
}

Rules:
- Itinerary must include EVERY distinct place shown or clearly implied (don’t stop at 3-4).
- Always include google_maps_query and google_maps_url for each itinerary stop.
- If a stop’s exact name is unknown, use a descriptive placeholder (e.g. "Riverside night market") and make the google_maps_query as findable as possible.
- Return ONLY valid JSON. No markdown fences, no extra fields.`,
  },
  {
    slug: "other",
    label: "Other",
    sortOrder: 6,
    categorizationHint: "everything else",
    extractionPrompt: `Extract the key details from this saved post. If it appears to describe a video or sequence of events, infer a shot-by-shot breakdown from captions/hashtags. Return JSON:
{
  "title": "<short descriptive title>",
  "summary": "<2-3 sentence description of what this is about>",
  "bullets": ["<3-15 bullet points of the most important details (facts, claims, steps, items, recommendations, etc.)>"],
  "shots": [
    {
      "timestamp": "<optional; set to null if unknown>",
      "description": "<one-line label for this moment/scene>",
      "detail": "<1-2 sentences describing what happens or what the caption implies>"
    }
  ],
  "topics": ["<relevant topic tags>"]
}`,
  },
];

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

    let inserted = 0;
    for (const data of BUILT_IN_SEED_CATEGORIES) {
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", data.slug))
        .unique();
      if (!existing) {
        await ctx.db.insert("categories", { ...data, isBuiltIn: true });
        inserted++;
      }
    }
    return { inserted, total: BUILT_IN_SEED_CATEGORIES.length };
  },
});

export const refreshBuiltInCategoryPrompts = mutation({
  args: {},
  handler: async (ctx) => {
    await assertAdmin(ctx);

    const latestBySlug = Object.fromEntries(
      BUILT_IN_SEED_CATEGORIES.map((c) => [c.slug, c]),
    );

    let updated = 0;
    for (const slug of Object.keys(latestBySlug)) {
      const row = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (!row || !row.isBuiltIn) continue;
      const latest = latestBySlug[slug] as BuiltInSeedCategory | undefined;
      if (!latest) continue;
      await ctx.db.patch(row._id, {
        label: latest.label,
        sortOrder: latest.sortOrder,
        categorizationHint: latest.categorizationHint,
        extractionPrompt: latest.extractionPrompt,
      });
      updated++;
    }
    return { updated };
  },
});
