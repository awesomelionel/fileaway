# Places Map — Design

**Status:** Approved during brainstorming 2026-04-24. Ready for implementation plan.

**Goal:** Show saved Food and Travel places on an interactive Google Map with clustered, clickable pins. Pins are category-scoped (Food tab OR Travel tab); clicking a pin opens the existing saved-item modal.

## Architecture summary

Additive feature. Geocoding runs server-side during the existing `processUrl` pipeline, right after extraction, and stores `{ lat, lng, formatted_address, place_id, geocoder_status, geocoded_at }` into `extractedData`. A new Convex query flattens food + travel items into a list of `MapPoint`s. A new `<PlacesMap>` client component renders Google Maps with `@googlemaps/markerclusterer`. Feed UI gains a "Map" toggle visible only when the active category is `food` or `travel`.

## Data model

Schema is unchanged (`extractedData` stays `v.any()`). We enrich in place.

### Food items
Add `place` object alongside existing fields:
```json
{
  "...existing fields...",
  "place": {
    "lat": 13.7563,
    "lng": 100.5018,
    "formatted_address": "123 Sukhumvit Rd, Bangkok, Thailand",
    "place_id": "ChIJ...",
    "geocoded_at": "2026-04-24T12:00:00Z",
    "geocoder_status": "OK"
  }
}
```
Failed geocode: `place` still written with `geocoder_status: "ZERO_RESULTS" | "ERROR" | ...` and no lat/lng.

### Travel items
Each itinerary entry gets its own `place` object (same shape):
```json
{
  "itinerary": [
    {
      "order": 1,
      "name": "Senso-ji Temple",
      "type": "attraction",
      "location_text": "Asakusa, Tokyo",
      "google_maps_query": "Senso-ji Temple Asakusa Tokyo",
      "place": { "lat": 35.7148, "lng": 139.7967, "formatted_address": "...", "place_id": "...", "geocoded_at": "...", "geocoder_status": "OK" }
    }
  ]
}
```

### `MapPoint` (flat shape for the map)
```ts
type MapPoint = {
  point_id: string;          // `${itemId}` (food) or `${itemId}:${order}` (travel)
  item_id: Id<"savedItems">;
  name: string;
  category: "food" | "travel";
  sub_label: string | null;  // cuisine (food) or stop type (travel)
  lat: number;
  lng: number;
  source_url: string;
  thumbnail_url: string | null;
};
```

## Geocoding pipeline

### `convex/geocode.ts` (new, `"use node"`)
```ts
export async function geocodePlace(query: string): Promise<GeocodeResult>

type GeocodeResult =
  | { status: "OK"; lat: number; lng: number; formatted_address: string; place_id: string }
  | { status: "ZERO_RESULTS" | "REQUEST_DENIED" | "OVER_QUERY_LIMIT" | "ERROR"; error?: string };
```
- Hits `https://maps.googleapis.com/maps/api/geocode/json?address=<encoded>&key=<GOOGLE_GEOCODING_KEY>`.
- One retry with 500ms backoff on `OVER_QUERY_LIMIT` / 5xx; then returns `ERROR`.
- Missing key → returns `REQUEST_DENIED` with a warning; never throws.

### `enrichWithGeocoding` helper (in `convex/processUrl.ts`)
- Food: one geocode on `"<name>, <address>"`; attach `place` to top-level extraction.
- Travel: `Promise.all` over `itinerary[]`; attach `place` to each stop (uses `google_maps_query` from the existing prompt).

### Wiring
In `processItem`, after the extraction step emits its completed event, wrap the geocoding step in a try/catch so failures can't mark the item as failed:
```ts
if (category === "food" || category === "travel") {
  try {
    extraction = await enrichWithGeocoding(extraction, category, itemId, userId);
    await captureServer({ distinctId: userId, event: "item_geocoded", properties: { ... } });
  } catch (err) {
    await captureServer({ distinctId: userId, event: "item_geocode_failed", properties: { error: String(err) } });
  }
}
await ctx.runMutation(internal.items.updateResult, { ... });
```

## Backfill

