# Super Admin Category Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move categories from hardcoded constants to a Convex `categories` table managed by a super admin via a `/cockpit` UI, making the AI categorization and extraction pipeline fully configurable at runtime.

**Architecture:** New `categories` table stores slug, label, categorization hint, and extraction prompt per category. `processUrl.ts` reads categories from DB at runtime instead of using hardcoded constants. A hardcoded email check gates admin mutations. The frontend dynamically renders tabs and card bodies from the categories query.

**Tech Stack:** Convex (schema, queries, mutations, actions), Next.js 14 App Router, React 18, TypeScript, Tailwind CSS

**Worktree:** `.worktrees/super-admin-categories` on branch `feature/super-admin-categories`

---

### Task 1: Add `categories` table to schema and loosen `savedItems.category`

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Update schema.ts**

Add the `categories` table and change `savedItems.category` from a union of literals to `v.string()`:

```typescript
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
```

- [ ] **Step 2: Verify schema compiles**

Run: `npx convex dev --once` (or just check TypeScript compilation)
Expected: No errors. The `_generated` types are updated.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add categories table and loosen savedItems.category to v.string()"
```

---

### Task 2: Create admin guard helper

**Files:**
- Create: `convex/admin.ts`

- [ ] **Step 1: Create convex/admin.ts**

```typescript
import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";

export const ADMIN_EMAIL = "lioneltan@gmail.com";

export async function getAuthUserEmail(
  ctx: QueryCtx | MutationCtx,
): Promise<string | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  return (user?.email as string | undefined) ?? null;
}

export async function assertAdmin(ctx: QueryCtx | MutationCtx): Promise<void> {
  const email = await getAuthUserEmail(ctx);
  if (email !== ADMIN_EMAIL) {
    throw new Error("Not authorized");
  }
}

export async function isAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const email = await getAuthUserEmail(ctx);
  return email === ADMIN_EMAIL;
}
```

- [ ] **Step 2: Commit**

```bash
git add convex/admin.ts
git commit -m "feat: add admin guard helper with hardcoded email check"
```

---

### Task 3: Create category CRUD and seed mutation

**Files:**
- Create: `convex/adminCategories.ts`

- [ ] **Step 1: Create convex/adminCategories.ts**

```typescript
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
        categorizationHint: "tutorials, life hacks, DIY projects, step-by-step guides (non-recipe)",
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
```

- [ ] **Step 2: Commit**

```bash
git add convex/adminCategories.ts
git commit -m "feat: add category CRUD mutations and seed with built-in categories"
```

---

### Task 4: Update items.ts validators from literal unions to v.string()

**Files:**
- Modify: `convex/items.ts`

- [ ] **Step 1: Change CategoryType and all category validators**

In `convex/items.ts`, make these changes:

1. Remove the `CategoryType` union type and replace with `string`:

Replace:
```typescript
type CategoryType =
  | "food"
  | "fitness"
  | "recipe"
  | "how-to"
  | "video-analysis"
  | "other";
```
With:
```typescript
type CategoryType = string;
```

2. In `updateCategory` mutation args, replace the category validator:

Replace:
```typescript
    category: v.union(
      v.literal("food"),
      v.literal("fitness"),
      v.literal("recipe"),
      v.literal("how-to"),
      v.literal("video-analysis"),
      v.literal("other"),
    ),
```
With:
```typescript
    category: v.string(),
```

3. In `saveCorrection` mutation args, replace the `correctedCategory` validator:

Replace:
```typescript
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
```
With:
```typescript
    correctedCategory: v.optional(v.string()),
```

4. In `updateResult` internal mutation args, replace the category validator:

Replace:
```typescript
    category: v.union(
      v.literal("food"),
      v.literal("fitness"),
      v.literal("recipe"),
      v.literal("how-to"),
      v.literal("video-analysis"),
      v.literal("other"),
    ),
```
With:
```typescript
    category: v.string(),
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: All 102 tests pass (no behavioral changes, only type loosening)

- [ ] **Step 3: Commit**

```bash
git add convex/items.ts
git commit -m "feat: loosen category validators from literal unions to v.string()"
```

---

### Task 5: Update processUrl.ts to read categories from DB

**Files:**
- Modify: `convex/processUrl.ts`

- [ ] **Step 1: Update CategoryType and imports**

At the top of `convex/processUrl.ts`, change the `CategoryType` type:

Replace:
```typescript
type CategoryType =
  | "food"
  | "fitness"
  | "recipe"
  | "how-to"
  | "video-analysis"
  | "other";
```
With:
```typescript
type CategoryType = string;
```

