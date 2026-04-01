# User-Managed Categories (Settings) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authenticated users add, rename, and delete their own categories from a Settings area (not from the main feed page).

**Architecture:** Introduce a new `categories` table keyed by `userId` in Convex, plus a small categories CRUD API. Add a Settings page that calls these functions. This is intentionally *separate* from the existing fixed AI/system categories used by the processing pipeline (`food|recipe|fitness|how-to|video-analysis|other`) so we don’t break extraction and card rendering.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind, Convex, @convex-dev/auth, Jest

---

## Scope / non-goals

- In scope: categories CRUD UI in Settings; backend storage and auth checks.
- Out of scope (explicitly): password reset UI, profile fields (username), main-feed category editing UI, AI prompt changes.
- Important: this plan **does not** change the Gemini categorization labels or the `savedItems.category` union.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `convex/schema.ts` | Add `categories` table |
| `convex/categories.ts` | Categories CRUD (list/create/rename/delete) + helpers |
| `src/app/settings/page.tsx` | Settings landing page (Categories section implemented; other sections stub UI only) |
| `src/components/settings/CategoriesPanel.tsx` | Categories list + add/edit/delete UI |
| `src/lib/categories/types.ts` | Frontend types for categories responses |
| `tests/unit/categories.test.ts` | Unit tests for slugify/validation helpers (pure functions) |

---

## Data model

### Categories table shape

- `userId: Id<"users">` (owner)
- `name: string` (display name, editable)
- `slug: string` (stable-ish identifier per user, generated from name + suffix if needed)
- `createdAt: number` (optional; can use `_creationTime` instead)

Constraints enforced by code:
- Categories are user-owned; all mutations verify `userId`.
- `slug` is unique per user (enforced in create helper by checking existing slugs).

---

## API surface (Convex)

Create `convex/categories.ts`:

- `list` (query): returns `{ id, name, slug, created_at }[]` for the authed user.
- `create` (mutation): args `{ name: string }` → returns new category id.
- `rename` (mutation): args `{ id: Id<"categories">, name: string }` → returns `true`.
- `remove` (mutation): args `{ id: Id<"categories"> }` → returns `true`.

Errors:
- Not authenticated → throw `Error("Not authenticated")`
- Name empty/too long → throw `Error("Category name cannot be empty")` / `Error("Category name is too long")`
- Not found / not owned → throw `Error("Category not found")`

---

## UI (Settings)

Create `/settings` route:
- Show a simple Settings layout with sections:
  - “Categories” (implemented)
  - “Profile” (placeholder, no functionality)
  - “Security” (placeholder, no functionality)

Categories panel behaviors:
- List current categories (name + slug shown subtly for debugging; optional).
- Add category:
  - Input + button
  - Disable when empty
  - Show error text on failure
- Rename:
  - Inline edit (toggle row into editing mode)
  - Save/cancel
- Delete:
  - Delete button per row
  - Confirm dialog (native `confirm()` is OK for MVP)

---

## Tasks

### Task 1: Add `categories` table to Convex schema

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Update schema**

Add a new table:

```ts
categories: defineTable({
  userId: v.id("users"),
  name: v.string(),
  slug: v.string(),
})
  .index("by_userId", ["userId"])
  .index("by_userId_slug", ["userId", "slug"]),
```

- [ ] **Step 2: Run Convex typegen / dev**

Run:
- `npx convex dev`

Expected: no schema errors; generated types include `categories`.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add categories table"
```

---

### Task 2: Implement categories CRUD functions (Convex)

**Files:**
- Create: `convex/categories.ts`
- Create: `tests/unit/categories.test.ts`

- [ ] **Step 1: Write unit tests for slug + name normalization**

Create `tests/unit/categories.test.ts`:

```ts
import { __testables } from "../../convex/categories";

describe("categories helpers", () => {
  it("normalizes whitespace", () => {
    expect(__testables.normalizeName("  My   Category  ")).toBe("My Category");
  });

  it("slugifies ascii text", () => {
    expect(__testables.slugify("My Category")).toBe("my-category");
  });

  it("slugifies punctuation", () => {
    expect(__testables.slugify("Food & Drink!!")).toBe("food-drink");
  });

  it("falls back to 'category' when slug is empty", () => {
    expect(__testables.slugify("!!!")).toBe("category");
  });
});
```

- [ ] **Step 2: Run tests (they should fail)**

Run:
- `npm test -- tests/unit/categories.test.ts`

Expected: FAIL because `convex/categories.ts` doesn’t exist yet.

- [ ] **Step 3: Implement `convex/categories.ts` with exported helpers**

Create `convex/categories.ts`:

```ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

