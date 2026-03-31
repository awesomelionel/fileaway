# Phase 4: Polish & Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver user corrections, dashboard stats, retry for failed items, mobile layout polish, and a bookmarklet so fileaway.app is production-ready for everyday use.

**Architecture:** Three Convex mutations/queries (`saveCorrection`, `retryItem`, `stats`) are added to `convex/items.ts`. A pure `computeStats()` helper in `src/lib/dashboard.ts` is extracted for testability. New UI: correction modal and retry button added to `ItemCard`, a `/dashboard` page, an `/add?url=` page for bookmarklet targets, and a `/share` page with bookmarklet instructions. Mobile polish is CSS changes in `FeedApp.tsx`.

**Tech Stack:** Convex (mutations/queries/scheduler), Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Jest + ts-jest

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `convex/items.ts` | Add `saveCorrection`, `retryItem`, `stats`; expose `userCorrection` in `toResponse` |
| Modify | `src/lib/api/types.ts` | Add `user_correction` field to `SavedItemResponse` |
| Create | `src/lib/dashboard.ts` | Pure `computeStats()` — testable without Convex runtime |
| Modify | `src/components/feed/ItemCard.tsx` | Add `CorrectionModal` + "That's wrong" button + "Retry" button for failed items |
| Create | `src/components/dashboard/DashboardView.tsx` | Dashboard stats UI |
| Create | `src/app/dashboard/page.tsx` | Dashboard route (server component, auth guard) |
| Create | `src/app/add/page.tsx` | Auto-fill/submit URL from `?url=` query param |
| Create | `src/app/share/page.tsx` | Bookmarklet instructions + drag link |
| Modify | `src/components/feed/FeedApp.tsx` | Add Dashboard/Share nav links; fix mobile header |
| Create | `tests/unit/dashboard-stats.test.ts` | Tests for `computeStats()` |

---

### Task 1: Pure `computeStats` helper + tests (TDD first)

**Files:**
- Create: `src/lib/dashboard.ts`
- Create: `tests/unit/dashboard-stats.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/dashboard-stats.test.ts`:

```typescript
import { computeStats } from "@/lib/dashboard";

function makeItem(overrides: {
  _id?: string;
  sourceUrl?: string;
  category?: string;
  status?: string;
  _creationTime?: number;
}) {
  return {
    _id: "id1",
    sourceUrl: "https://tiktok.com/video/1",
    category: "food",
    status: "done",
    _creationTime: 1_000_000,
    ...overrides,
  };
}

describe("computeStats()", () => {
  it("returns zero counts for an empty array", () => {
    const result = computeStats([]);
    expect(result.total).toBe(0);
    expect(result.byCategory).toEqual({});
    expect(result.failedCount).toBe(0);
    expect(result.processingCount).toBe(0);
    expect(result.recentItems).toHaveLength(0);
  });

  it("counts done items by category", () => {
    const items = [
      makeItem({ _id: "1", category: "food",   status: "done" }),
      makeItem({ _id: "2", category: "food",   status: "done" }),
      makeItem({ _id: "3", category: "recipe", status: "done" }),
    ];
    const result = computeStats(items);
    expect(result.total).toBe(3);
    expect(result.byCategory).toEqual({ food: 2, recipe: 1 });
  });

  it("does NOT count pending/processing/failed items in byCategory", () => {
    const items = [
      makeItem({ _id: "1", category: "food", status: "pending" }),
      makeItem({ _id: "2", category: "food", status: "processing" }),
      makeItem({ _id: "3", category: "food", status: "failed" }),
    ];
    const result = computeStats(items);
    expect(result.byCategory).toEqual({});
  });

  it("counts failed items in failedCount", () => {
    const items = [
      makeItem({ _id: "1", status: "failed" }),
      makeItem({ _id: "2", status: "failed" }),
      makeItem({ _id: "3", status: "done" }),
    ];
    const result = computeStats(items);
    expect(result.failedCount).toBe(2);
  });

  it("counts pending and processing together in processingCount", () => {
    const items = [
      makeItem({ _id: "1", status: "pending" }),
      makeItem({ _id: "2", status: "processing" }),
      makeItem({ _id: "3", status: "done" }),
    ];
    const result = computeStats(items);
    expect(result.processingCount).toBe(2);
  });

  it("returns up to 5 items in recentItems regardless of input size", () => {
    const items = Array.from({ length: 8 }, (_, i) =>
      makeItem({ _id: `id${i}`, _creationTime: i * 1000 })
    );
    const result = computeStats(items);
    expect(result.recentItems).toHaveLength(5);
  });

  it("formats createdAt as ISO string", () => {
    const ts = new Date("2026-01-15T10:00:00.000Z").getTime();
    const items = [makeItem({ _id: "1", _creationTime: ts })];
    const result = computeStats(items);
    expect(result.recentItems[0].createdAt).toBe("2026-01-15T10:00:00.000Z");
  });

  it("recentItems preserves the input order (most recent first)", () => {
    const items = [
      makeItem({ _id: "newest", _creationTime: 3000 }),
      makeItem({ _id: "middle", _creationTime: 2000 }),
      makeItem({ _id: "oldest", _creationTime: 1000 }),
    ];
    const result = computeStats(items);
    expect(result.recentItems[0].id).toBe("newest");
    expect(result.recentItems[2].id).toBe("oldest");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd /path/to/fileaway && npm test -- tests/unit/dashboard-stats.test.ts
```