- [ ] **Step 2: Remove VALID_CATEGORIES and EXTRACTION_SCHEMAS, keep WRAPPER_INSTRUCTIONS**

Delete the `VALID_CATEGORIES` array (lines 194-201).

Delete the entire `EXTRACTION_SCHEMAS` export (lines 266-316).

Keep `WRAPPER_INSTRUCTIONS` (lines 318-324) as-is — it's shared boilerplate.

- [ ] **Step 3: Update categorizeContent to read from DB**

Replace the `categorizeContent` function with:

```typescript
async function categorizeContent(
  ctx: { runQuery: (ref: any, args: any) => Promise<any> },
  scrape: ScrapeResult,
): Promise<CategoryType> {
  const categoryData: { slug: string; categorizationHint: string }[] =
    await ctx.runQuery(internal.adminCategories.listCategorySlugsAndHints, {});

  if (categoryData.length === 0) {
    console.warn("[gemini/categorize] No categories in DB, defaulting to 'other'");
    return "other";
  }

  const validSlugs = categoryData.map((c) => c.slug);
  const slugList = validSlugs.join(" | ");
  const guidelines = categoryData
    .map((c) => `- ${c.slug}: ${c.categorizationHint}`)
    .join("\n");

  console.log(`[gemini/categorize] Starting — model: ${FLASH_MODEL}, platform: ${scrape.platform}`);

  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: FLASH_MODEL });

  const parts: string[] = [
    "You are classifying a saved social media post. Respond with ONLY one of these exact category labels — no explanation:",
    slugList,
    "",
    "Guidelines:",
    guidelines,
    "",
    "Post content:",
  ];

  if (scrape.title) parts.push(`Title: ${scrape.title}`);
  if (scrape.description && scrape.description !== scrape.title) {
    parts.push(`Description: ${scrape.description}`);
  }
  if (scrape.hashtags?.length) {
    parts.push(`Hashtags: ${scrape.hashtags.join(", ")}`);
  }
  parts.push(`Platform: ${scrape.platform}`);

  const t0 = Date.now();
  let result;
  try {
    result = await model.generateContent(parts.join("\n"));
  } catch (err) {
    console.error(`[gemini/categorize] API error after ${Date.now() - t0}ms — model: ${FLASH_MODEL}`, err);
    throw err;
  }
  const raw = result.response.text().trim().toLowerCase();
  console.log(`[gemini/categorize] Response in ${Date.now() - t0}ms — raw: "${raw}"`);

  const matched = validSlugs.find((c) => raw.includes(c));
  if (!matched) {
    console.warn(`[gemini/categorize] No valid category matched in response, defaulting to "other"`);
  }
  return matched ?? "other";
}
```

- [ ] **Step 4: Update extractStructuredData to read extraction prompt from DB**

Replace the `extractStructuredData` function with:

```typescript
async function extractStructuredData(
  ctx: { runQuery: (ref: any, args: any) => Promise<any> },
  scrape: ScrapeResult,
  category: CategoryType,
): Promise<ExtractionResult> {
  const categoryRow = await ctx.runQuery(
    internal.adminCategories.getCategoryBySlug,
    { slug: category },
  );

  const useProModel = ["food", "recipe", "fitness"].includes(category);
  const modelName = useProModel ? PRO_MODEL : FLASH_MODEL;
  console.log(`[gemini/extract] Starting — model: ${modelName}, category: ${category}`);

  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: modelName });

  const extractionPrompt = categoryRow?.extractionPrompt ?? `Return JSON:\n{\n  "title": "<short descriptive title>",\n  "summary": "<2-3 sentence summary>",\n  "topics": ["<topic tag>"]\n}`;

  const prompt = buildExtractionPrompt(scrape, category, extractionPrompt);
  console.log(`[gemini/extract] Prompt length: ${prompt.length} chars`);

  const t0 = Date.now();
  let result;
  try {
    result = await model.generateContent(prompt);
  } catch (err) {
    console.error(`[gemini/extract] API error after ${Date.now() - t0}ms — model: ${modelName}, category: ${category}`, err);
    throw err;
  }
  const raw = result.response.text().trim();
  console.log(`[gemini/extract] Response in ${Date.now() - t0}ms — raw length: ${raw.length} chars`);

  let extractedData: Record<string, unknown>;
  try {
    const jsonStr = raw
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "");
    extractedData = JSON.parse(jsonStr);
  } catch (parseErr) {
    console.warn(`[gemini/extract] JSON parse failed, storing raw response`, parseErr);
    extractedData = { raw_response: raw, parse_error: true };
  }

  return {
    category,
    extractedData,
    actionTaken: getDefaultAction(category),
  };
}
```