const MAX_NAME_LEN = 48;

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function slugify(input: string): string {
  const raw = input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return raw || "category";
}

async function assertOwnedCategory(
  ctx: { db: { get: (id: Id<"categories">) => Promise<any> } },
  userId: Id<"users">,
  id: Id<"categories">,
) {
  const cat = await ctx.db.get(id);
  if (!cat || cat.userId !== userId) throw new Error("Category not found");
  return cat;
}

async function allocateUniqueSlug(
  ctx: {
    db: {
      query: (table: "categories") => any;
    };
  },
  userId: Id<"users">,
  baseSlug: string,
): Promise<string> {
  // Try base first, then base-2, base-3, ...
  const exists = async (slug: string) => {
    const row = await ctx.db
      .query("categories")
      .withIndex("by_userId_slug", (q: any) => q.eq("userId", userId).eq("slug", slug))
      .first();
    return !!row;
  };

  if (!(await exists(baseSlug))) return baseSlug;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${baseSlug}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error("Could not allocate a unique slug");
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const rows = await ctx.db
      .query("categories")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return rows.map((c) => ({
      id: c._id as string,
      name: c.name,
      slug: c.slug,
      created_at: new Date(c._creationTime).toISOString(),
    }));
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const name = normalizeName(args.name);
    if (!name) throw new Error("Category name cannot be empty");
    if (name.length > MAX_NAME_LEN) throw new Error("Category name is too long");

    const baseSlug = slugify(name);
    const slug = await allocateUniqueSlug(ctx, userId, baseSlug);

    const id = await ctx.db.insert("categories", {
      userId,
      name,
      slug,
    });
    return id;
  },
});

export const rename = mutation({
  args: { id: v.id("categories"), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const name = normalizeName(args.name);
    if (!name) throw new Error("Category name cannot be empty");
    if (name.length > MAX_NAME_LEN) throw new Error("Category name is too long");

    await assertOwnedCategory(ctx, userId, args.id);
    await ctx.db.patch(args.id, { name });
    return true;
  },
});

export const remove = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await assertOwnedCategory(ctx, userId, args.id);
    await ctx.db.delete(args.id);
    return true;
  },
});