Expected output: `Cannot find module '@/lib/dashboard'`

- [ ] **Step 3: Implement `src/lib/dashboard.ts`**

```typescript
export interface RecentItem {
  id: string;
  sourceUrl: string;
  category: string;
  status: string;
  createdAt: string;
}

export interface DashboardStats {
  total: number;
  /** Counts of items with status "done", keyed by category. */
  byCategory: Record<string, number>;
  failedCount: number;
  processingCount: number;
  /** First 5 items from the input (caller should pass sorted desc by time). */
  recentItems: RecentItem[];
}

export function computeStats(
  items: Array<{
    _id: string;
    sourceUrl: string;
    category: string;
    status: string;
    _creationTime: number;
  }>
): DashboardStats {
  const byCategory: Record<string, number> = {};
  let failedCount = 0;
  let processingCount = 0;

  for (const item of items) {
    if (item.status === "done") {
      byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
    }
    if (item.status === "failed") failedCount++;
    if (item.status === "processing" || item.status === "pending") processingCount++;
  }

  return {
    total: items.length,
    byCategory,
    failedCount,
    processingCount,
    recentItems: items.slice(0, 5).map((i) => ({
      id: i._id,
      sourceUrl: i.sourceUrl,
      category: i.category,
      status: i.status,
      createdAt: new Date(i._creationTime).toISOString(),
    })),
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/unit/dashboard-stats.test.ts
```

Expected output: `Tests: 8 passed, 8 total`

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard.ts tests/unit/dashboard-stats.test.ts
git commit -m "feat: add computeStats helper with tests"
```

---

### Task 2: Update `SavedItemResponse` type + expose `userCorrection` in Convex

**Files:**
- Modify: `src/lib/api/types.ts`
- Modify: `convex/items.ts`

- [ ] **Step 1: Add `user_correction` to `SavedItemResponse` in `src/lib/api/types.ts`**

Find the `SavedItemResponse` interface and add `user_correction` after `action_taken`:

```typescript
/** A single saved item as returned by the API. */
export interface SavedItemResponse {
  id: string;
  source_url: string;
  platform: PlatformType;
  category: CategoryType;
  extracted_data: Record<string, unknown> | null;
  action_taken: string | null;
  user_correction: string | null;   // ← add this line
  status: ItemStatus;
  thumbnail_url: string | null;
  created_at: string;
  /** Set to the updated_at timestamp once the item reaches `done` status. */
  processed_at: string | null;
}
```

- [ ] **Step 2: Expose `userCorrection` in `toResponse` in `convex/items.ts`**

The `toResponse` function currently starts at line 38. Update the input type and return value:

Replace the function signature's input type — add `userCorrection?: string` to the parameter object:

```typescript
function toResponse(item: {
  _id: Id<"savedItems">;
  _creationTime: number;
  userId: Id<"users">;
  sourceUrl: string;
  platform: PlatformType;
  category: CategoryType;
  rawContent?: unknown;
  extractedData?: unknown;
  actionTaken?: string;
  userCorrection?: string;   // ← add this line
  status: ItemStatus;
}) {
  const extractedData =
    (item.extractedData as Record<string, unknown> | null) ?? null;
  return {
    id: item._id as string,
    source_url: item.sourceUrl,
    platform: item.platform,
    category: item.category,
    extracted_data: extractedData,
    action_taken: item.actionTaken ?? null,
    user_correction: item.userCorrection ?? null,   // ← add this line
    status: item.status,
    thumbnail_url: extractThumbnailUrl(extractedData),
    created_at: new Date(item._creationTime).toISOString(),
    processed_at:
      item.status === "done"
        ? new Date(item._creationTime).toISOString()
        : null,
  };
}
```

- [ ] **Step 3: Add `saveCorrection` mutation to `convex/items.ts`**

Add this after the `updateCategory` mutation (around line 141):

```typescript
/** Saves a user correction note and optionally re-categorises the item. */
export const saveCorrection = mutation({
  args: {
    id: v.id("savedItems"),
    note: v.string(),
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
  },
  handler: async (ctx, { id, note, correctedCategory }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const item = await ctx.db.get(id);
    if (!item || item.userId !== userId) throw new Error("Item not found");

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
```

- [ ] **Step 4: Add `retryItem` mutation to `convex/items.ts`**

Add this directly after `saveCorrection`:

```typescript
/** Resets a failed item to pending and re-schedules processing. */
export const retryItem = mutation({
  args: { id: v.id("savedItems") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const item = await ctx.db.get(id);
    if (!item || item.userId !== userId) throw new Error("Item not found");
    if (item.status !== "failed") throw new Error("Only failed items can be retried");

    await ctx.db.patch(id, { status: "pending" });
    await ctx.scheduler.runAfter(0, internal.processUrl.processItem, {
      savedItemId: id,
      url: item.sourceUrl,
    });
    return true;
  },
});
```

- [ ] **Step 5: Add `stats` query to `convex/items.ts`**

Add this after the `list` query (around line 87):

```typescript
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
      .take(200);

    const byCategory: Record<string, number> = {};
    let failedCount = 0;
    let processingCount = 0;

    for (const item of items) {
      if (item.status === "done") {
        byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
      }
      if (item.status === "failed") failedCount++;
      if (item.status === "processing" || item.status === "pending") processingCount++;
    }

    const recent = items.slice(0, 5).map((i) => ({
      id: i._id as string,
      sourceUrl: i.sourceUrl,
      category: i.category,
      status: i.status,
      createdAt: new Date(i._creationTime).toISOString(),
    }));

    return {
      total: items.length,
      byCategory,
      failedCount,
      processingCount,
      recentItems: recent,
    };
  },
});
```

- [ ] **Step 6: Run existing tests to make sure nothing is broken**

```bash
npm test
```

Expected: all existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add convex/items.ts src/lib/api/types.ts
git commit -m "feat: add saveCorrection, retryItem mutations and stats query"
```