- [ ] **Step 5: Update buildExtractionPrompt to accept prompt string**

Replace the `buildExtractionPrompt` function with:

```typescript
function buildExtractionPrompt(
  scrape: ScrapeResult,
  category: CategoryType,
  extractionPrompt: string,
): string {
  const contentBlock = [
    `Platform: ${scrape.platform}`,
    scrape.title ? `Title: ${scrape.title}` : null,
    scrape.description && scrape.description !== scrape.title
      ? `Description: ${scrape.description}`
      : null,
    scrape.authorHandle ? `Author: @${scrape.authorHandle}` : null,
    scrape.hashtags?.length ? `Hashtags: ${scrape.hashtags.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    `${WRAPPER_INSTRUCTIONS}`,
    `Category: ${category}`,
    "",
    extractionPrompt,
    "",
    "Post content:",
    contentBlock,
    "",
    "Return ONLY valid JSON matching the schema above. No markdown fences, no explanation, no extra fields.",
  ].join("\n");
}
```

- [ ] **Step 6: Update getDefaultAction for dynamic categories**

Replace the `getDefaultAction` function with:

```typescript
const BUILT_IN_ACTIONS: Record<string, string> = {
  food: "Save to Google Maps",
  recipe: "Export ingredient list",
  fitness: "Add to my routine",
  "how-to": "Save as guide",
  "video-analysis": "Save transcript",
  other: "Save for later",
};

function getDefaultAction(category: CategoryType): string {
  return BUILT_IN_ACTIONS[category] ?? "Save for later";
}
```

- [ ] **Step 7: Update processItem handler to pass ctx**

In the `processItem` action handler, update the calls to `categorizeContent` and `extractStructuredData` to pass `ctx`:

Replace:
```typescript
      const category = await categorizeContent(scrapeResult);
```
With:
```typescript
      const category = await categorizeContent(ctx, scrapeResult);
```

Replace:
```typescript
      const extraction = await extractStructuredData(scrapeResult, category);
```
With:
```typescript
      const extraction = await extractStructuredData(ctx, scrapeResult, category);
```

- [ ] **Step 8: Add missing import**

Add to the imports at the top of `processUrl.ts`:

```typescript
import { internal } from "./_generated/api";
```

This import already exists — verify it's there. If not, add it.

- [ ] **Step 9: Run tests**

Run: `npm test`
Expected: Tests pass. Some tests may need updating if they directly reference `EXTRACTION_SCHEMAS` — the export is removed. Check test output and fix if needed.

- [ ] **Step 10: Commit**

```bash
git add convex/processUrl.ts
git commit -m "feat: read categories and extraction prompts from DB instead of hardcoded constants"
```

---

### Task 6: Update frontend types

**Files:**
- Modify: `src/lib/api/types.ts`

- [ ] **Step 1: Change CategoryType to string**

In `src/lib/api/types.ts`, replace:

```typescript
export type CategoryType = "food" | "fitness" | "recipe" | "how-to" | "video-analysis" | "other";
```

With:

```typescript
export type CategoryType = string;
```

Also update the `SavedItemResponse` interface — the `category` field type is already `CategoryType` so it will follow automatically.

- [ ] **Step 2: Commit**

```bash
git add src/lib/api/types.ts
git commit -m "feat: loosen CategoryType to string for dynamic categories"
```

---

### Task 7: Update ItemCard.tsx for dynamic categories

**Files:**
- Modify: `src/components/feed/ItemCard.tsx`

- [ ] **Step 1: Make CATEGORY_META accept dynamic categories with fallback**

Replace the `CATEGORY_META` definition and add a helper function and `GenericBody` component. At the top of the file, after the imports, replace:

```typescript
export const CATEGORY_META: Record<
  CategoryType,
  { label: string; color: string; border: string; bg: string; text: string }
