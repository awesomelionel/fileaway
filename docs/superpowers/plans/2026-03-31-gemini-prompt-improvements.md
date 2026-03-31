# Gemini Prompt Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix field-name mismatches between Gemini extraction prompts and ItemCard renderers, and improve prompt quality so Gemini returns rich, complete data from sparse social media content.

**Architecture:** All changes are in `convex/processUrl.ts`. Each category's extraction prompt schema is updated to match what `ItemCard.tsx` reads. Prompts gain explicit social-media context and few-shot inference guidance to coax richer output from brief captions.

**Tech Stack:** Google Gemini 1.5 Flash/Pro via `@google/generative-ai`, Convex Node action, TypeScript.

---

## Root Cause Analysis

Three classes of problems cause "paltry" live data:

### 1. Field-name mismatches (ItemCard reads field X, prompt defines field Y)

| Category | ItemCard reads | Prompt returns | Gap |
|----------|---------------|----------------|-----|
| how-to | `title`, `summary`, `steps` | `topic`, (no summary), `steps` | `topic`→`title` rename; add `summary` |
| video-analysis | `title`, `summary`, `key_points` | (no title), `summary`, `key_points` | add `title` |
| other | `title`, `summary` | (no title), `summary` | add `title` |

### 2. Prompt schema is missing the fields that would make cards useful

- `how-to` has no `summary` — the card's subtitle is blank
- `video-analysis` / `other` have no `title` — the card header is blank

### 3. Prompts don't guide Gemini to infer from social-media context

Social media posts are terse. A TikTok caption might be 8 words. Gemini needs explicit permission to infer cuisine from hashtags, reconstruct a dish name from emojis, etc. Currently the prompts give no such guidance.

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `convex/processUrl.ts` | Modify | All 6 extraction prompt strings + wrapper prompt |
| `tests/unit/processUrl.test.ts` | Modify | Update/add tests for the new field shapes |

---

## Task 1: Fix `how-to` extraction prompt (field rename + add `summary`)

**Files:**
- Modify: `convex/processUrl.ts` (extraction prompt for `how-to` category, ~line 260)
- Modify: `tests/unit/processUrl.test.ts`

- [ ] **Step 1: Write the failing test**

Open `tests/unit/processUrl.test.ts`. Add an assertion that the parsed result contains `title` (not `topic`) and `summary`:

```typescript
it('how-to extraction returns title and summary fields', () => {
  const raw = JSON.stringify({
    title: 'How to fold a fitted sheet',
    summary: 'A quick 3-step method for folding fitted sheets without a mess.',
    steps: ['Lay flat', 'Tuck corners', 'Fold in thirds'],
    tools_needed: [],
    difficulty: 'easy',
    time_required: '2 minutes',
  });
  const parsed = JSON.parse(raw);
  expect(parsed).toHaveProperty('title');
  expect(parsed).toHaveProperty('summary');
  expect(parsed).not.toHaveProperty('topic'); // old field name must be gone
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/lionel/Documents/code/fileaway
npm test -- --testPathPattern=processUrl --verbose 2>&1 | tail -30
```

Expected: FAIL — existing tests still reference `topic` field.

- [ ] **Step 3: Update the how-to extraction prompt in `convex/processUrl.ts`**

Find the how-to schema block (search for `"topic":`) and replace:

```typescript
// BEFORE
{
  "topic": "<what this guide is about>",
  "steps": ["<step 1>", "<step 2>"],
  "tools_needed": ["<tool or material>"],
  "difficulty": "<easy | medium | hard | null>",
  "time_required": "<estimated time or null>"
}

// AFTER
{
  "title": "<short descriptive title of what this guide teaches — infer from hashtags or context if not explicit>",
  "summary": "<one sentence describing the outcome or main benefit of following this guide>",
  "steps": ["<step 1>", "<step 2>", "<step 3 — infer likely steps from context if not all listed>"],
  "tools_needed": ["<tool or material — omit array if none mentioned>"],
  "difficulty": "<easy | medium | hard | null>",
  "time_required": "<estimated time as a string, e.g. '10 minutes' — null if unknown>"
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=processUrl --verbose 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add convex/processUrl.ts tests/unit/processUrl.test.ts
git commit -m "fix: rename how-to prompt field topic->title, add summary field"
```

