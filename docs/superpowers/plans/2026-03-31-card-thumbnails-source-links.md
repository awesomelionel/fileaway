# Card Thumbnails & Source Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display platform thumbnail images on item cards and add clickable links to original content.

**Architecture:** Fix the data plumbing so thumbnail URLs flow from Apify scrape data to the frontend, then render a top-banner thumbnail and "View Original" link on each card. Two-pronged approach: fallback for existing items (read from `rawContent`) + persist for future items (merge into `extractedData`).

**Tech Stack:** Convex (backend mutations/queries), React 18, Next.js 14, TypeScript, Tailwind CSS, Jest

---

## File Structure

| File | Responsibility |
|------|---------------|
| `convex/items.ts` | `extractThumbnailUrl` fallback + `toResponse` wiring |
| `convex/processUrl.ts` | Merge `thumbnailUrl` into `extractedData` during pipeline |
| `src/components/feed/ItemCard.tsx` | `ThumbnailBanner` component + "View Original" footer link |
| `tests/unit/items.test.ts` | Tests for thumbnail extraction logic |

---

### Task 1: Thumbnail Extraction Fallback (Backend)

**Files:**
- Modify: `convex/items.ts:27-68`
- Create: `tests/unit/items.test.ts`

- [ ] **Step 1: Write failing tests for thumbnail extraction**

Create `tests/unit/items.test.ts`:

```typescript
/**
 * Tests for extractThumbnailUrl logic.
 * We import the exported helper from convex/items.
 */
import { extractThumbnailUrl } from "../../convex/items";

describe("extractThumbnailUrl", () => {
  it("returns null when both args are null", () => {
    expect(extractThumbnailUrl(null, null)).toBeNull();
  });

  it("returns thumbnailUrl from extractedData", () => {
    const extracted = { thumbnailUrl: "https://example.com/thumb.jpg" };
    expect(extractThumbnailUrl(extracted, null)).toBe("https://example.com/thumb.jpg");
  });

  it("returns thumbnail_url (snake_case) from extractedData", () => {
    const extracted = { thumbnail_url: "https://example.com/thumb2.jpg" };
    expect(extractThumbnailUrl(extracted, null)).toBe("https://example.com/thumb2.jpg");
  });

  it("returns displayUrl from extractedData", () => {
    const extracted = { displayUrl: "https://example.com/display.jpg" };
    expect(extractThumbnailUrl(extracted, null)).toBe("https://example.com/display.jpg");
  });

  it("falls back to rawContent.coverUrl when extractedData has no thumbnail", () => {
    const extracted = { name: "Some food" };
    const raw = { coverUrl: "https://tiktok.com/cover.jpg" };
    expect(extractThumbnailUrl(extracted, raw)).toBe("https://tiktok.com/cover.jpg");
  });

  it("falls back to rawContent.displayUrl when extractedData has no thumbnail", () => {
    const extracted = { name: "Some food" };
    const raw = { displayUrl: "https://instagram.com/display.jpg" };
    expect(extractThumbnailUrl(extracted, raw)).toBe("https://instagram.com/display.jpg");
  });

  it("prefers extractedData over rawContent", () => {
    const extracted = { thumbnailUrl: "https://extracted.com/thumb.jpg" };
    const raw = { coverUrl: "https://raw.com/cover.jpg" };
    expect(extractThumbnailUrl(extracted, raw)).toBe("https://extracted.com/thumb.jpg");
  });

  it("returns null when neither source has a thumbnail", () => {
    const extracted = { name: "No thumb" };
    const raw = { url: "https://example.com", empty: true };
    expect(extractThumbnailUrl(extracted, raw)).toBeNull();
  });

  it("ignores non-string values", () => {
    const extracted = { thumbnailUrl: 12345 };
    const raw = { coverUrl: null };
    expect(extractThumbnailUrl(extracted, raw)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/items.test.ts`
Expected: FAIL — `extractThumbnailUrl` is not exported from `convex/items`

