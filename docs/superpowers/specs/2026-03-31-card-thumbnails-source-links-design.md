# Card Thumbnails & Source Links — Design Spec

## Goal

Display platform thumbnail images on item cards and provide clickable links back to the original content, so users can visually identify and revisit their saved items.

## Decisions

- **Thumbnail source:** Platform-native cover images already captured by Apify (TikTok `coverUrl`, Instagram `displayUrl`). No new screenshot service.
- **No-thumbnail fallback:** Cards without thumbnail URLs (YouTube, X, other) hide the thumbnail section entirely — shorter text-only cards, no placeholders.
- **Link placement:** Both — clickable thumbnail opens original URL in new tab, plus a visible "View Original" link in the card footer.
- **Error handling:** If an image fails to load (`onError`), hide the thumbnail section. Card collapses to text-only layout gracefully.
- **Approach:** Combined Approach 1+2 — fix `extractThumbnailUrl` fallback for existing items AND persist `thumbnailUrl` in pipeline for future items.

## Architecture

### Data Plumbing (Backend)

Two changes ensure `thumbnail_url` reaches the frontend:

**1. `convex/items.ts` — `extractThumbnailUrl` (Approach 1: fallback for existing items)**

Expand to accept `rawContent` as a second parameter. Current logic only checks `extractedData` for `thumbnailUrl` / `thumbnail_url` / `displayUrl`. Add fallback to `rawContent` keys:

- `rawContent.coverUrl` (TikTok Apify format)
- `rawContent.displayUrl` (Instagram Apify format)

Update `toResponse` to pass `rawContent` into `extractThumbnailUrl`. This fixes all existing items retroactively without reprocessing.

**2. `convex/processUrl.ts` — `processItem` (Approach 2: persist for future items)**

Before calling `internal.items.updateResult`, merge `scrapeResult.thumbnailUrl` into `extractedData`:

```
extractedData.thumbnailUrl = scrapeResult.thumbnailUrl
```

Future items will have `thumbnailUrl` directly in `extractedData`, so the `rawContent` fallback never fires for new items.

### Card UI (Frontend)

**`src/components/feed/ItemCard.tsx`**

**Thumbnail section** — inserted between the header badges and body, only when `item.thumbnail_url` is truthy:

- Full-width banner image, `object-cover`, fixed aspect ratio (~16:10)
- Wrapped in `<a href={item.source_url} target="_blank" rel="noopener noreferrer">`
- Hover: slight opacity dim (0.85) for click affordance
- `onError` handler: sets local state to hide the thumbnail section

**"View Original" link** — added to the card footer:

- Small text link with external arrow icon (`↗`)
- Right-aligned, alongside existing action buttons
- Opens `item.source_url` in new tab
- Appears on ALL cards regardless of thumbnail presence (including YouTube, X, other)

### Cards without thumbnails

When `item.thumbnail_url` is `null` or the image fails to load:

- Thumbnail section is not rendered (or hidden via state)
- Card renders header → body → footer as it does today
- No broken image icons, no placeholder images
- "View Original" link still appears in footer

## Files Changed

| File | Change |
|------|--------|
| `convex/items.ts` | Expand `extractThumbnailUrl` to accept + fallback to `rawContent`; update `toResponse` |
| `convex/processUrl.ts` | Merge `scrapeResult.thumbnailUrl` into `extractedData` before saving |
| `src/components/feed/ItemCard.tsx` | Add `ThumbnailBanner` component; add "View Original" link to footer |
| `tests/items.test.ts` | Tests for thumbnail extraction fallback logic |

## Out of Scope

- Open Graph fallback for non-Apify platforms (YouTube, X, other)
- Browser screenshots of original URLs
- Storing images in Convex file storage
- Schema migration / new DB fields
- Image optimization or CDN proxying