Two Convex functions:
- `internal.items.listMissingGeocoding` (internalQuery): returns food/travel items in `done` status with missing/failed geocoding.
- `internal.processUrl.backfillGeocoding` (internalAction): paginates through them, calls `enrichWithGeocoding`, writes back via `internal.items.updateExtractedData` (new internal mutation).

Runbook:
```
npx convex run processUrl:backfillGeocoding '{"limit": 50}'
```
Re-run until `remaining` is 0.

## UI

### Toggle in `FeedApp.tsx`
- "Map" button in the tab row, only rendered when `activeCategory` is `food` or `travel`.
- State in URL: `?view=map`. Uses existing `updateParam`.
- Hides search + archive toggle while map is active.
- If the user switches to a non-supported category while `view=map`, the param is cleared.

### `<PlacesMap>` (new client component)
Props: `{ category: "food" | "travel"; onPinClick: (itemId: string) => void }`.

Responsibilities:
1. Reactive `useQuery(api.places.mapPoints, { category })` → `MapPoint[]`.
2. Load Google Maps JS via `src/lib/google-maps-loader.ts` singleton.
3. `new google.maps.Map` + `fitBounds` to all points on first load.
4. Markers with `@googlemaps/markerclusterer`; diff by `point_id` on re-render so updates don't rebuild the cluster.
5. Click pin → styled `InfoWindow` (name, sub_label, thumbnail, "Open saved item" button calling `onPinClick`).
6. Unmount cleanup: listeners, markers, clusterer.

States:
- Loading → skeleton.
- Empty array → "No places with coordinates yet."
- Maps JS fails → "Map unavailable. Check your Google Maps API key."

### `src/lib/google-maps-loader.ts`
Singleton promise; resolves `typeof google`. Uses `@googlemaps/js-api-loader`.

## API keys

Two separate keys, both set during setup:

1. **Browser key** — `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` in `.env.local`.
   - Restricted to *Maps JavaScript API* only.
   - HTTP referrer restriction: `http://localhost:3000/*`, production domain, preview domains.

2. **Server key** — `GOOGLE_GEOCODING_KEY` via `npx convex env set`.
   - Restricted to *Geocoding API* only.
   - No referrer/IP restriction (Convex actions use rotating IPs).

Budget alert at $10/mo recommended (free tier is $200/mo).

## PostHog instrumentation

New events:
- **Server** (`captureServer`):
  - `item_geocoded` — `{ item_id, category, stops_requested, stops_succeeded, latency_ms }`
  - `item_geocode_failed` — `{ item_id, category, error, status }`
- **Client** (`track`):
  - `map_opened` — `{ category, point_count }`
  - `map_pin_clicked` — `{ item_id, point_id, category, sub_label }`

Also add them to `EVENTS` / `SERVER_EVENTS` constant exports.

## Testing

- **`tests/convex/geocode.test.ts`** — mock `fetch`; cover OK, ZERO_RESULTS, REQUEST_DENIED, rate-limit retry, missing env key.
- **`tests/convex/places-flatten.test.ts`** — pure unit tests on `flattenToPoints` (exported from `convex/places.ts`): food-ok, food-failed-geocoding, travel-mixed-stops (some OK, some failed), archived-excluded, non-done-excluded, empty extractedData.
- **Manual browser QA** — new save (food + travel), pin rendering, cluster behavior, InfoWindow, toggle visibility rules, URL param persistence.
- **No E2E** — Google Maps doesn't play well with jsdom; manual QA is the authoritative check per CLAUDE.md.

## Rollout & rollback

Additive feature, no migrations. Disable by hiding the toggle (one-line change in `FeedApp.tsx`). Geocoding is wrapped in try/catch and can't corrupt items.

## Cost estimate

Geocoding: $5/1000 requests. Typical food save = 1 request; travel save = 5–15 requests. Backfill of 100 items ≈ $0.50–$1 one-time. Well inside the $200/mo Google free credit.

## Out of scope (YAGNI)

- In-map filters (cuisine, trip, date)
- Manual correction of a wrongly geocoded place
- Directions / routes / "near me"
- Shared map views
- Cross-user geocode dedup cache
- In-app geocoder usage dashboard (PostHog covers it)