- [ ] **Step 3: Export and update `extractThumbnailUrl` in `convex/items.ts`**

Replace the existing `extractThumbnailUrl` function (lines 27-36) with:

```typescript
export function extractThumbnailUrl(
  extractedData: Record<string, unknown> | null,
  rawContent: Record<string, unknown> | null,
): string | null {
  if (extractedData) {
    const url =
      extractedData.thumbnailUrl ??
      extractedData.thumbnail_url ??
      extractedData.displayUrl;
    if (typeof url === "string") return url;
  }

  if (rawContent) {
    const url =
      rawContent.coverUrl ??
      rawContent.displayUrl ??
      rawContent.thumbnailUrl;
    if (typeof url === "string") return url;
  }

  return null;
}
```

- [ ] **Step 4: Update `toResponse` to pass `rawContent`**

In `convex/items.ts`, update the `toResponse` function. Change lines 51-62 from:

```typescript
  const extractedData =
    (item.extractedData as Record<string, unknown> | null) ?? null;
  return {
    id: item._id as string,
    source_url: item.sourceUrl,
    platform: item.platform,
    category: item.category,
    extracted_data: extractedData,
    action_taken: item.actionTaken ?? null,
    user_correction: item.userCorrection ?? null,
    status: item.status,
    thumbnail_url: extractThumbnailUrl(extractedData),
```

to:

```typescript
  const extractedData =
    (item.extractedData as Record<string, unknown> | null) ?? null;
  const rawContent =
    (item.rawContent as Record<string, unknown> | null) ?? null;
  return {
    id: item._id as string,
    source_url: item.sourceUrl,
    platform: item.platform,
    category: item.category,
    extracted_data: extractedData,
    action_taken: item.actionTaken ?? null,
    user_correction: item.userCorrection ?? null,
    status: item.status,
    thumbnail_url: extractThumbnailUrl(extractedData, rawContent),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/unit/items.test.ts`
Expected: PASS — all 9 tests green

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: All 95 tests passing (86 existing + 9 new)

- [ ] **Step 7: Commit**

```bash
git add convex/items.ts tests/unit/items.test.ts
git commit -m "feat: add rawContent fallback to thumbnail extraction

Existing TikTok/Instagram items now surface cover images from Apify
scrape data stored in rawContent when extractedData lacks a thumbnail URL."
```

---

### Task 2: Persist Thumbnail in Processing Pipeline

**Files:**
- Modify: `convex/processUrl.ts:404-412`

- [ ] **Step 1: Write failing test for thumbnail persistence**

Add to `tests/unit/items.test.ts`:

```typescript
describe("thumbnail in extractedData (pipeline persistence)", () => {
  it("extractThumbnailUrl returns the thumbnail when present in extractedData", () => {
    const extracted = {
      name: "Best Ramen",
      address: "123 Main St",
      thumbnailUrl: "https://tiktok.com/cover-merged.jpg",
    };
    expect(extractThumbnailUrl(extracted, null)).toBe("https://tiktok.com/cover-merged.jpg");
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- tests/unit/items.test.ts`
Expected: PASS — this test validates the happy path already works; the real change is in the pipeline

- [ ] **Step 3: Merge thumbnailUrl into extractedData in processUrl.ts**

In `convex/processUrl.ts`, change lines 405-412 from:

```typescript
      await ctx.runMutation(internal.items.updateResult, {
        id: savedItemId,
        platform,
        category,
        rawContent: scrapeResult.metadata,
        extractedData: extraction.extractedData,
        actionTaken: extraction.actionTaken,
      });
```

to:

```typescript
      const extractedDataWithThumb = {
        ...extraction.extractedData,
        ...(scrapeResult.thumbnailUrl
          ? { thumbnailUrl: scrapeResult.thumbnailUrl }
          : {}),
      };

      await ctx.runMutation(internal.items.updateResult, {
        id: savedItemId,
        platform,
        category,
        rawContent: scrapeResult.metadata,
        extractedData: extractedDataWithThumb,
        actionTaken: extraction.actionTaken,
      });
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests passing

- [ ] **Step 5: Commit**

```bash
git add convex/processUrl.ts tests/unit/items.test.ts
git commit -m "feat: persist thumbnail URL in extractedData during processing

Future processed items will have thumbnailUrl merged into extractedData
from the Apify scrape result, eliminating the rawContent fallback."
```

---

### Task 3: Thumbnail Banner Component on ItemCard

**Files:**
- Modify: `src/components/feed/ItemCard.tsx:706-817`

- [ ] **Step 1: Add ThumbnailBanner component**

In `src/components/feed/ItemCard.tsx`, add the following component after the `RelativeTime` component (after line 87):

```tsx
function ThumbnailBanner({
  thumbnailUrl,
  sourceUrl,
}: {
  thumbnailUrl: string;
  sourceUrl: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full overflow-hidden"
    >
      <img
        src={thumbnailUrl}
        alt=""
        onError={() => setFailed(true)}
        className="w-full h-40 object-cover transition-opacity duration-200 hover:opacity-85"
        loading="lazy"
      />
    </a>
  );
}
```

- [ ] **Step 2: Insert ThumbnailBanner into ItemCard between header and body**

In the `ItemCard` component, add the thumbnail between the header `</div>` (line 765) and the body `<div>` (line 768). Change:

```tsx
        </div>

        {/* Body */}
        <div className="px-4 py-2 flex-1">
```

to:

```tsx
        </div>

        {/* Thumbnail */}
        {item.status === "done" && item.thumbnail_url && (
          <ThumbnailBanner
            thumbnailUrl={item.thumbnail_url}
            sourceUrl={item.source_url}
          />
        )}

        {/* Body */}
        <div className="px-4 py-2 flex-1">
```

- [ ] **Step 3: Verify it compiles**

Run: `npx next lint` or `npx tsc --noEmit`
Expected: No type errors (SavedItemResponse already has `thumbnail_url: string | null`)

- [ ] **Step 4: Commit**

```bash
git add src/components/feed/ItemCard.tsx
git commit -m "feat: add thumbnail banner to item cards

Shows a clickable cover image above card body for TikTok/Instagram items.
Image links to original content in a new tab. Gracefully hides on load error."
```

---

### Task 4: "View Original" Link in Card Footer

**Files:**
- Modify: `src/components/feed/ItemCard.tsx:785-816`

- [ ] **Step 1: Add "View Original" link to the card footer**

In the footer section of `ItemCard`, change lines 786-815 from:

```tsx
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
```

to:

```tsx
          <div className="px-4 py-3 border-t border-[#1c1c1c] flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
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

            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[#555] hover:text-[#888] transition-colors flex items-center gap-1 w-fit"
            >
              <span>↗</span>
              <span>View Original</span>
            </a>
          </div>
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests passing

- [ ] **Step 3: Verify lint**

Run: `npm run lint`
Expected: No new lint errors

- [ ] **Step 4: Commit**

```bash
git add src/components/feed/ItemCard.tsx
git commit -m "feat: add 'View Original' link to card footer

All completed cards now show a link back to the original source URL.
Appears on every card regardless of whether a thumbnail is present."
```

---

## Summary

| Task | What it does | Files |
|------|-------------|-------|
| 1 | Fix `extractThumbnailUrl` to fall back to `rawContent` for existing items | `convex/items.ts`, `tests/unit/items.test.ts` |
| 2 | Merge `thumbnailUrl` into `extractedData` during processing for future items | `convex/processUrl.ts`, `tests/unit/items.test.ts` |
| 3 | Render clickable thumbnail banner on cards | `src/components/feed/ItemCard.tsx` |
| 4 | Add "View Original" link to card footer | `src/components/feed/ItemCard.tsx` |
