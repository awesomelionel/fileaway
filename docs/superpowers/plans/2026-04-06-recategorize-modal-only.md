# Recategorize Controls: Modal Only — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the category correction + re-process controls from the home feed card footer into the detail modal footer, removing them from the card entirely.

**Architecture:** Three focused changes: (1) `DetailModal` gains a second footer row with a category dropdown and Re-process button, (2) `FeedApp` passes `categories` to `DetailModal`, (3) `ItemCard` loses the category override dropdown, its state, and its handler. No backend changes — `reprocessWithCategory` mutation is unchanged.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Convex (`useMutation`), Tailwind CSS.

---

## File Structure

| File | Change |
|---|---|
| `src/components/feed/DetailModal.tsx` | Add `categories` prop, `selectedCategory` state, `reprocessWithCategory` mutation, second footer row |
| `src/components/feed/FeedApp.tsx` | Pass `categories` to `DetailModal` |
| `src/components/feed/ItemCard.tsx` | Remove `reprocessWithCategory` mutation, `overriding` state, `handleCategoryChange`, and the category override `<select>` block |

---

### Task 1: Add re-process footer row to `DetailModal`

**Files:**
- Modify: `src/components/feed/DetailModal.tsx`

- [ ] **Step 1: Add the required imports**

The file currently imports:
```typescript
import type { SavedItemResponse } from "@/lib/api/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
```

Replace with:
```typescript
import type { SavedItemResponse } from "@/lib/api/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
```

- [ ] **Step 2: Update `DetailModalProps` to accept `categories`**

Find:
```typescript
interface DetailModalProps {
  item: SavedItemResponse;
}
```

Replace with:
```typescript
interface DetailModalProps {
  item: SavedItemResponse;
  categories: { slug: string; label: string }[];
}
```

- [ ] **Step 3: Add state, mutation, and handler inside `DetailModal`**

Find the opening of the `DetailModal` function body:
```typescript
export function DetailModal({ item }: DetailModalProps) {
  const router = useRouter();

  const close = useCallback(() => router.back(), [router]);
```

Replace with:
```typescript
export function DetailModal({ item, categories }: DetailModalProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState(item.category);
  const [reprocessing, setReprocessing] = useState(false);
  const reprocessWithCategory = useMutation(api.items.reprocessWithCategory);

  const close = useCallback(() => router.back(), [router]);

  const handleReprocess = async () => {
    if (selectedCategory === item.category) return;
    setReprocessing(true);
    try {
      await reprocessWithCategory({ id: item.id as Id<"savedItems">, category: selectedCategory });
      close();
    } finally {
      setReprocessing(false);
    }
  };
```

- [ ] **Step 4: Replace the footer with a two-row version**

Find the current footer:
```typescript
        {/* Footer */}
        <div className="px-5 pb-5">
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-fa-subtle hover:text-fa-muted transition-colors"
          >
            View original source ↗
          </a>
        </div>
```

Replace with:
```typescript
        {/* Footer */}
        <div className="px-5 pb-5 space-y-3">
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-fa-subtle hover:text-fa-muted transition-colors"
          >
            View original source ↗
          </a>

          {item.status === "done" && categories.length > 0 && (
            <div className="flex items-center gap-2 pt-3 border-t border-fa-separator">
              <span className="text-[11px] text-fa-faint flex-shrink-0">Wrong category?</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-[11px] text-fa-subtle bg-fa-input border border-fa-line rounded px-2 py-0.5 outline-none focus:border-fa-ring flex-1 min-w-0"
              >
                {categories.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>{cat.label}</option>
                ))}
              </select>
              <button
                onClick={handleReprocess}
                disabled={selectedCategory === item.category || reprocessing}
                className="text-[11px] text-fa-subtle bg-fa-input border border-fa-line rounded px-2.5 py-0.5 hover:text-fa-primary hover:border-fa-ring transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                {reprocessing ? "Queuing…" : "Re-process ↺"}
              </button>
            </div>
          )}
        </div>
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: All 101 tests pass. (Component files are excluded from coverage — no new test files needed.)

- [ ] **Step 6: Commit**

```bash
git add src/components/feed/DetailModal.tsx
git commit -m "feat: add re-process footer row to detail modal"
```

---

### Task 2: Pass `categories` to `DetailModal` in `FeedApp`

**Files:**
- Modify: `src/components/feed/FeedApp.tsx`

- [ ] **Step 1: Update the `DetailModal` render call**

Find (near the bottom of `FeedApp`, around line 424):
```typescript
      {activeItem && <DetailModal item={activeItem} />}
```

Replace with:
```typescript
      {activeItem && (
        <DetailModal
          item={activeItem}
          categories={categories.map((c) => ({ slug: c.slug, label: c.label }))}
        />
      )}
```

Note: `categories` is already in scope — it is the result of `useQuery(api.adminCategories.listCategories)` processed at line 221–222. The same `categories.map(...)` expression used for `ItemCard` is reused here.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: All 101 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/feed/FeedApp.tsx
git commit -m "feat: pass categories to DetailModal"
```

---

### Task 3: Remove category override dropdown from `ItemCard`

**Files:**
- Modify: `src/components/feed/ItemCard.tsx`

- [ ] **Step 1: Remove the `overriding` state, mutation, and handler**

Find this block near the top of the `ItemCard` function body:
```typescript
  const [showCorrection, setShowCorrection] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const reprocessWithCategory = useMutation(api.items.reprocessWithCategory);
  const retryItem = useMutation(api.items.retryItem);
  const setArchived = useMutation(api.items.setArchived);

  const meta = getCategoryMeta(item.category);

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

Replace with:
```typescript
  const [showCorrection, setShowCorrection] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const retryItem = useMutation(api.items.retryItem);
  const setArchived = useMutation(api.items.setArchived);

  const meta = getCategoryMeta(item.category);
```

- [ ] **Step 2: Remove the category override block from the footer**

Find this block inside the footer:
```typescript
              {/* Category override */}
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <span className="text-[10px] text-fa-faint">↺</span>
                <select
                  value={item.category}
                  onChange={handleCategoryChange}
                  disabled={overriding}
                  className="text-[11px] text-fa-subtle bg-transparent border-none outline-none cursor-pointer hover:text-fa-muted transition-colors appearance-none"
                  aria-label="Override category"
                >
                  {(categories ?? []).map((cat) => (
                    <option key={cat.slug} value={cat.slug} className="bg-fa-muted-bg text-fa-secondary">
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
```

Delete that entire block. The surrounding `flex items-center justify-between gap-3` div will now have only one child (the action buttons group), which is fine.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: All 101 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/feed/ItemCard.tsx
git commit -m "feat: remove category override dropdown from feed card"
```

---

## Verification

After all 3 tasks are committed:

1. `npm test` — 101 tests pass
2. Open the app, click a done item card → modal opens
3. The modal footer shows "Wrong category? [dropdown] [Re-process ↺]"
4. The Re-process button is disabled when the dropdown is still on the original category
5. Change the dropdown to a different category → Re-process button becomes enabled
6. Click Re-process → modal closes, card shows "Queued" → "Processing" → "Done" with new category data
7. The home feed card footer no longer has a `↺` dropdown
