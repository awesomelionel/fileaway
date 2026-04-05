# Re-categorize and Re-process Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user changes an item's category via the dropdown, re-run the full extraction pipeline using the corrected category — so the extracted data matches the new category's schema.

**Architecture:** A new public mutation `reprocessWithCategory` sets the item's status back to `pending` and re-schedules the existing `processItem` action with an `overrideCategory` arg. `processItem` skips the Gemini categorisation step when `overrideCategory` is provided. The `ItemCard` category dropdown calls `reprocessWithCategory` instead of `updateCategory`.

**Tech Stack:** Convex mutations + actions (`convex/items.ts`, `convex/processUrl.ts`), React (`src/components/feed/ItemCard.tsx`), Jest + ts-jest for unit tests.

---

## File Structure

| File | Change |
|------|--------|
| `convex/items.ts` | Export `canReprocess(status)` helper; add `reprocessWithCategory` mutation |
| `convex/processUrl.ts` | Add `overrideCategory?: string` arg to `processItem`; skip categorisation when set |
| `src/components/feed/ItemCard.tsx` | `handleCategoryChange` calls `reprocessWithCategory` instead of `updateCategory` |
| `tests/unit/items.test.ts` | Add `canReprocess` unit tests |

---

### Task 1: Export `canReprocess` helper and add unit tests

**Files:**
- Modify: `convex/items.ts`
- Modify: `tests/unit/items.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit/items.test.ts` after the existing imports:

```typescript
import { extractThumbnailUrl, canReprocess } from "../../convex/items";
```

And add this describe block at the end of the file:

```typescript
describe("canReprocess", () => {
  it("returns true for done items", () => {
    expect(canReprocess("done")).toBe(true);
  });

  it("returns false for pending items", () => {
    expect(canReprocess("pending")).toBe(false);
  });

  it("returns false for processing items", () => {
    expect(canReprocess("processing")).toBe(false);
  });

  it("returns false for failed items", () => {
    expect(canReprocess("failed")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/unit/items.test.ts
```

Expected: FAIL — `canReprocess is not a function` (or similar import error).

- [ ] **Step 3: Add `canReprocess` to `convex/items.ts`**

Add this function immediately after the `getOwnedItem` helper (around line 92, before the `// ─── Public queries` comment):

```typescript
/** Returns true if the item is eligible for re-processing with a new category. */
export function canReprocess(status: string): boolean {
  return status === "done";
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/unit/items.test.ts
```

Expected: All tests pass (existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add convex/items.ts tests/unit/items.test.ts
git commit -m "feat: export canReprocess helper with unit tests"
```

---

### Task 2: Add `reprocessWithCategory` mutation to `convex/items.ts`

**Files:**
- Modify: `convex/items.ts`

- [ ] **Step 1: Add the mutation**

Add the following after the `retryItem` mutation (around line 296, before `// ─── Internal mutations`):

```typescript
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
    });
    return true;
  },
});
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: All 97 tests pass. (The mutation itself is not directly unit-testable without the Convex test harness, but the helper it calls — `canReprocess` — is already covered.)

- [ ] **Step 3: Commit**

```bash
git add convex/items.ts
git commit -m "feat: add reprocessWithCategory mutation"
```

---

### Task 3: Accept `overrideCategory` in `processItem`

**Files:**
- Modify: `convex/processUrl.ts`

- [ ] **Step 1: Add `overrideCategory` to the args validator**

In `convex/processUrl.ts`, locate the `processItem` export (around line 511). Change the `args` block from:

```typescript
  args: {
    savedItemId: v.id("savedItems"),
    url: v.string(),
  },
```

to:

```typescript
  args: {
    savedItemId: v.id("savedItems"),
    url: v.string(),
    overrideCategory: v.optional(v.string()),
  },
```

- [ ] **Step 2: Use `overrideCategory` to skip categorisation**

In the same handler, change the destructure line from:

```typescript
  handler: async (ctx, { savedItemId, url }) => {
```

to:

```typescript
  handler: async (ctx, { savedItemId, url, overrideCategory }) => {
```

Then find this block (around line 536–538):

```typescript
      console.log(`[processUrl] Categorizing content...`);
      const category = await categorizeContent(ctx, scrapeResult);
      console.log(`[processUrl] Category resolved: ${category}`);
```

Replace it with:

```typescript
      let category: string;
      if (overrideCategory) {
        category = overrideCategory;
        console.log(`[processUrl] Category overridden by user: ${category}`);
      } else {
        console.log(`[processUrl] Categorizing content...`);
        category = await categorizeContent(ctx, scrapeResult);
        console.log(`[processUrl] Category resolved: ${category}`);
      }
```

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: All tests pass (the `shouldUseVideoAnalysis` and `WRAPPER_INSTRUCTIONS` tests are unaffected).

- [ ] **Step 4: Commit**

```bash
git add convex/processUrl.ts
git commit -m "feat: support overrideCategory in processItem to skip categorisation"
```

---

### Task 4: Wire `ItemCard` category dropdown to `reprocessWithCategory`

**Files:**
- Modify: `src/components/feed/ItemCard.tsx`

- [ ] **Step 1: Replace the mutation import**

In `ItemCard.tsx`, locate around line 683:

```typescript
  const updateCategory = useMutation(api.items.updateCategory);
```

Replace with:

```typescript
  const reprocessWithCategory = useMutation(api.items.reprocessWithCategory);
```

- [ ] **Step 2: Update `handleCategoryChange`**

Locate the `handleCategoryChange` handler (around line 689):

```typescript
  const handleCategoryChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCat = e.target.value as CategoryType;
    if (newCat === item.category) return;
    setOverriding(true);
    try {
      await updateCategory({ id: item.id as Id<"savedItems">, category: newCat });
    } finally {
      setOverriding(false);
    }
  };
```

Replace with:

```typescript
  const handleCategoryChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCat = e.target.value as CategoryType;
    if (newCat === item.category) return;
    setOverriding(true);
    try {
      await reprocessWithCategory({ id: item.id as Id<"savedItems">, category: newCat });
    } finally {
      setOverriding(false);
    }
  };
```

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: All tests pass. (Component files are excluded from coverage; no component test changes needed.)

- [ ] **Step 4: Commit**

```bash
git add src/components/feed/ItemCard.tsx
git commit -m "feat: re-process item with new category when user changes category dropdown"
```

---

## Verification

After all 4 tasks are committed:

1. **Unit tests:** `npm test` — all tests pass (97+ tests).
2. **Manual smoke test:**
   - Save a TikTok fitness video link — it processes as `fitness`.
   - Change the category dropdown to `recipe`.
   - The card immediately shows `Queued` / `Processing` state.
   - After processing completes, the card shows recipe-formatted data (dish name, ingredients, steps) instead of the old exercise list.
3. **Re-check wrong direction:** Change a `recipe` item to `fitness` — confirm it comes back with workout structure.
