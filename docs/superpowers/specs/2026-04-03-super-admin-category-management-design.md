# Super Admin Category Management — Design Spec

## Summary

Add a super admin capability that allows a single hardcoded admin user to create, edit, and delete categories — including defining the extraction prompt that tells Gemini what structured data to extract for each category. Categories move from hardcoded constants to a Convex `categories` table, making the entire AI pipeline configurable at runtime without code deploys.

## Decisions

| Question | Decision |
|----------|----------|
| Admin designation | Hardcoded email check — single admin, no roles table |
| Category config scope | Slug, label, categorization hint, extraction prompt |
| Card rendering for new categories | Generic renderer (key-value display); existing 6 keep specialized renderers |
| Admin UI location | Dedicated route at `/cockpit` (non-obvious name) |
| Architecture | Categories table with runtime reads (Approach 1) |

## Data Model

### New table: `categories`

| Field | Type | Description |
|-------|------|-------------|
| `slug` | `v.string()` | Machine-readable ID (e.g. `"food"`, `"travel"`). Unique. Used as the value stored in `savedItems.category`. |
| `label` | `v.string()` | Display name (e.g. `"Food"`, `"Travel"`) |
| `extractionPrompt` | `v.string()` | Full extraction schema prompt sent to Gemini — the JSON template and instructions |
| `categorizationHint` | `v.string()` | One-line guideline for the categorization prompt (e.g. `"restaurants, food spots, dishes to try"`) |
| `sortOrder` | `v.number()` | Controls display order in tabs and admin list |
| `isBuiltIn` | `v.boolean()` | `true` for the original 6 categories; prevents accidental deletion |

**Index:** `by_slug` on `slug` for uniqueness checks and lookups.

### Changes to `savedItems`

- `category` field changes from `v.union(v.literal("food"), v.literal("fitness"), ...)` to `v.string()`
- No other field changes

### No auth table changes

Admin check is a simple email comparison in a helper function — no schema changes to user/auth tables.

## Backend

### Admin guard — `convex/admin.ts`

A helper module exporting:

- `ADMIN_EMAIL` constant — the hardcoded admin email address
- `assertAdmin(ctx)` — async function that gets the authenticated user, resolves their email from the auth tables, and throws `"Not authorized"` if it doesn't match `ADMIN_EMAIL`
- `isAdmin(ctx)` — async function returning `boolean` (non-throwing variant for queries)

### Category CRUD — `convex/adminCategories.ts`

| Function | Type | Auth | Description |
|----------|------|------|-------------|
| `listCategories` | `query` | Any authenticated user | Returns all categories ordered by `sortOrder`. Needed by all users for tabs/cards/dropdowns. |
| `getCategory` | `query` | Admin only | Returns a single category by ID for the edit form. |
| `createCategory` | `mutation` | Admin only | Creates a new category. Validates slug uniqueness (query `by_slug` index). Sets `isBuiltIn: false`. |
| `updateCategory` | `mutation` | Admin only | Updates label, extractionPrompt, categorizationHint, sortOrder. Slug is immutable after creation. |
| `deleteCategory` | `mutation` | Admin only | Deletes a category. Throws if `isBuiltIn === true`. |
| `seedCategories` | `mutation` | Admin only | One-time migration: inserts the existing 6 categories with their current extraction prompts and categorization hints from the codebase. Skips any that already exist (by slug). |

### Pipeline changes — `convex/processUrl.ts`

**`categorizeContent` changes:**
- New internal query `listCategorySlugsAndHints` returns `{ slug, categorizationHint }[]` from the `categories` table
- The categorization prompt is built dynamically: category list and guidelines are constructed from DB rows instead of hardcoded `VALID_CATEGORIES` and inline guideline strings
- Fallback: if no categories exist in DB (pre-seed), falls back to `"other"`

**`extractStructuredData` changes:**
- New internal query `getCategoryBySlug` returns the full category row for a given slug
- `buildExtractionPrompt` reads `extractionPrompt` from the category row instead of `EXTRACTION_SCHEMAS`
- `EXTRACTION_SCHEMAS` constant is removed (its per-category content moves to the DB via seed)
- `WRAPPER_INSTRUCTIONS` remains as a constant since it's shared boilerplate across all categories

**`getDefaultAction` changes:**
- Built-in category slugs keep their current action strings via a hardcoded map
- Any slug not in the map defaults to `"Save for later"`

### Validator changes — `convex/items.ts`

All `v.union(v.literal("food"), v.literal("fitness"), ...)` validators for `category` fields become `v.string()` in:
- `updateCategory` mutation args
- `saveCorrection` mutation args (`correctedCategory`)
- `updateResult` internal mutation args

`CategoryType` type alias becomes `string`.

## Frontend

### Admin route — `src/app/cockpit/page.tsx`

Protected by auth middleware (already covers all non-public routes) plus a client-side admin email check. If the user is not the admin, redirects to `/`.

**Components:**