---

### Task 3: Correction modal in ItemCard

**Files:**
- Modify: `src/components/feed/ItemCard.tsx`

The correction modal lets users report what's wrong and optionally fix the category. It calls `api.items.saveCorrection`.

- [ ] **Step 1: Add the `CorrectionModal` component to `ItemCard.tsx`**

Add this component after `GuideModal` (around line 551) and before the `ItemCard` component:

```tsx
// ─── Correction modal ─────────────────────────────────────────────────────────

function CorrectionModal({
  item,
  onClose,
}: {
  item: SavedItemResponse;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>(
    item.category
  );
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const saveCorrection = useMutation(api.items.saveCorrection);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setStatus("saving");
    try {
      await saveCorrection({
        id: item.id as Id<"savedItems">,
        note: note.trim(),
        correctedCategory:
          selectedCategory !== item.category ? selectedCategory : undefined,
      });
      setStatus("done");
      setTimeout(onClose, 1200);
    } catch {
      setStatus("idle");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 pt-16 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-[#141418] border border-[#2a2a2a] rounded-xl shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-[#1f1f1f]">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#ef4444] mb-1">
              Report correction
            </p>
            <h2 className="text-sm font-semibold text-[#e8e8e8]">
              What&apos;s wrong with this?
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#555] hover:text-[#999] text-lg leading-none mt-0.5 ml-4 flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {status === "done" ? (
          <div className="p-5 text-center">
            <p className="text-[#22c55e] text-sm font-medium">
              ✓ Thanks! We&apos;ll learn from this.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Category correction */}
            <div>
              <label className="block text-[11px] font-medium text-[#555] uppercase tracking-wider mb-1.5">
                Correct category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) =>
                  setSelectedCategory(e.target.value as CategoryType)
                }
                className="w-full bg-[#1a1a1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#e8e8e8] outline-none focus:border-[#3a3a4a]"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-[#1a1a1a]">
                    {CATEGORY_META[cat].label}
                    {cat === item.category ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Note */}
            <div>
              <label className="block text-[11px] font-medium text-[#555] uppercase tracking-wider mb-1.5">
                What&apos;s wrong? <span className="text-[#ef4444]">*</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. This is a recipe, not a fitness video. Ingredients are listed in the caption."
                rows={3}
                maxLength={400}
                className="w-full bg-[#1a1a1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#e8e8e8] placeholder-[#3a3a3a] outline-none focus:border-[#3a3a4a] resize-none"
              />
              <p className="text-[10px] text-[#444] text-right mt-0.5">
                {note.length}/400
              </p>
            </div>

            <button
              type="submit"
              disabled={!note.trim() || status === "saving"}
              className="w-full py-2 rounded-lg text-sm font-medium bg-[#ef444415] text-[#ef4444] border border-[#ef444430] hover:bg-[#ef444425] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === "saving" ? "Saving…" : "Submit correction"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add "That's wrong" button and wire the modal in `ItemCard`**

In `ItemCard`, add `correctionItem` state alongside `guideItem`:

```tsx
export function ItemCard({ item }: ItemCardProps) {
  const [guideItem, setGuideItem] = useState<SavedItemResponse | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);   // ← add
  const [overriding, setOverriding] = useState(false);
  const updateCategory = useMutation(api.items.updateCategory);
  // ... rest unchanged
