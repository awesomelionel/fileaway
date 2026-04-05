# Re-categorize Controls: Modal Only

**Date:** 2026-04-05
**Status:** Approved

## Summary

Move the category correction + re-process controls from the home feed card into the detail modal only. The home feed card loses its category dropdown. Re-processing is initiated exclusively from the modal.

---

## Current Behaviour

Every `done` item card has a `↺` category dropdown in its footer. Changing it calls `reprocessWithCategory`, which sets the item to `pending` and re-schedules the full extraction pipeline with the new category.

## New Behaviour

The category dropdown is removed from the card footer. The detail modal gains a second footer row:

```
Wrong category?  [Fitness ▾]  [Re-process ↺]
```

Clicking **Re-process** calls `reprocessWithCategory`, closes the modal immediately (`router.back()`), and the item returns to the feed showing "Queued" status.

---

## UI Design

### Modal footer — two rows

**Row 1 (unchanged):**
```
[Action button]  [✗]    |    View original ↗
```

**Row 2 (new), separated by a thin divider:**
```
Wrong category?  [dropdown — defaults to current category]  [Re-process ↺]
```

- Dropdown is pre-set to the item's current category so the control is clearly labelled and only active when the user makes a change.
- Re-process button calls `reprocessWithCategory({ id, category: selectedCategory })` then `router.back()`.
- The dropdown only shows when `item.status === "done"`.

### Home feed card footer — simplified

The `↺` dropdown and its `handleCategoryChange` handler are removed entirely. The footer shows only the action button, the correction `✗` link, and View Original.

---

## Component Changes

| File | Change |
|---|---|
| `src/components/feed/DetailModal.tsx` | Add second footer row with category dropdown + Re-process button. Accept `categories` prop. |
| `src/components/feed/FeedApp.tsx` | Pass `categories` to `DetailModal` (already passed to `ItemCard`). |
| `src/components/feed/ItemCard.tsx` | Remove category override dropdown, `handleCategoryChange`, and `reprocessWithCategory` mutation. |

### DetailModal props change

```typescript
interface DetailModalProps {
  item: SavedItemResponse;
  categories: { slug: string; label: string }[];
}
```

`FeedApp` already fetches categories for the `ItemCard` tab list — the same array is passed through to `DetailModal`.

---

## Data Flow

```
User opens modal → sees "Wrong category? [Fitness ▾]"
  → changes dropdown to "Recipe"
  → clicks "Re-process ↺"
  → reprocessWithCategory({ id, category: "recipe" }) called
  → item patched to { status: "pending", category: "recipe" } in Convex
  → modal closes (router.back())
  → feed card shows "Queued" → "Processing" → "Done" with recipe data
```

---

## Out of Scope

- No change to the `reprocessWithCategory` mutation or `processItem` backend logic.
- No re-process controls for `failed` items (handled separately by the existing Retry button).
- No animation or loading state in the modal before close — close is immediate.