- `CockpitPage` — main page component with category list and create/edit form
- `CategoryList` — table showing all categories: slug, label, sort order, built-in badge. Click row to edit.
- `CategoryForm` — create/edit form with fields:
  - Slug (text input, create only — disabled when editing)
  - Label (text input)
  - Categorization hint (text input, single line)
  - Extraction prompt (textarea, monospace, large — ~10 rows)
  - Sort order (number input)
  - Save / Cancel buttons
- `SeedButton` — shown only when 0 categories exist. Calls `seedCategories` mutation.
- Delete button — visible on edit form for non-built-in categories. Confirmation dialog before deletion.

### Navigation changes

- Header gets an admin-only link to `/cockpit` — only rendered when the current user's email matches `ADMIN_EMAIL`
- Non-admin users never see the link

### Feed changes — `src/components/feed/FeedApp.tsx`

- `TABS` array becomes dynamic: `useQuery(api.adminCategories.listCategories)` provides the category list
- The "all" tab remains hardcoded as the first tab
- Each category from the query becomes a tab with label and slug
- `CATEGORY_META` (colors/icons per category) is extended: built-in slugs keep their existing colors, new categories get auto-assigned colors from a palette based on their index

### Card changes — `src/components/feed/ItemCard.tsx`

- Existing specialized card bodies (`FoodBody`, `RecipeBody`, `FitnessBody`, `HowToBody`, `VideoBody`, `OtherBody`) remain for their known slugs
- New `GenericBody` component handles any unrecognized category slug — iterates over `extractedData` keys and renders them as labeled fields (key → human-readable label, value → displayed value)
- `CATEGORIES` array (used in the override `<select>`) becomes dynamic, populated from the categories query
- `CATEGORY_META` lookup falls back to a default color/icon for unknown slugs

### Type changes — `src/lib/api/types.ts`

- `CategoryType` changes from `"food" | "fitness" | "recipe" | "how-to" | "video-analysis" | "other"` to `string`

## Error Handling

- **Slug uniqueness:** `createCategory` checks `by_slug` index before insert; throws descriptive error if duplicate
- **Built-in deletion guard:** `deleteCategory` throws if `isBuiltIn === true`
- **Empty categories table:** Pipeline falls back gracefully — categorizes as `"other"` and returns raw data if no extraction prompt found
- **Admin access denied:** Non-admin users hitting admin mutations get `"Not authorized"` error; UI redirects away from `/cockpit`

## Migration / Seeding

The `seedCategories` mutation inserts the 6 built-in categories with:
- Slugs: `food`, `recipe`, `fitness`, `how-to`, `video-analysis`, `other`
- Labels: `Food`, `Recipe`, `Fitness`, `How-To`, `Video Analysis`, `Other`
- Extraction prompts: copied verbatim from the current `EXTRACTION_SCHEMAS` values in `processUrl.ts`
- Categorization hints: copied from the current inline guidelines in `categorizeContent`
- Sort orders: `0` through `5`
- `isBuiltIn: true`

Existing `savedItems` rows are unaffected — their `category` string values already match the slugs.

## Out of Scope

- Multi-admin / role system
- Per-category Gemini model selection
- Custom card renderer templates for admin-created categories
- Category archival / soft-delete
- Per-user category preferences (covered by the separate user-managed-categories plan)


## Current seeded prompts
  fitness
  Extract ALL details from this fitness/workout video. Return JSON:
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
  IMPORTANT: List EVERY exercise shown or performed. Do not stop after 2-3. If 6 exercises are demonstrated, return
  all 6.

  ---
  recipe
  Extract ALL details from this recipe video or post. Return JSON:
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
  IMPORTANT: List EVERY ingredient and EVERY step. Never truncate.

  ---
  food
  Extract ALL details about this restaurant or food spot. Return JSON:
  {
    "name": "<restaurant or food item name>",
    "address": "<full address; infer city/neighbourhood from hashtags or handle; null only if truly unknown>",
    "cuisine": "<cuisine type>",
    "why_visit": "<the most compelling reason to visit, based on what's shown>",
    "price_range": "<$ | $$ | $$$ — infer from context if not stated>",
    "dishes_mentioned": ["<every dish, drink, or food item shown or mentioned>"],
    "hours": "<opening hours if mentioned, else null>",
    "phone": "<phone number if mentioned, else null>"
  }

  ---
  how-to
  Extract ALL details from this how-to or tutorial. Return JSON:
  {
    "title": "<short descriptive title for what is being taught>",
    "summary": "<one sentence describing the end result or skill gained>",
    "steps": ["<every step in order — be specific and actionable, list ALL steps>"],
    "tools_needed": ["<every tool, material, or app required>"],
    "difficulty": "<easy | medium | hard>",
    "time_required": "<estimated total time as a string, e.g. '30 minutes'>",
    "tips": ["<any pro tips, warnings, or shortcuts mentioned>"]
  }

  ---
  video-analysis
  Extract ALL details from this video. Return JSON:
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
  Include 3-8 shots and 3-6 takeaways. Infer shots from caption/hashtags if no video available.

  ---
  other
  Extract the key details from this saved post. Return JSON:
  {
    "title": "<short descriptive title>",
    "summary": "<2-3 sentence description of what this is about>",
    "topics": ["<relevant topic tags>"]
  }