```

In the footer section (inside `{item.status === "done" && ...}`), add a "That's wrong" button next to the action button:

```tsx
{/* Footer */}
{item.status === "done" && (
  <div className="px-4 py-3 border-t border-[#1c1c1c] flex items-center justify-between gap-3">
    <div className="flex items-center gap-2">
      <ActionButton item={item} category={item.category} onGuideOpen={setGuideItem} />
      <button
        onClick={() => setShowCorrection(true)}
        className="text-[11px] text-[#444] hover:text-[#ef4444] transition-colors px-1"
        title="Report a correction"
      >
        ✗
      </button>
    </div>

    {/* Category override */}
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-[#444]">↺</span>
      <select
        value={item.category}
        onChange={handleCategoryChange}
        disabled={overriding}
        className="text-[11px] text-[#555] bg-transparent border-none outline-none cursor-pointer hover:text-[#888] transition-colors appearance-none"
        aria-label="Override category"
      >
        {CATEGORIES.map((cat) => (
          <option key={cat} value={cat} className="bg-[#1a1a1a] text-[#ccc]">
            {CATEGORY_META[cat].label}
          </option>
        ))}
      </select>
    </div>
  </div>
)}
```

At the bottom of the `ItemCard` return, add the correction modal alongside the guide modal:

```tsx
      {/* Guide modal */}
      {guideItem && (
        <GuideModal item={guideItem} onClose={() => setGuideItem(null)} />
      )}

      {/* Correction modal */}
      {showCorrection && (
        <CorrectionModal item={item} onClose={() => setShowCorrection(false)} />
      )}
    </>
  );
}
```

- [ ] **Step 3: Verify the app compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual verification checklist**

1. Open a completed item card
2. Click the `✗` button — correction modal opens
3. Change the category in the dropdown
4. Type a note in the textarea
5. Click "Submit correction" — toast shows "Thanks! We'll learn from this."
6. Modal closes after ~1.2 seconds
7. Check the Convex dashboard: the item's `userCorrection` field is set to a JSON string like `{"note":"...","correctedCategory":"recipe"}`
8. If category was changed, the card updates to the new category badge

- [ ] **Step 5: Commit**

```bash
git add src/components/feed/ItemCard.tsx
git commit -m "feat: add correction modal to ItemCard"
```

---

### Task 4: Retry button for failed items

**Files:**
- Modify: `src/components/feed/ItemCard.tsx`

- [ ] **Step 1: Add `retryItem` mutation call and a Retry button in `FailedBody`**

In `ItemCard.tsx`, the `FailedBody` component currently just shows an error message. Replace it with a version that accepts a retry callback:

```tsx
function FailedBody({
  url,
  onRetry,
}: {
  url: string;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-[#ef4444]">Could not extract content</p>
      <p className="text-[11px] text-[#444] font-mono truncate">{url}</p>
      <button
        onClick={onRetry}
        className="text-xs px-3 py-1.5 rounded bg-[#ef444415] text-[#ef4444] border border-[#ef444430] font-medium hover:bg-[#ef444425] transition-colors"
      >
        Retry
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Wire the retry mutation in `ItemCard`**

In `ItemCard`, add the `retryItem` mutation:

```tsx
export function ItemCard({ item }: ItemCardProps) {
  const [guideItem, setGuideItem] = useState<SavedItemResponse | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [retrying, setRetrying] = useState(false);            // ← add
  const updateCategory = useMutation(api.items.updateCategory);
  const retryItem = useMutation(api.items.retryItem);          // ← add
```

Add the `handleRetry` handler:

```tsx
  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryItem({ id: item.id as Id<"savedItems"> });
    } finally {
      setRetrying(false);
    }
  };
```

Update the body render to pass `onRetry` to `FailedBody`:

```tsx
{item.status === "failed" && (
  <FailedBody url={item.source_url} onRetry={handleRetry} />
)}
```

- [ ] **Step 3: Verify the app compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual verification checklist**

1. Trigger a failed item (e.g., submit an unsupported URL or simulate failure)
2. The card shows "Could not extract content" + a "Retry" button
3. Click "Retry" — item status returns to "pending", then "processing", then either "done" or "failed" again
4. While retrying, the Retry button should not be clickable a second time (handled via Convex's reactive status — the card will immediately re-render to `PendingBody`)

- [ ] **Step 5: Commit**

```bash
git add src/components/feed/ItemCard.tsx
git commit -m "feat: add retry button to failed item cards"
```

---

### Task 5: Dashboard page

**Files:**
- Create: `src/components/dashboard/DashboardView.tsx`
- Create: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Create `src/components/dashboard/DashboardView.tsx`**

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CATEGORY_META } from "@/components/feed/ItemCard";
import type { CategoryType } from "@/lib/api/types";
import Link from "next/link";

export function DashboardView() {
  const stats = useQuery(api.items.stats);

  if (stats === undefined) {
    // Loading
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-[#141418] rounded-lg border border-[#1e1e1e]" />
        ))}
      </div>
    );
  }

  if (stats === null) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-[#555] text-sm">
        Not signed in.
      </div>
    );
  }

  const categories: CategoryType[] = [
    "food", "recipe", "fitness", "how-to", "video-analysis", "other",
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total saved", value: stats.total },
          { label: "Processed",   value: stats.total - stats.failedCount - stats.processingCount },
          { label: "Processing",  value: stats.processingCount },
          { label: "Failed",      value: stats.failedCount,    warn: stats.failedCount > 0 },
        ].map(({ label, value, warn }) => (
          <div
            key={label}
            className="bg-[#141418] border border-[#1e1e1e] rounded-lg p-4 text-center"
          >
            <p className={`text-2xl font-bold font-mono ${warn ? "text-[#ef4444]" : "text-[#e8e8e8]"}`}>
              {value}
            </p>
            <p className="text-[11px] text-[#555] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* By category */}
      <div>
        <h2 className="text-xs font-medium uppercase tracking-wider text-[#555] mb-3">
          By category
        </h2>
        <div className="space-y-2">
          {categories.map((cat) => {
            const count = stats.byCategory[cat] ?? 0;
            const meta = CATEGORY_META[cat];
            const max = Math.max(...Object.values(stats.byCategory), 1);
            return (
              <div key={cat} className="flex items-center gap-3">
                <span className={`text-xs w-20 flex-shrink-0 ${meta.text}`}>
                  {meta.label}
                </span>
                <div className="flex-1 h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(count / max) * 100}%`,
                      backgroundColor: meta.color,
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-[#666] w-6 text-right flex-shrink-0">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent saves */}
      {stats.recentItems.length > 0 && (
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wider text-[#555] mb-3">
            Recent saves
          </h2>
          <div className="space-y-1.5">
            {stats.recentItems.map((item) => {
              const meta = CATEGORY_META[item.category as CategoryType] ?? CATEGORY_META.other;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 bg-[#141418] border border-[#1e1e1e] rounded-lg px-4 py-2.5"
                >
                  <span className={`text-[10px] font-medium ${meta.text} w-16 flex-shrink-0`}>
                    {meta.label}
                  </span>
                  <span className="text-xs text-[#666] font-mono truncate flex-1">
                    {item.sourceUrl}
                  </span>
                  <span
                    className={`text-[10px] flex-shrink-0 ${
                      item.status === "done"
                        ? "text-[#22c55e]"
                        : item.status === "failed"
                        ? "text-[#ef4444]"
                        : "text-[#f59e0b]"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="pt-2">
        <Link
          href="/"
          className="text-xs text-[#555] hover:text-[#888] transition-colors"
        >
          ← Back to feed
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/dashboard/page.tsx`**

```tsx
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { redirect } from "next/navigation";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  const isAuth = await isAuthenticatedNextjs();
  if (!isAuth) redirect("/login");

  return (
    <ConvexClientProvider>
      <div className="min-h-screen bg-[#0d0d0f] text-[#e8e8e8]">
        <header className="sticky top-0 z-30 border-b border-[#1a1a1a] bg-[#0d0d0f]/95 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <a href="/" className="flex-shrink-0 flex items-center gap-2 group">
              <div className="w-6 h-6 rounded grid grid-cols-2 gap-0.5 p-1 bg-[#1a1a1e] border border-[#2a2a2a] group-hover:border-[#3a3a3a] transition-colors">
                <div className="bg-[#f97316] rounded-[1px]" />
                <div className="bg-[#22c55e] rounded-[1px]" />
                <div className="bg-[#3b82f6] rounded-[1px]" />
                <div className="bg-[#a855f7] rounded-[1px]" />
              </div>
              <span className="font-bold text-sm tracking-tight text-[#e8e8e8]">
                file<span className="text-[#555]">away</span>
              </span>
            </a>
            <span className="text-[#333] text-sm">/</span>
            <span className="text-sm text-[#888]">Stats</span>
          </div>
        </header>
        <DashboardView />
      </div>
    </ConvexClientProvider>
  );
}
```

- [ ] **Step 3: Verify the app compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual verification checklist (Suite 3.2)**

1. Navigate to `/dashboard`
2. Stats panel loads: total count, processed count, processing count, failed count (all non-negative)
3. Bar chart shows breakdown by category — widths are proportional
4. Recent saves list shows up to 5 most recent items with URL, category, and status
5. "← Back to feed" link returns to the feed

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/DashboardView.tsx src/app/dashboard/page.tsx
git commit -m "feat: add dashboard page with stats and recent saves"
```

---

### Task 6: Share page + `/add?url=` bookmarklet target

**Files:**
- Create: `src/app/share/page.tsx`
- Create: `src/app/add/page.tsx`

The bookmarklet opens `<app-origin>/add?url=<current-page-url>`. The `/add` page reads `?url=` and auto-submits it via the Convex `save` mutation, then redirects to the feed.

- [ ] **Step 1: Create `src/app/add/page.tsx`**

```tsx
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { redirect } from "next/navigation";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { AddPageContent } from "@/components/AddPageContent";

export default async function AddPage() {
  const isAuth = await isAuthenticatedNextjs();
  if (!isAuth) redirect("/login");

  return (
    <ConvexClientProvider>
      <AddPageContent />
    </ConvexClientProvider>
  );
}
```

- [ ] **Step 2: Create `src/components/AddPageContent.tsx`**

```tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function AddPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlParam = searchParams.get("url") ?? "";
  const [url, setUrl] = useState(urlParam);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");
  const saveItem = useMutation(api.items.save);

  const handleSave = async (targetUrl: string) => {
    if (!targetUrl.trim()) return;
    setStatus("saving");
    setErrorMsg("");
    try {
      await saveItem({ url: targetUrl.trim() });
      setStatus("done");
      setTimeout(() => router.push("/"), 1500);
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to save");
    }
  };

  // Auto-submit if URL was passed via query param
  useEffect(() => {
    if (urlParam && status === "idle") {
      handleSave(urlParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-[#e8e8e8] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <div className="w-10 h-10 rounded grid grid-cols-2 gap-0.5 p-2 bg-[#1a1a1e] border border-[#2a2a2a] mx-auto mb-3">
            <div className="bg-[#f97316] rounded-[1px]" />
            <div className="bg-[#22c55e] rounded-[1px]" />
            <div className="bg-[#3b82f6] rounded-[1px]" />
            <div className="bg-[#a855f7] rounded-[1px]" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">
            file<span className="text-[#555]">away</span>
          </h1>
        </div>

        {status === "saving" && (
          <div className="text-center py-6 space-y-2">
            <svg
              className="h-6 w-6 animate-spin text-[#6366f1] mx-auto"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-[#888]">Saving link…</p>
          </div>
        )}

        {status === "done" && (
          <div className="text-center py-6 space-y-2">
            <p className="text-[#22c55e] text-2xl">✓</p>
            <p className="text-sm text-[#888]">Saved! Returning to feed…</p>
          </div>
        )}

        {(status === "idle" || status === "error") && (
          <div className="bg-[#141418] border border-[#1e1e1e] rounded-xl p-5 space-y-4">
            <p className="text-sm text-[#888]">Save a link to fileaway</p>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="w-full bg-[#1a1a1e] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-sm text-[#e8e8e8] placeholder-[#3a3a3a] outline-none focus:border-[#3a3a4a] font-mono"
            />
            {status === "error" && (
              <p className="text-xs text-[#ef4444]">{errorMsg}</p>
            )}
            <button
              onClick={() => handleSave(url)}
              disabled={!url.trim()}
              className="w-full py-2.5 rounded-lg text-sm font-medium bg-[#e8e8e8] text-[#0d0d0f] hover:bg-white transition-all disabled:opacity-40"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/share/page.tsx`**

```tsx
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { redirect } from "next/navigation";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { SharePageContent } from "@/components/SharePageContent";

export default async function SharePage() {
  const isAuth = await isAuthenticatedNextjs();
  if (!isAuth) redirect("/login");

  return (
    <ConvexClientProvider>
      <SharePageContent />
    </ConvexClientProvider>
  );
}
```

- [ ] **Step 4: Create `src/components/SharePageContent.tsx`**

The bookmarklet code is built client-side from `window.location.origin` so it works in every environment (dev, staging, prod).

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function SharePageContent() {
  const [bookmarkletHref, setBookmarkletHref] = useState("#");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const origin = window.location.origin;
    // Minified bookmarklet: open /add?url=<current-page> in a new tab
    const code = `javascript:(function(){window.open('${origin}/add?url='+encodeURIComponent(location.href),'_blank')})()`;
    setBookmarkletHref(code);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(bookmarkletHref).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-[#e8e8e8]">
      <header className="sticky top-0 z-30 border-b border-[#1a1a1a] bg-[#0d0d0f]/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="flex-shrink-0 flex items-center gap-2 group">
            <div className="w-6 h-6 rounded grid grid-cols-2 gap-0.5 p-1 bg-[#1a1a1e] border border-[#2a2a2a] group-hover:border-[#3a3a3a] transition-colors">
              <div className="bg-[#f97316] rounded-[1px]" />
              <div className="bg-[#22c55e] rounded-[1px]" />
              <div className="bg-[#3b82f6] rounded-[1px]" />
              <div className="bg-[#a855f7] rounded-[1px]" />
            </div>
            <span className="font-bold text-sm tracking-tight text-[#e8e8e8]">
              file<span className="text-[#555]">away</span>
            </span>
          </Link>
          <span className="text-[#333] text-sm">/</span>
          <span className="text-sm text-[#888]">Share extension</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-10">
        {/* Bookmarklet */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[#e8e8e8]">
            Browser bookmarklet
          </h2>
          <p className="text-sm text-[#666]">
            Drag the button below to your bookmarks bar. Click it on any page
            to save the current URL to fileaway.
          </p>

          <div className="flex items-center gap-4">
            <a
              href={bookmarkletHref}
              draggable
              onClick={(e) => e.preventDefault()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1a1a1e] border border-[#2a2a2a] text-sm font-medium text-[#e8e8e8] cursor-grab hover:border-[#3a3a3a] transition-colors select-none"
            >
              <span>📎</span>
              Save to fileaway
            </a>
            <span className="text-xs text-[#444]">← drag this to your bookmarks bar</span>
          </div>

          <div className="bg-[#141418] border border-[#1e1e1e] rounded-lg p-4 space-y-2">
            <p className="text-[11px] text-[#555] font-medium uppercase tracking-wider">
              Or copy the bookmarklet code manually
            </p>
            <code className="block text-[11px] text-[#666] font-mono break-all">
              {bookmarkletHref}
            </code>
            <button
              onClick={handleCopy}
              className="text-xs text-[#555] hover:text-[#888] transition-colors"
            >
              {copied ? "✓ Copied!" : "Copy code"}
            </button>
          </div>
        </section>

        {/* Mobile instructions */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[#e8e8e8]">
            Mobile sharing
          </h2>
          <p className="text-sm text-[#666]">
            On iPhone or Android, you can share any link directly to fileaway:
          </p>
          <ol className="space-y-2 text-sm text-[#777]">
            <li className="flex gap-3">
              <span className="text-[#555] flex-shrink-0">1.</span>
              Open the link you want to save in Safari or Chrome.
            </li>
            <li className="flex gap-3">
              <span className="text-[#555] flex-shrink-0">2.</span>
              Tap the Share button (iOS) or menu (Android).
            </li>
            <li className="flex gap-3">
              <span className="text-[#555] flex-shrink-0">3.</span>
              Select <strong className="text-[#aaa]">Copy Link</strong>, then
              open fileaway and paste it in the URL bar.
            </li>
          </ol>
        </section>

        <div>
          <Link href="/" className="text-xs text-[#555] hover:text-[#888] transition-colors">
            ← Back to feed
          </Link>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Verify the app compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Manual verification checklist**

1. Navigate to `/share` — page loads with bookmarklet drag button and copy option
2. Drag the button to the bookmark bar
3. Navigate to a TikTok or Instagram URL in another tab
4. Click the bookmarklet — a new tab opens at `/add?url=<that-url>`
5. `/add` page auto-submits after ~500ms; shows spinner, then "Saved! Returning to feed…"
6. After 1.5s, redirects to the feed; new item appears in the feed with "pending" status

- [ ] **Step 7: Commit**

```bash
git add src/app/add/page.tsx src/app/share/page.tsx src/components/AddPageContent.tsx src/components/SharePageContent.tsx
git commit -m "feat: add /add and /share pages for bookmarklet workflow"
```

---

### Task 7: Mobile layout polish

**Files:**
- Modify: `src/components/feed/FeedApp.tsx`

**Goals (from test suite 4.2):**
- No horizontal scroll at 375px
- Cards stack vertically (already true — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`)
- Buttons are touch-sized (≥ 44px height)
- Header fits on small screens

- [ ] **Step 1: Fix the sticky header for mobile in `FeedApp.tsx`**

The current header `<div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">` puts logo + URL input + sign out on one line. On mobile (375px) the URL input is squeezed.

Replace the header inner content with a two-row layout on mobile:

```tsx
<header className="sticky top-0 z-30 border-b border-[#1a1a1a] bg-[#0d0d0f]/95 backdrop-blur-sm">
  <div className="max-w-5xl mx-auto px-4 py-3">
    {/* Top row: logo + nav + sign out */}
    <div className="flex items-center gap-3">
      {/* Logo */}
      <a href="/" className="flex-shrink-0 flex items-center gap-2 group">
        <div className="w-6 h-6 rounded grid grid-cols-2 gap-0.5 p-1 bg-[#1a1a1e] border border-[#2a2a2a] group-hover:border-[#3a3a3a] transition-colors">
          <div className="bg-[#f97316] rounded-[1px]" />
          <div className="bg-[#22c55e] rounded-[1px]" />
          <div className="bg-[#3b82f6] rounded-[1px]" />
          <div className="bg-[#a855f7] rounded-[1px]" />
        </div>
        <span className="font-bold text-sm tracking-tight text-[#e8e8e8]">
          file<span className="text-[#555]">away</span>
        </span>
      </a>

      {/* Desktop URL input — hidden on mobile */}
      <div className="hidden sm:block flex-1 relative">
        <UrlInput />
      </div>

      {/* Nav + sign out — pushed to right */}
      <div className="ml-auto flex items-center gap-1">
        <a
          href="/dashboard"
          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs text-[#555] hover:text-[#888] hover:bg-[#141418] border border-transparent transition-all"
        >
          Stats
        </a>
        <a
          href="/share"
          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs text-[#555] hover:text-[#888] hover:bg-[#141418] border border-transparent transition-all"
        >
          Share
        </a>
        <SignOutButton />
      </div>
    </div>

    {/* Mobile URL input — shown below top row on mobile only */}
    <div className="sm:hidden mt-2">
      <UrlInput />
    </div>
  </div>
</header>
```

- [ ] **Step 2: Fix the filters row for mobile**

The current filters row `<div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-3">` can overflow on mobile because the search + divider + tabs + count don't wrap.

Replace with a wrapping layout:

```tsx
{/* Filters row */}
<div className="sticky top-[57px] z-20 bg-[#0d0d0f]/95 backdrop-blur-sm border-b border-[#161616]">
  <div className="max-w-5xl mx-auto px-4 py-2 flex flex-wrap items-center gap-2">
    {/* Search */}
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444] text-xs">⌕</span>
      <input
        type="search"
        value={searchInput}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search…"
        className="bg-[#141418] border border-[#222] rounded-lg pl-7 pr-3 py-1.5 text-xs text-[#ccc] placeholder-[#333] outline-none focus:border-[#2a2a2a] w-36 transition-all focus:w-48"
      />
    </div>

    {/* Category tabs — scrollable on mobile */}
    <div className="flex-1 min-w-0">
      <CategoryTabs
        active={activeCategory}
        counts={counts}
        onChange={(v) => updateParam({ category: v === "all" ? null : v })}
      />
    </div>

    {/* Item count */}
    {!loading && (
      <span className="flex-shrink-0 text-[11px] text-[#444] font-mono">
        {filteredItems.length}
      </span>
    )}
  </div>
</div>
```

Note: removed the vertical divider `<div className="w-px h-4 bg-[#222]" />` which was a visual-only element that causes layout issues when rows wrap.

- [ ] **Step 3: Ensure touch targets are adequate in `ItemCard.tsx`**

Action buttons use `py-1.5` (~34px total height on mobile). Add `min-h-[44px]` on small screens for the action buttons and footer button wrappers. Update `ActionButton` to add min-height:

For all button class strings in `ActionButton`, append `sm:min-h-0 min-h-[44px]`:

Example — the recipe button:
```tsx
<button
  onClick={() => fire(() => copyText(text), "Copied!")}
  className="text-xs px-3 py-1.5 rounded bg-[#22c55e15] text-[#22c55e] border border-[#22c55e30] font-medium hover:bg-[#22c55e25] transition-colors min-h-[44px] sm:min-h-0"
>
  Copy ingredients
</button>
```

Apply `min-h-[44px] sm:min-h-0` to ALL button elements in `ActionButton` (food, recipe, fitness, how-to, video-analysis, other) and to the `FailedBody` retry button and the `✗` correction button.

- [ ] **Step 4: Verify the app compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual verification checklist (Suite 4.2)**

Open Chrome DevTools → Device toolbar → iPhone SE (375×667):

1. ✅ Header top row shows logo, "Stats", "Share", "Sign out" — no overflow
2. ✅ URL input renders full-width below the top row on mobile
3. ✅ Filters row wraps cleanly — no horizontal scrollbar
4. ✅ Feed cards stack in a single column
5. ✅ Action buttons are at least 44px tall
6. ✅ No element causes horizontal overflow (check `body` overflow in DevTools)

Switch to iPad Air (820px) — URL input should be on the same row as the logo.

- [ ] **Step 6: Commit**

```bash
git add src/components/feed/FeedApp.tsx src/components/feed/ItemCard.tsx
git commit -m "fix: mobile-responsive header, wrapping filter row, 44px touch targets"
```

---

### Task 8: Final test run + docs update

**Files:**
- Modify: `docs/phases.md`

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all tests pass. The new test file `tests/unit/dashboard-stats.test.ts` adds 8 tests. No tests should regress.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Fix any lint errors before continuing.

- [ ] **Step 3: Run a production build to catch any type errors or missing imports**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Update `docs/phases.md` — mark Phase 4 as done**

Find the Phase 4 table row and update:

```markdown
| 4     | Polish & Hardening                      | ✅ Done   | TBD                                          |
```

And update the Phase 4 section body:

```markdown
## Phase 4 — Polish & Hardening ✅

**Scope:** User corrections flow, dashboard stats, retry for failed items, mobile-responsive layout, bookmarklet / share extension.

**Completed:**
- `saveCorrection` Convex mutation — stores user correction note + optional category fix
- `retryItem` Convex mutation — resets failed items to pending and re-schedules processing
- `stats` Convex query — returns per-category counts, failed/processing totals, recent saves
- `CorrectionModal` in `ItemCard` — "✗" button opens modal; submission saves `userCorrection`
- Retry button in `FailedBody` on failed cards
- `/dashboard` page with summary stats + bar chart + recent saves list
- `/add?url=` page — bookmarklet target, auto-submits the passed URL
- `/share` page — bookmarklet drag-to-install + mobile sharing instructions
- Mobile layout: two-row header, wrapping filter row, ≥ 44px touch targets
```

- [ ] **Step 5: Commit**

```bash
git add docs/phases.md
git commit -m "docs: mark Phase 4 complete"
```

---

## Acceptance Criteria (from `docs/test-plan-mvp.md`)

| Suite | Criteria | How to verify |
|-------|----------|---------------|
| 3.1.1 | "That's wrong" button visible on done cards | Visual check on feed |
| 3.1.2 | Correction modal saves note + optional category | Check Convex dashboard for `userCorrection` field |
| 3.1.3 | Category correction updates card badge | Submit correction with different category; card re-renders |
| 3.2.1 | Dashboard shows counts by category + recent saves | Visit `/dashboard` |
| 4.2.1 | iPhone 375px: no overflow, cards stack, buttons ≥ 44px | Chrome DevTools device toolbar |
| 4.2.2 | iPad 768px: layout intact, no breaks | Chrome DevTools device toolbar |
| 4.3.1 | Failed card shows Retry button | Trigger a failure, verify button appears |
| 4.3.2 | Retry re-queues item for processing | Click Retry, watch card transition to pending → processing |
| 4.4.1 | Feed loads in < 3s for 50 items | Lighthouse / Chrome Network tab |
| 4.4.2 | Action button responds in < 500ms | Click action button, observe immediate feedback |

---

## Known Constraints

- **Convex functions are not unit-tested** with Jest (they require the Convex runtime). Logic that needs testing is extracted into `src/lib/` — e.g. `computeStats` in `src/lib/dashboard.ts`.
- **Mobile tests are manual** (no Playwright/Cypress in the current setup). Use Chrome DevTools device toolbar for responsive verification.
- **Bookmarklet only works over HTTPS** in production — in `localhost` dev mode, the bookmarklet will open `http://localhost:3000/add?url=...` which works fine for local testing.