export const __testables = {
  normalizeName,
  slugify,
};
```

- [ ] **Step 4: Run unit tests**

Run:
- `npm test -- tests/unit/categories.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/categories.ts tests/unit/categories.test.ts
git commit -m "feat: add categories CRUD api"
```

---

### Task 3: Add Settings route and Categories UI

**Files:**
- Create: `src/app/settings/page.tsx`
- Create: `src/components/settings/CategoriesPanel.tsx`
- Create: `src/lib/categories/types.ts`

- [ ] **Step 1: Add frontend types**

Create `src/lib/categories/types.ts`:

```ts
export interface Category {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}
```

- [ ] **Step 2: Create `CategoriesPanel` component**

Create `src/components/settings/CategoriesPanel.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function CategoriesPanel() {
  const categories = useQuery(api.categories.list) ?? [];
  const createCategory = useMutation(api.categories.create);
  const renameCategory = useMutation(api.categories.rename);
  const removeCategory = useMutation(api.categories.remove);

  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const sorted = useMemo(() => {
    return [...categories].sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  const onCreate = async () => {
    setError(null);
    const name = newName.trim();
    if (!name) return;
    try {
      setBusyId("create");
      await createCategory({ name });
      setNewName("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create category");
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (id: string, current: string) => {
    setError(null);
    setEditingId(id);
    setEditingName(current);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const onSaveEdit = async () => {
    if (!editingId) return;
    setError(null);
    const name = editingName.trim();
    if (!name) {
      setError("Category name cannot be empty");
      return;
    }
    try {
      setBusyId(editingId);
      await renameCategory({ id: editingId as Id<"categories">, name });
      cancelEdit();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to rename category");
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (id: string, name: string) => {
    setError(null);
    const ok = confirm(`Delete category "${name}"?`);
    if (!ok) return;
    try {
      setBusyId(id);
      await removeCategory({ id: id as Id<"categories"> });
      if (editingId === id) cancelEdit();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete category");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="bg-fa-surface border border-fa-line rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-fa-primary">Categories</h2>
          <p className="text-xs text-fa-subtle mt-1">
            Create your own categories for organizing items. (Assignment to items can be added later.)
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          className="flex-1 bg-fa-input border border-fa-line rounded-lg px-3 py-2 text-sm text-fa-primary placeholder-fa-placeholder outline-none focus:border-fa-ring"
        />
        <button
          type="button"
          onClick={onCreate}
          disabled={!newName.trim() || busyId === "create"}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-fa-btn-bg text-fa-btn-fg hover:bg-fa-btn-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busyId === "create" ? "Adding…" : "Add"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-[#ef4444]">{error}</p>}

      <div className="mt-4 divide-y divide-fa-separator border border-fa-line rounded-lg overflow-hidden">
        {sorted.length === 0 ? (
          <div className="p-4 text-xs text-fa-subtle">No categories yet.</div>
        ) : (
          sorted.map((c) => (
            <div key={c.id} className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                {editingId === c.id ? (
                  <div className="flex gap-2">
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 bg-fa-input border border-fa-line rounded-lg px-3 py-2 text-sm text-fa-primary outline-none focus:border-fa-ring"
                    />
                    <button
                      type="button"
                      onClick={onSaveEdit}
                      disabled={busyId === c.id}
                      className="px-3 py-2 rounded-lg text-xs font-medium bg-[#22c55e15] text-[#22c55e] border border-[#22c55e30] disabled:opacity-40"
                    >
                      {busyId === c.id ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={busyId === c.id}
                      className="px-3 py-2 rounded-lg text-xs font-medium bg-fa-muted-bg text-fa-subtle border border-fa-line disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-fa-primary truncate">{c.name}</p>
                    <p className="text-[11px] text-fa-faint font-mono truncate mt-0.5">{c.slug}</p>
                  </>
                )}
              </div>

              {editingId !== c.id && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(c.id, c.name)}
                    disabled={busyId === c.id}
                    className="text-xs px-3 py-1.5 rounded bg-fa-muted-bg text-fa-subtle border border-fa-line hover:text-fa-muted disabled:opacity-40"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(c.id, c.name)}
                    disabled={busyId === c.id}
                    className="text-xs px-3 py-1.5 rounded bg-[#ef444415] text-[#ef4444] border border-[#ef444430] hover:bg-[#ef444425] disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create Settings page**

Create `src/app/settings/page.tsx`:

```tsx
import { CategoriesPanel } from "@/components/settings/CategoriesPanel";

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-fa-canvas text-fa-primary">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Settings</h1>
          <p className="text-sm text-fa-subtle mt-1">
            Manage your account and preferences.
          </p>
        </div>

        <CategoriesPanel />

        <section className="bg-fa-surface border border-fa-line rounded-xl p-5">
          <h2 className="text-sm font-semibold text-fa-primary">Profile</h2>
          <p className="text-xs text-fa-subtle mt-1">
            Coming soon: username, profile info.
          </p>
        </section>

        <section className="bg-fa-surface border border-fa-line rounded-xl p-5">
          <h2 className="text-sm font-semibold text-fa-primary">Security</h2>
          <p className="text-xs text-fa-subtle mt-1">
            Coming soon: reset password, sessions.
          </p>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run dev server and verify UI**

Run:
- `npm run dev`

Navigate to `/settings`.

Expected:
- Categories section loads.
- Add/edit/delete works for the signed-in user.
- No changes required to the main page.

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/page.tsx src/components/settings/CategoriesPanel.tsx src/lib/categories/types.ts
git commit -m "feat: add settings categories management"
```

---

### Task 4: Verification pass

**Files:**
- (No new files required)

- [ ] **Step 1: Run lint**

Run:
- `npm run lint`

Expected: PASS.

- [ ] **Step 2: Run tests**

Run:
- `npm test`

Expected: PASS.

- [ ] **Step 3: Smoke test (manual)**

Checklist:
- Create categories with leading/trailing whitespace (stored normalized).
- Create two categories with same name (second gets unique slug).
- Rename category to empty (blocked with error).
- Delete category and ensure it disappears from list.

---

## Follow-ups (next iteration, not in this plan)

- Assign categories to items (`savedItems.categoryId`) and update feed filtering tabs to use user-defined categories.
- Allow ordering, colors, and “archive” instead of delete.
- Add per-category counts in Settings and/or feed.