> = {
  food: {
    label: "Food",
    color: "#f97316",
    border: "border-l-[#f97316]",
    bg: "bg-[#f9731610]",
    text: "text-[#f97316]",
  },
  recipe: {
    label: "Recipe",
    color: "#22c55e",
    border: "border-l-[#22c55e]",
    bg: "bg-[#22c55e10]",
    text: "text-[#22c55e]",
  },
  fitness: {
    label: "Fitness",
    color: "#3b82f6",
    border: "border-l-[#3b82f6]",
    bg: "bg-[#3b82f610]",
    text: "text-[#3b82f6]",
  },
  "how-to": {
    label: "How-To",
    color: "#a855f7",
    border: "border-l-[#a855f7]",
    bg: "bg-[#a855f710]",
    text: "text-[#a855f7]",
  },
  "video-analysis": {
    label: "Video",
    color: "#14b8a6",
    border: "border-l-[#14b8a6]",
    bg: "bg-[#14b8a610]",
    text: "text-[#14b8a6]",
  },
  other: {
    label: "Other",
    color: "#6b7280",
    border: "border-l-[#6b7280]",
    bg: "bg-[#6b728010]",
    text: "text-[#6b7280]",
  },
};
```

With:

```typescript
const BUILT_IN_CATEGORY_META: Record<
  string,
  { label: string; color: string; border: string; bg: string; text: string }
> = {
  food: {
    label: "Food",
    color: "#f97316",
    border: "border-l-[#f97316]",
    bg: "bg-[#f9731610]",
    text: "text-[#f97316]",
  },
  recipe: {
    label: "Recipe",
    color: "#22c55e",
    border: "border-l-[#22c55e]",
    bg: "bg-[#22c55e10]",
    text: "text-[#22c55e]",
  },
  fitness: {
    label: "Fitness",
    color: "#3b82f6",
    border: "border-l-[#3b82f6]",
    bg: "bg-[#3b82f610]",
    text: "text-[#3b82f6]",
  },
  "how-to": {
    label: "How-To",
    color: "#a855f7",
    border: "border-l-[#a855f7]",
    bg: "bg-[#a855f710]",
    text: "text-[#a855f7]",
  },
  "video-analysis": {
    label: "Video",
    color: "#14b8a6",
    border: "border-l-[#14b8a6]",
    bg: "bg-[#14b8a610]",
    text: "text-[#14b8a6]",
  },
  other: {
    label: "Other",
    color: "#6b7280",
    border: "border-l-[#6b7280]",
    bg: "bg-[#6b728010]",
    text: "text-[#6b7280]",
  },
};

const FALLBACK_COLORS = [
  "#e11d48", "#d946ef", "#0ea5e9", "#84cc16", "#f59e0b", "#06b6d4",
];

export function getCategoryMeta(
  slug: string,
  index?: number,
): { label: string; color: string; border: string; bg: string; text: string } {
  if (BUILT_IN_CATEGORY_META[slug]) return BUILT_IN_CATEGORY_META[slug];
  const color = FALLBACK_COLORS[(index ?? 0) % FALLBACK_COLORS.length];
  return {
    label: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " "),
    color,
    border: `border-l-[${color}]`,
    bg: `bg-[${color}10]`,
    text: `text-[${color}]`,
  };
}