---

## Task 2: Fix `video-analysis` extraction prompt (add `title`)

**Files:**
- Modify: `convex/processUrl.ts` (video-analysis schema, ~line 275)
- Modify: `tests/unit/processUrl.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
it('video-analysis extraction returns title field', () => {
  const raw = JSON.stringify({
    title: 'Why everyone is doing cold plunges',
    summary: 'Creator explains the science and personal routine behind cold exposure.',
    key_points: ['Reduces inflammation', 'Boosts dopamine', 'Start at 60°F'],
    topics: ['cold plunge', 'wellness'],
    sentiment: 'positive',
  });
  const parsed = JSON.parse(raw);
  expect(parsed).toHaveProperty('title');
  expect(parsed).toHaveProperty('summary');
  expect(parsed).toHaveProperty('key_points');
});
```

- [ ] **Step 2: Run test**

```bash
npm test -- --testPathPattern=processUrl --verbose 2>&1 | tail -30
```

Expected: FAIL — existing video-analysis tests don't assert `title`.

- [ ] **Step 3: Update the video-analysis extraction prompt**

Find the video-analysis schema block (search for `"key_points"`) and replace:

```typescript
// BEFORE
{
  "summary": "<2-3 sentence summary of the video content>",
  "key_points": ["<key point 1>", "<key point 2>"],
  "topics": ["<topic>"],
  "sentiment": "<positive | neutral | negative>"
}

// AFTER
{
  "title": "<short descriptive title — use the post title, infer from caption/hashtags if missing>",
  "summary": "<2-3 sentence summary of the video's main content and takeaway>",
  "key_points": ["<key point 1>", "<key point 2>", "<key point 3 if applicable>"],
  "topics": ["<topic tag>"],
  "sentiment": "<positive | neutral | negative>"
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=processUrl --verbose 2>&1 | tail -30
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add convex/processUrl.ts tests/unit/processUrl.test.ts
git commit -m "fix: add title field to video-analysis extraction prompt"
```

---

## Task 3: Fix `other` extraction prompt (add `title`)

**Files:**
- Modify: `convex/processUrl.ts` (other schema)
- Modify: `tests/unit/processUrl.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
it('other extraction returns title field', () => {
  const raw = JSON.stringify({
    title: 'Aesthetic morning routine inspo',
    summary: 'Creator shares their morning routine with mood-board-style visuals.',
    topics: ['morning routine', 'lifestyle'],
  });
  const parsed = JSON.parse(raw);
  expect(parsed).toHaveProperty('title');
  expect(parsed).toHaveProperty('summary');
});
```

- [ ] **Step 2: Run test**

```bash
npm test -- --testPathPattern=processUrl --verbose 2>&1 | tail -30
```

Expected: FAIL — existing other-category tests don't assert `title`.

- [ ] **Step 3: Update the `other` extraction prompt**

Find the other schema block (search for `"topics": ["<topic>"]`) and replace:

```typescript
// BEFORE
{
  "summary": "<brief description of the content>",
  "topics": ["<topic>"]
}

// AFTER
{
  "title": "<short descriptive title — infer from caption, hashtags, or creator context>",
  "summary": "<2-3 sentence description of what this post is about and why someone saved it>",
  "topics": ["<topic tag>"]
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=processUrl --verbose 2>&1 | tail -30
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add convex/processUrl.ts tests/unit/processUrl.test.ts
git commit -m "fix: add title field to other-category extraction prompt"
```

---

## Task 4: Improve extraction wrapper prompt for social-media inference

**Context:** The wrapper prompt is the system-level instruction wrapping every extraction call. It currently says nothing about inferring from sparse social media content. This is the main lever for fixing "paltry" results when captions are short.

**Files:**
- Modify: `convex/processUrl.ts` (wrapper prompt, ~line 287)
- Modify: `tests/unit/processUrl.test.ts`

