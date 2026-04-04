# Clickable Cards + Richer Video Analysis

**Date:** 2026-04-04
**Status:** Approved

## Summary

Two connected features:
1. All feed cards become clickable and open a URL-synced detail modal showing full extracted data (untruncated).
2. For `video-analysis` items from TikTok, Instagram, or X, Gemini receives the actual video file and returns a shot-by-shot breakdown with actionable takeaways.

Cards on the home feed remain visually unchanged — the modal is the new surface for full detail.

---

## Feature 1: URL-synced Detail Modal

### Interaction

- Clicking anywhere on a card calls `router.push('?item=<id>')`, preserving current tab/search state.
- A `DetailModal` component reads `useSearchParams().get('item')` and finds the matching item from feed data already in memory — no additional network request.
- Closing the modal calls `router.back()` to remove the query param.
- The URL is shareable and back-button-aware. Deep linking to `?item=<id>` on page load opens the modal immediately once feed data is available.

### Modal Content (per category)

| Category | Modal shows |
|---|---|
| **food** | Name, address, cuisine, price range, why visit, hours/phone (all fields, untruncated). Google Maps button. |
| **recipe** | Full ingredients list (not capped), dish name, prep/cook time, servings, steps if present. Copy ingredients button. |
| **fitness** | All exercises (not capped), muscle groups, difficulty, duration. Save to routine button. |
| **how-to** | Full summary, all steps (not capped). Existing GuideModal logic migrates here. |
| **video-analysis** (TikTok/Instagram/X) | Shot-by-shot breakdown + actionable takeaways (see Feature 2). Falls back to title/summary/key_points if shots absent. |
| **video-analysis** (YouTube/other) | Title, summary, key points — untruncated. |
| **other** | Full title and summary. |

### Component Changes

- **New:** `src/components/feed/DetailModal.tsx` — single modal component with per-category content renderers.
- **Retired:** existing `GuideModal` in `ItemCard.tsx` — its how-to logic moves into `DetailModal`.
- **Modified:** `src/components/feed/FeedApp.tsx` — reads `searchParams`, passes matched item to `DetailModal`. Cards get an `onClick` handler.
- **Modified:** `src/components/feed/ItemCard.tsx` — card root element becomes clickable (button or div with onClick), cursor pointer. Action buttons (Copy, Maps, etc.) remain and stop propagation to avoid double-firing the modal.

---

## Feature 2: Gemini Video Analysis

### When It Runs

Conditions (all must be true):
- `category === "video-analysis"`
- `platform` is `tiktok`, `instagram`, or `twitter`
- `scrapeResult.videoUrl` is present

If any condition is false, falls back to the existing text-only extraction (no change to current behaviour).

### Pipeline Changes (`convex/processUrl.ts`)

After scraping and categorisation, if conditions are met:

1. **Download video** — fetch `scrapeResult.videoUrl` as a binary blob.
2. **Upload to Gemini Files API** — `fileManager.uploadFile(blob, { mimeType: 'video/mp4' })`. Retry once on transient failure.
3. **Multimodal extraction** — run Gemini 1.5 Pro with the uploaded file reference + a structured prompt requesting the schema below.
4. **Cleanup** — delete the uploaded file from Gemini Files API after extraction.
5. **Fallback** — if download, upload, or extraction fails at any point, catch the error, log a warning, and run the standard text-only extraction instead.

### Extraction Schema

```json
{
  "title": "string — short descriptive title",
  "summary": "string — 2-3 sentence overview",
  "shots": [
    {
      "timestamp": "string — e.g. '0:08'",
      "description": "string — one-line scene label e.g. 'Overhead ingredient shot'",
      "detail": "string — contextual explanation e.g. 'Chef lays out 200g pasta, garlic, olive oil, and cherry tomatoes'"
    }
  ],
  "takeaways": ["string — specific actionable item"]
}
```

The `shots` array captures the storyboard: what the camera shows, contextualised to the video type (workout move + reps, recipe step + technique, travel location + itinerary note, etc.).

### Gemini Prompt

The multimodal prompt instructs Gemini to:
- Watch the video and identify distinct shots/scenes.
- For each shot: note the approximate timestamp, label the scene, and explain what is happening in the context of the content type (food, fitness, travel, etc.).
- List 3–6 specific actionable takeaways a viewer can act on.
- Return only valid JSON matching the schema — no markdown fences, no extra fields.

### Modal Display (video-analysis, TikTok/Instagram/X)

- **Storyboard section:** vertical list of shots. Each row: timestamp badge (monospace, teal) + description headline + detail text.
- **Takeaways section:** below the storyboard, bulleted list with a checklist-style visual.
- **Graceful fallback:** if `shots` is absent or empty, display `summary` and `key_points` instead (same as YouTube/other).

### Admin Category Extraction Prompt Update

The `video-analysis` category's `extractionPrompt` in the DB is updated to include the `shots` and `takeaways` fields so that the text-only fallback path also attempts to infer them from caption/hashtags context.

---

## Data Flow

```
User saves TikTok URL
  → Apify scrapes → returns title, description, videoUrl, hashtags
  → Gemini Flash categorises → "video-analysis"
  → platform is tiktok + videoUrl present:
      → Download video → Upload to Gemini Files API
      → Gemini Pro multimodal → shots[] + takeaways[]
      → Delete uploaded file
  → updateResult: extractedData = { title, summary, shots, takeaways }

User clicks card
  → router.push('?item=<id>')
  → DetailModal opens, reads item from feed cache
  → Renders storyboard + takeaways
  → User closes → router.back()
```

---

## Out of Scope

- No changes to card visual design on the home feed.
- No shot breakdown for YouTube — Gemini Files API requires a downloadable video URL; YouTube links are not directly downloadable.
- No timestamp scrubbing or video playback in the modal.
- Twitter/X video support depends on Apify returning a valid `videoUrl` — if absent, falls back gracefully.