export const CATEGORY_META = BUILT_IN_CATEGORY_META;
```

- [ ] **Step 2: Add GenericBody component**

Add this component after `OtherBody`:

```typescript
function GenericBody({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(
    ([, v]) => v !== null && v !== undefined,
  );

  return (
    <div className="space-y-2">
      {entries.slice(0, 8).map(([key, value]) => {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

        if (Array.isArray(value)) {
          return (
            <div key={key}>
              <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle mb-1">
                {label}
              </p>
              <ul className="space-y-0.5">
                {(value as unknown[]).slice(0, 5).map((item, i) => (
                  <li key={i} className="text-xs text-fa-soft flex items-start gap-1.5">
                    <span className="text-fa-faint mt-0.5 flex-shrink-0">·</span>
                    {typeof item === "object" ? JSON.stringify(item) : String(item)}
                  </li>
                ))}
                {value.length > 5 && (
                  <li className="text-[11px] text-fa-subtle">+{value.length - 5} more</li>
                )}
              </ul>
            </div>
          );
        }

        if (typeof value === "object") return null;

        return (
          <div key={key}>
            <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle">
              {label}
            </p>
            <p className="text-xs text-fa-soft leading-relaxed">{String(value)}</p>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Update card body rendering to use GenericBody as fallback**

In the `ItemCard` component, find the body rendering section and add a fallback. Replace:

```typescript
          {item.status === "done" && item.extracted_data && (
            <>
              {item.category === "food" && <FoodBody data={item.extracted_data} />}
              {item.category === "recipe" && <RecipeBody data={item.extracted_data} />}
              {item.category === "fitness" && <FitnessBody data={item.extracted_data} />}
              {item.category === "how-to" && <HowToBody data={item.extracted_data} />}
              {item.category === "video-analysis" && <VideoBody data={item.extracted_data} />}
              {item.category === "other" && <OtherBody data={item.extracted_data} />}
            </>
          )}
```

With:

```typescript
          {item.status === "done" && item.extracted_data && (
            <>
              {item.category === "food" ? <FoodBody data={item.extracted_data} />
              : item.category === "recipe" ? <RecipeBody data={item.extracted_data} />
              : item.category === "fitness" ? <FitnessBody data={item.extracted_data} />
              : item.category === "how-to" ? <HowToBody data={item.extracted_data} />
              : item.category === "video-analysis" ? <VideoBody data={item.extracted_data} />
              : item.category === "other" ? <OtherBody data={item.extracted_data} />
              : <GenericBody data={item.extracted_data} />}
            </>
          )}
```

- [ ] **Step 4: Update meta lookup to use getCategoryMeta**

In `ItemCard`, replace:

```typescript
  const meta = CATEGORY_META[item.category];
```

With:

```typescript
  const meta = getCategoryMeta(item.category);
```

- [ ] **Step 5: Remove hardcoded CATEGORIES array, make it a prop**

Remove the `CATEGORIES` constant:

```typescript
const CATEGORIES: CategoryType[] = [
  "food",
  "recipe",
  "fitness",
  "how-to",
  "video-analysis",
  "other",
];
```

Update `ItemCardProps` to accept categories:

```typescript
interface ItemCardProps {
  item: SavedItemResponse;
  categories?: { slug: string; label: string }[];
}
```

Update the `ItemCard` function signature:

```typescript
export function ItemCard({ item, categories }: ItemCardProps) {
```

Update both `<select>` elements (the category override select and the correction modal select) to use the `categories` prop with a fallback:

In the category override select (in the footer), replace:

```typescript
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="bg-fa-muted-bg text-fa-secondary">
                      {CATEGORY_META[cat].label}
                    </option>
                  ))}
```

With:

```typescript
                  {(categories ?? []).map((cat) => (
                    <option key={cat.slug} value={cat.slug} className="bg-fa-muted-bg text-fa-secondary">
                      {cat.label}
                    </option>
                  ))}
```

Pass `categories` to `CorrectionModal`:

```typescript
      {showCorrection && (
        <CorrectionModal item={item} categories={categories} onClose={() => setShowCorrection(false)} />
      )}
```

Update `CorrectionModal` props and its select similarly:

```typescript
function CorrectionModal({
  item,
  categories,
  onClose,
}: {
  item: SavedItemResponse;
  categories?: { slug: string; label: string }[];
  onClose: () => void;
}) {
```

And in its `<select>`:

```typescript
                {(categories ?? []).map((cat) => (
                  <option key={cat.slug} value={cat.slug} className="bg-fa-muted-bg">
                    {cat.label}
                    {cat.slug === item.category ? " (current)" : ""}
                  </option>
                ))}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/feed/ItemCard.tsx
git commit -m "feat: add GenericBody fallback renderer and dynamic category support in ItemCard"
```

---

### Task 8: Update FeedApp.tsx for dynamic tabs

**Files:**
- Modify: `src/components/feed/FeedApp.tsx`

- [ ] **Step 1: Import useQuery for categories and update tab generation**

Add the categories query import and update the `FeedApp` component. Replace the static `TABS` constant and update the component.

Replace the imports section:

```typescript
import { ItemCard, CATEGORY_META } from "@/components/feed/ItemCard";
```

With:

```typescript
import { ItemCard, getCategoryMeta } from "@/components/feed/ItemCard";
```

Remove the static `TABS` constant:

```typescript
const TABS: { value: TabValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "food", label: "Food" },
  { value: "recipe", label: "Recipe" },
  { value: "fitness", label: "Fitness" },
  { value: "how-to", label: "How-To" },
  { value: "video-analysis", label: "Video" },
  { value: "other", label: "Other" },
];
```

Inside the `FeedApp` component, add the categories query and derive tabs dynamically. After the existing `useQuery` for items, add:

```typescript
  const categoriesData = useQuery(api.adminCategories.listCategories);
  const categories = categoriesData ?? [];

  const tabs: { value: string; label: string }[] = [
    { value: "all", label: "All" },
    ...categories.map((c) => ({ value: c.slug, label: c.label })),
  ];
```

Update `CategoryTabs` to accept dynamic tabs and use `getCategoryMeta`:

```typescript
function CategoryTabs({
  active,
  counts,
  tabs,
  onChange,
}: {
  active: string;
  counts: Record<string, number>;
  tabs: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
      {tabs.map(({ value, label }) => {
        const isActive = active === value;
        const color = value !== "all" ? getCategoryMeta(value).color : undefined;
        const count = value === "all" ? counts._total : counts[value];

        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            style={isActive && color ? { borderColor: color, color } : undefined}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? "bg-fa-input border border-fa-strong"
                : "text-fa-subtle hover:text-fa-muted hover:bg-fa-elevated border border-transparent"
            }`}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span
                className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                  isActive ? "bg-fa-count-active" : "bg-fa-muted-bg text-fa-faint"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

Update the `CategoryTabs` usage in the JSX to pass `tabs`:

```typescript
            <CategoryTabs
              active={activeCategory}
              counts={counts}
              tabs={tabs}
              onChange={(v) => updateParam({ category: v === "all" ? null : v })}
            />
```

Update `TabValue` type from `"all" | CategoryType` to just `string`.

Update the `EmptyState` component to use `getCategoryMeta`:

Replace:
```typescript
          : `No ${CATEGORY_META[category as CategoryType]?.label ?? category} items yet`}
```
With:
```typescript
          : `No ${getCategoryMeta(category).label} items yet`}
```

Pass `categories` to each `ItemCard`:

```typescript
              <ItemCard
                key={item.id}
                item={item}
                categories={categories.map((c) => ({ slug: c.slug, label: c.label }))}
              />
```

- [ ] **Step 2: Update the import for api to include adminCategories**

The api import (`import { api } from "../../../convex/_generated/api"`) already auto-includes all exports. No manual change needed — Convex generates this.

- [ ] **Step 3: Commit**

```bash
git add src/components/feed/FeedApp.tsx
git commit -m "feat: dynamic category tabs from DB query instead of hardcoded TABS"
```

---

### Task 9: Create the /cockpit admin page

**Files:**
- Create: `src/app/cockpit/page.tsx`

- [ ] **Step 1: Create the admin page component**

Create `src/app/cockpit/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ADMIN_EMAIL } from "../../../convex/admin";
import { useConvexAuth } from "convex/react";

function useCurrentUserEmail() {
  const { isAuthenticated } = useConvexAuth();
  const categories = useQuery(
    api.adminCategories.listCategories,
    isAuthenticated ? {} : "skip",
  );
  return { isAuthenticated, categories };
}

export default function CockpitPage() {
  const { isAuthenticated } = useConvexAuth();
  const categories = useQuery(
    api.adminCategories.listCategories,
    isAuthenticated ? {} : "skip",
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const seedCategories = useMutation(api.adminCategories.seedCategories);
  const createCategory = useMutation(api.adminCategories.createCategory);
  const updateCategoryMut = useMutation(api.adminCategories.updateCategory);
  const deleteCategory = useMutation(api.adminCategories.deleteCategory);

  const [seedStatus, setSeedStatus] = useState<"idle" | "loading" | "done">("idle");

  const handleSeed = async () => {
    setSeedStatus("loading");
    try {
      await seedCategories();
      setSeedStatus("done");
    } catch {
      setSeedStatus("idle");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-fa-canvas flex items-center justify-center">
        <p className="text-fa-subtle text-sm">Not authenticated</p>
      </div>
    );
  }

  if (categories === undefined) {
    return (
      <div className="min-h-screen bg-fa-canvas flex items-center justify-center">
        <p className="text-fa-subtle text-sm">Loading…</p>
      </div>
    );
  }

  const editingCategory = editingId
    ? categories.find((c) => c._id === editingId)
    : null;

  return (
    <div className="min-h-screen bg-fa-canvas text-fa-primary">
      <header className="border-b border-fa-border bg-fa-canvas/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-fa-subtle hover:text-fa-muted text-xs">
              ← Feed
            </a>
            <h1 className="font-bold text-sm tracking-tight">
              Cockpit
              <span className="text-fa-faint font-normal ml-2 text-xs">Category Management</span>
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Seed button — only when empty */}
        {categories.length === 0 && (
          <div className="bg-fa-surface border border-fa-line rounded-lg p-6 text-center space-y-3">
            <p className="text-sm text-fa-secondary">No categories found. Seed the built-in defaults?</p>
            <button
              onClick={handleSeed}
              disabled={seedStatus !== "idle"}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-fa-btn-bg text-fa-btn-fg hover:bg-fa-btn-hover disabled:opacity-40 transition-all"
            >
              {seedStatus === "loading" ? "Seeding…" : seedStatus === "done" ? "✓ Seeded!" : "Seed Built-in Categories"}
            </button>
          </div>
        )}

        {/* Actions bar */}
        {categories.length > 0 && !creating && !editingId && (
          <div className="flex justify-between items-center">
            <p className="text-xs text-fa-subtle">{categories.length} categories</p>
            <button
              onClick={() => setCreating(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-fa-btn-bg text-fa-btn-fg hover:bg-fa-btn-hover transition-all"
            >
              + New Category
            </button>
          </div>
        )}

        {/* Create form */}
        {creating && (
          <CategoryForm
            onSave={async (data) => {
              await createCategory(data);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        )}

        {/* Edit form */}
        {editingCategory && (
          <CategoryForm
            initial={editingCategory}
            onSave={async (data) => {
              await updateCategoryMut({
                id: editingCategory._id,
                label: data.label,
                extractionPrompt: data.extractionPrompt,
                categorizationHint: data.categorizationHint,
                sortOrder: data.sortOrder,
              });
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
            onDelete={
              editingCategory.isBuiltIn
                ? undefined
                : async () => {
                    if (confirm(`Delete category "${editingCategory.label}"? This cannot be undone.`)) {
                      await deleteCategory({ id: editingCategory._id });
                      setEditingId(null);
                    }
                  }
            }
          />
        )}

        {/* Category list */}
        {!creating && !editingId && categories.length > 0 && (
          <div className="bg-fa-surface border border-fa-line rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-fa-separator text-xs text-fa-subtle">
                  <th className="text-left px-4 py-2 font-medium">Slug</th>
                  <th className="text-left px-4 py-2 font-medium">Label</th>
                  <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Hint</th>
                  <th className="text-center px-4 py-2 font-medium w-16">Order</th>
                  <th className="text-center px-4 py-2 font-medium w-20">Type</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr
                    key={cat._id}
                    onClick={() => setEditingId(cat._id)}
                    className="border-b border-fa-separator last:border-b-0 hover:bg-fa-elevated cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-fa-secondary">{cat.slug}</td>
                    <td className="px-4 py-2.5 text-fa-primary font-medium">{cat.label}</td>
                    <td className="px-4 py-2.5 text-xs text-fa-subtle truncate max-w-[200px] hidden sm:table-cell">
                      {cat.categorizationHint}
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono text-xs text-fa-faint">{cat.sortOrder}</td>
                    <td className="px-4 py-2.5 text-center">
                      {cat.isBuiltIn ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3b82f610] text-[#3b82f6]">built-in</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#22c55e10] text-[#22c55e]">custom</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

interface CategoryFormData {
  slug: string;
  label: string;
  extractionPrompt: string;
  categorizationHint: string;
  sortOrder: number;
}

function CategoryForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: {
    _id: Id<"categories">;
    slug: string;
    label: string;
    extractionPrompt: string;
    categorizationHint: string;
    sortOrder: number;
    isBuiltIn: boolean;
  };
  onSave: (data: CategoryFormData) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [hint, setHint] = useState(initial?.categorizationHint ?? "");
  const [prompt, setPrompt] = useState(initial?.extractionPrompt ?? "");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!initial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim() || !label.trim() || !prompt.trim()) {
      setError("Slug, label, and extraction prompt are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ slug: slug.trim(), label: label.trim(), extractionPrompt: prompt, categorizationHint: hint.trim(), sortOrder });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-fa-surface border border-fa-line rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-fa-primary">
          {isEditing ? `Edit: ${initial.label}` : "New Category"}
        </h2>
        {onDelete && (
          <button
            onClick={onDelete}
            className="text-xs px-3 py-1.5 rounded-lg text-[#ef4444] border border-[#ef444430] hover:bg-[#ef444415] transition-colors"
          >
            Delete
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-medium text-fa-subtle uppercase tracking-wider mb-1">
              Slug
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              disabled={isEditing}
              placeholder="e.g. travel"
              className="w-full bg-fa-input border border-fa-line rounded-lg px-3 py-2 text-sm text-fa-primary placeholder-fa-placeholder outline-none focus:border-fa-ring disabled:opacity-50 font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-fa-subtle uppercase tracking-wider mb-1">
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Travel"
              className="w-full bg-fa-input border border-fa-line rounded-lg px-3 py-2 text-sm text-fa-primary placeholder-fa-placeholder outline-none focus:border-fa-ring"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-fa-subtle uppercase tracking-wider mb-1">
              Sort Order
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              className="w-full bg-fa-input border border-fa-line rounded-lg px-3 py-2 text-sm text-fa-primary outline-none focus:border-fa-ring font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-fa-subtle uppercase tracking-wider mb-1">
            Categorization Hint
            <span className="font-normal text-fa-faint ml-1">(one-line description for AI classification)</span>
          </label>
          <input
            type="text"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="e.g. travel destinations, trip itineraries, hotel and flight recommendations"
            className="w-full bg-fa-input border border-fa-line rounded-lg px-3 py-2 text-sm text-fa-primary placeholder-fa-placeholder outline-none focus:border-fa-ring"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-fa-subtle uppercase tracking-wider mb-1">
            Extraction Prompt
            <span className="font-normal text-fa-faint ml-1">(JSON schema template sent to Gemini)</span>
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={12}
            placeholder={`Return JSON:\n{\n  "title": "<...>",\n  "summary": "<...>"\n}`}
            className="w-full bg-fa-input border border-fa-line rounded-lg px-3 py-2 text-sm text-fa-primary placeholder-fa-placeholder outline-none focus:border-fa-ring resize-y font-mono leading-relaxed"
          />
        </div>

        {error && <p className="text-xs text-[#ef4444]">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs text-fa-subtle hover:text-fa-muted hover:bg-fa-elevated border border-fa-line transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-fa-btn-bg text-fa-btn-fg hover:bg-fa-btn-hover disabled:opacity-40 transition-all"
          >
            {saving ? "Saving…" : isEditing ? "Update Category" : "Create Category"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/cockpit/page.tsx
git commit -m "feat: add /cockpit admin page for category management"
```

---

### Task 10: Add admin link to navigation header

**Files:**
- Modify: `src/components/feed/FeedApp.tsx`

- [ ] **Step 1: Add admin link in header**

In `FeedApp.tsx`, import `ADMIN_EMAIL` and `useConvexAuth`:

Add to imports:
```typescript
import { useConvexAuth } from "convex/react";
import { ADMIN_EMAIL } from "../../../convex/admin";
```

Inside the `FeedApp` component, add a query to check the current user's email. After the existing `useQuery` calls, add:

```typescript
  const currentUserEmail = useQuery(api.adminCategories.listCategories) !== undefined ? null : null;
```

Actually, a simpler approach: just expose `ADMIN_EMAIL` and check on the client. The admin check is already done server-side for mutations. For the nav link, we can use a lightweight approach by storing the current user email.

In the header nav section, between the "Share" link and `SignOutButton`, add:

```typescript
              <AdminLink />
```

Add the `AdminLink` component above `FeedApp`:

```typescript
function AdminLink() {
  const user = useQuery(api.adminCategories.listCategories);
  if (user === undefined) return null;
  return (
    <a
      href="/cockpit"
      className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs text-fa-subtle hover:text-fa-muted hover:bg-fa-elevated border border-transparent transition-all"
    >
      Cockpit
    </a>
  );
}
```

Note: This shows the Cockpit link to all authenticated users — but the page itself is admin-gated via the mutations. For a simple hardcoded-admin app, this is acceptable. If you want to hide the link from non-admins, we'd need a separate query to check admin status. For now, the link is visible but the page is safe.

- [ ] **Step 2: Commit**

```bash
git add src/components/feed/FeedApp.tsx
git commit -m "feat: add Cockpit link in navigation header"
```

---

### Task 11: Update existing tests

**Files:**
- Modify: `tests/` — any tests referencing `EXTRACTION_SCHEMAS` or hardcoded category types

- [ ] **Step 1: Check which tests reference removed exports**

Run: `npm test` and check for failures.

If any test imports `EXTRACTION_SCHEMAS` from `processUrl.ts`, update it — this export was removed. The `WRAPPER_INSTRUCTIONS` export remains.

If tests have hardcoded category literal type assertions, update them to use `string`.

- [ ] **Step 2: Fix any broken tests**

Fix imports and type assertions as needed based on test output.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "fix: update tests for dynamic category types and removed EXTRACTION_SCHEMAS export"
```

---

### Task 12: Final verification

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: No new lint errors.

- [ ] **Step 2: Run build**

Run: `npm run build` (or at minimum `npx tsc --noEmit`)
Expected: No TypeScript errors.

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "chore: fix lint and type errors from category management feature"
```