- [ ] **Step 1: Export the wrapper prompt builder for testability**

In `convex/processUrl.ts`, find the wrapper prompt string/function. Change it from an inline literal to a named export:

```typescript
// Change from inline usage to:
export function buildExtractionPrompt(category: string, schema: string, postContent: string): string {
  return `
You are extracting structured data from a saved social media post.

IMPORTANT CONTEXT: Social media captions are often brief (5-15 words), emoji-heavy, or rely on visual context. You must:
- Infer missing fields from hashtags, emojis, creator name, and platform context
- Never return null for a string field if you can make a reasonable inference
- For arrays (steps, ingredients, exercises), reconstruct likely items from context clues
- Prefer a specific inferred value over null — e.g., infer cuisine from hashtags like #italian or #pasta

Category: ${category}

Required JSON schema:
${schema}

Post content:
${postContent}

Return ONLY valid JSON matching the schema above. No markdown fences, no explanation, no extra fields.
`.trim();
}
```

- [ ] **Step 2: Write the failing test**

```typescript
import { buildExtractionPrompt } from '../../convex/processUrl';

it('extraction wrapper prompt includes social-media inference guidance', () => {
  const prompt = buildExtractionPrompt('food', '{}', 'test content');
  expect(prompt).toContain('infer');
  expect(prompt).toContain('social media');
  expect(prompt).toContain('hashtags');
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- --testPathPattern=processUrl --verbose 2>&1 | tail -30
```

Expected: FAIL — `buildExtractionPrompt` not exported yet / prompt text doesn't contain those phrases.

- [ ] **Step 4: Apply the export and new prompt text**

Replace the existing wrapper prompt usage with `buildExtractionPrompt(...)` at the call site.

- [ ] **Step 5: Run all tests**

```bash
npm test --verbose 2>&1 | tail -40
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add convex/processUrl.ts tests/unit/processUrl.test.ts
git commit -m "feat: improve extraction wrapper prompt with social-media inference guidance"
```

---

## Task 5: Add inference hints to food/recipe/fitness prompts

**Context:** Food/recipe/fitness field names already match ItemCard. This task adds inline hints so Gemini infers values instead of returning null for sparse captions.

**Files:**
- Modify: `convex/processUrl.ts` (food, recipe, fitness schema strings)
- Modify: `tests/unit/processUrl.test.ts`

- [ ] **Step 1: Write regression tests for field shapes**

```typescript
it('food schema has all expected fields including dishes_mentioned', () => {
  const sample = {
    name: "Joe's Tacos",
    address: null,
    cuisine: 'Mexican',
    why_visit: 'Best al pastor in the city according to locals',
    price_range: '$',
    dishes_mentioned: ['al pastor taco', 'horchata'],
  };
  expect(sample).toHaveProperty('name');
  expect(sample).toHaveProperty('dishes_mentioned');
  expect(Array.isArray(sample.dishes_mentioned)).toBe(true);
});

it('recipe schema has steps as string array', () => {
  const sample = {
    dish_name: 'Pasta Carbonara',
    ingredients: ['200g spaghetti', '3 eggs', '100g pancetta'],
    steps: ['Boil pasta', 'Fry pancetta', 'Mix eggs with pasta off heat'],
    prep_time_minutes: 10,
    cook_time_minutes: 15,
    servings: 2,
  };
  expect(Array.isArray(sample.steps)).toBe(true);
  expect(typeof sample.steps[0]).toBe('string');
});

it('fitness exercises array has name/sets/reps shape', () => {
  const sample = {
    workout_name: 'HIIT circuit',
    exercises: [{ name: 'Burpees', sets: 3, reps: 10 }],
    muscle_groups: ['full body'],
    duration_minutes: 20,
    difficulty: 'intermediate',
  };
  expect(sample.exercises[0]).toHaveProperty('name');
  expect(sample.exercises[0]).toHaveProperty('sets');
  expect(sample.exercises[0]).toHaveProperty('reps');
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- --testPathPattern=processUrl --verbose 2>&1 | tail -30
```

Expected: all pass (shape tests on literals confirm spec is correct before touching prompts).

- [ ] **Step 3: Update food schema with inference hints**

```typescript
// AFTER
{
  "name": "<restaurant or food item name — use creator's exact wording or infer from post>",
  "address": "<full address if mentioned; infer city/neighbourhood from hashtags like #NYC or #LondonEats; null only if truly unknown>",
  "cuisine": "<cuisine type — infer from dish names, hashtags (#italian #ramen), or location>",
  "why_visit": "<one compelling reason to visit, written as a recommendation — infer from the vibe/tone of the post if not stated explicitly>",
  "price_range": "<$ | $$ | $$$ — infer from context clues like 'budget', 'Michelin', 'street food'; null if no clues>",
  "dishes_mentioned": ["<every dish, food item, or drink mentioned or shown — infer from emojis like 🍕🍜 if no text>"]
}
```

- [ ] **Step 4: Update recipe schema with inference hints**

```typescript
// AFTER
{
  "dish_name": "<name of the dish — use post title or infer from ingredients shown>",
  "ingredients": ["<ingredient with quantity — reconstruct from what's shown; include obvious staples if recipe type is clear>"],
  "steps": ["<step 1>", "<step 2>", "<infer likely steps from recipe type if not all listed>"],
  "prep_time_minutes": <number — infer from recipe complexity if not stated; null only if truly unknowable>,
  "cook_time_minutes": <number — infer from recipe type (e.g. cookies ~12 min); null only if truly unknowable>,
  "servings": <number — infer from context ('serves 4', 'family size', 'single serving'); null if no clues>
}
```

- [ ] **Step 5: Update fitness schema with inference hints**

```typescript
// AFTER
{
  "workout_name": "<name or description of the workout — use post title or infer from exercises>",
  "exercises": [
    {
      "name": "<exercise name>",
      "sets": <number — infer standard sets (3) if not specified for common exercises>,
      "reps": <number or string like "30 seconds" — infer standard reps if not stated>
    }
  ],
  "muscle_groups": ["<muscle groups targeted — infer from exercise names; e.g. squats → legs, glutes>"],
  "duration_minutes": <number — infer from number of exercises × typical time; null if no basis>,
  "difficulty": "<beginner | intermediate | advanced — infer from exercise complexity and intensity>"
}
```

- [ ] **Step 6: Run all tests**

```bash
npm test --verbose 2>&1 | tail -40
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add convex/processUrl.ts tests/unit/processUrl.test.ts
git commit -m "feat: add inference hints to food/recipe/fitness extraction prompts"
```

---

## Task 6: Manual smoke test (no code changes)

- [ ] **Step 1: Start servers**

Terminal 1: `npx convex dev`
Terminal 2: `npm run dev`

- [ ] **Step 2: Save one URL per category** at `http://localhost:3000`

- [ ] **Step 3: Verify each card**

| Category | Fields to confirm populated |
|----------|----------------------------|
| Food | `name`, `cuisine`, `why_visit`, `dishes_mentioned` |
| Recipe | `dish_name`, `ingredients` list, `steps` list |
| Fitness | `workout_name`, `exercises` array, `muscle_groups` |
| How-to | `title` (not blank), `summary` (not blank), `steps` |
| Video | `title` (not blank), `summary`, `key_points` |
| Other | `title` (not blank), `summary` |

If any field is blank, check Convex dashboard logs for the raw Gemini JSON and identify which inference hint needs strengthening.

---

## Self-Review

### Spec coverage
- [x] Field mismatches fixed: how-to (`topic`→`title`, add `summary`), video (add `title`), other (add `title`)
- [x] Wrapper prompt improved with social-media inference guidance
- [x] Food/recipe/fitness prompts improved with inference hints
- [x] Tests cover all schema shapes
- [x] Manual smoke test included

### Placeholder scan — none found

### Type consistency
- `title` used consistently for how-to, video, other (matches ItemCard reads)
- `summary` field added to how-to (matches `HowToBody` renderer)
- `steps` remains `string[]` throughout recipe and how-to
- `exercises` array shape `{name, sets, reps}` consistent with `FitnessBody`
