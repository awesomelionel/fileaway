# Places Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show saved Food and Travel places on an interactive Google Map with clustered, clickable pins. Pins appear only when the active category is Food or Travel.

**Architecture:** Additive. Geocoding runs server-side in the existing `processItem` Convex action (after extraction, before result persist) and writes `{ lat, lng, formatted_address, place_id, geocoder_status, geocoded_at }` into `extractedData` (food: top-level `place`; travel: per itinerary stop). A new Convex query `mapPoints` flattens to a `MapPoint[]`. A new `<PlacesMap>` client component renders Google Maps via `@googlemaps/js-api-loader` + `@googlemaps/markerclusterer`. A "Map" toggle in `FeedApp.tsx` swaps the feed grid for the map when the active category is Food or Travel.

**Tech Stack:** Next.js 14 App Router + React 18, Convex (actions/queries/mutations), Google Maps JavaScript API + Geocoding API, `@googlemaps/js-api-loader`, `@googlemaps/markerclusterer`, Jest + ts-jest, PostHog.

**Precondition:** User already set the Google Maps keys (`NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` in `.env.local` and `GOOGLE_GEOCODING_KEY` via `npx convex env set` on the dev deployment). The spec at `docs/superpowers/specs/2026-04-24-places-map-design.md` is authoritative if this plan is ambiguous.

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install runtime + type packages**

Run:
```
npm install @googlemaps/js-api-loader @googlemaps/markerclusterer
npm install --save-dev @types/google.maps
```

- [ ] **Step 2: Verify install**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```
git add package.json package-lock.json
git commit -m "chore(deps): add google maps loader + markerclusterer + types"
```

---

## Task 2: Add `convex/geocode.ts` with TDD

**Files:**
- Create: `convex/geocode.ts`
- Create: `tests/convex/geocode.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/convex/geocode.test.ts`:

```ts
const mockFetch = jest.fn();
(global as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  jest.resetModules();
  mockFetch.mockReset();
  process.env.GOOGLE_GEOCODING_KEY = "test-key";
});

test("geocodePlace returns OK with lat/lng on success", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      status: "OK",
      results: [
        {
          geometry: { location: { lat: 13.7563, lng: 100.5018 } },
          formatted_address: "Bangkok, Thailand",
          place_id: "ChIJtest",
        },
      ],
    }),
  });
  const { geocodePlace } = await import("../../convex/geocode");
  const r = await geocodePlace("Jay Fai, Bangkok");
  expect(r).toEqual({
    status: "OK",
    lat: 13.7563,
    lng: 100.5018,
    formatted_address: "Bangkok, Thailand",
    place_id: "ChIJtest",
  });
});

test("geocodePlace returns ZERO_RESULTS when Google returns no matches", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ status: "ZERO_RESULTS", results: [] }),
  });
  const { geocodePlace } = await import("../../convex/geocode");
  const r = await geocodePlace("asdfjkl nonexistent place");
  expect(r).toEqual({ status: "ZERO_RESULTS" });
});

test("geocodePlace returns REQUEST_DENIED when key is missing", async () => {
  delete process.env.GOOGLE_GEOCODING_KEY;
  const { geocodePlace } = await import("../../convex/geocode");
  const r = await geocodePlace("anything");
  expect(r.status).toBe("REQUEST_DENIED");
  expect(mockFetch).not.toHaveBeenCalled();
});

test("geocodePlace retries once on OVER_QUERY_LIMIT then returns ERROR", async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ status: "OVER_QUERY_LIMIT" }),
  });
  const { geocodePlace } = await import("../../convex/geocode");
  const r = await geocodePlace("anything");
  expect(r.status).toBe("OVER_QUERY_LIMIT");
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

test("geocodePlace returns ERROR on network failure", async () => {
  mockFetch.mockRejectedValue(new Error("ECONNRESET"));
  const { geocodePlace } = await import("../../convex/geocode");
  const r = await geocodePlace("anything");
  expect(r.status).toBe("ERROR");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/convex/geocode.test.ts`
Expected: FAIL — "Cannot find module '../../convex/geocode'".

- [ ] **Step 3: Implement `convex/geocode.ts`**

Create `convex/geocode.ts`:

```ts
"use node";

export type GeocodeResult =
  | {
      status: "OK";
      lat: number;
      lng: number;
      formatted_address: string;
      place_id: string;
    }
  | {
      status: "ZERO_RESULTS" | "REQUEST_DENIED" | "OVER_QUERY_LIMIT" | "ERROR";
      error?: string;
    };

const ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";

async function callOnce(query: string, key: string): Promise<GeocodeResult> {
  try {
    const url = `${ENDPOINT}?address=${encodeURIComponent(query)}&key=${key}`;
    const resp = await fetch(url);
    if (!resp.ok) return { status: "ERROR", error: `http_${resp.status}` };
    const body = (await resp.json()) as {
      status: string;
      results?: Array<{
        geometry?: { location?: { lat: number; lng: number } };
        formatted_address?: string;
        place_id?: string;
      }>;
    };

    if (body.status === "OK" && body.results && body.results[0]?.geometry?.location) {
      const r = body.results[0];
      return {
        status: "OK",
        lat: r.geometry!.location!.lat,
        lng: r.geometry!.location!.lng,
        formatted_address: r.formatted_address ?? query,
        place_id: r.place_id ?? "",
      };
    }
    if (body.status === "ZERO_RESULTS") return { status: "ZERO_RESULTS" };
    if (body.status === "OVER_QUERY_LIMIT") return { status: "OVER_QUERY_LIMIT" };
    if (body.status === "REQUEST_DENIED") return { status: "REQUEST_DENIED" };
    return { status: "ERROR", error: `api_${body.status}` };
  } catch (err) {
    return { status: "ERROR", error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function geocodePlace(query: string): Promise<GeocodeResult> {
  if (!query || !query.trim()) return { status: "ERROR", error: "empty_query" };
  const key = process.env.GOOGLE_GEOCODING_KEY;
  if (!key) {
    console.warn("[geocode] GOOGLE_GEOCODING_KEY not set");
    return { status: "REQUEST_DENIED", error: "GOOGLE_GEOCODING_KEY not set" };
  }

  let result = await callOnce(query, key);
  if (result.status === "OVER_QUERY_LIMIT" || (result.status === "ERROR" && result.error?.startsWith("http_5"))) {
    await new Promise((r) => setTimeout(r, 500));
    result = await callOnce(query, key);
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/convex/geocode.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```
git add convex/geocode.ts tests/convex/geocode.test.ts
git commit -m "feat(geocode): add Google Geocoding API wrapper with retry"
```

---

## Task 3: Add new SERVER_EVENTS + EVENTS constants

**Files:**
- Modify: `convex/analytics.ts`
- Modify: `src/lib/analytics.ts`

- [ ] **Step 1: Add server event constants**

Edit `convex/analytics.ts`. In the `SERVER_EVENTS` const, add two entries:

```ts
export const SERVER_EVENTS = {
  ITEM_PROCESSING_STARTED: "item_processing_started",
  ITEM_SCRAPE_COMPLETED: "item_scrape_completed",
  ITEM_SCRAPE_FAILED: "item_scrape_failed",
  ITEM_CATEGORIZED: "item_categorized",
  ITEM_EXTRACTION_COMPLETED: "item_extraction_completed",
  ITEM_EXTRACTION_FAILED: "item_extraction_failed",
  ITEM_PROCESSING_FAILED: "item_processing_failed",
  EXTRACTION_FIELD_MISSING: "extraction_field_missing",
  ITEM_GEOCODED: "item_geocoded",
  ITEM_GEOCODE_FAILED: "item_geocode_failed",
  LLM_GENERATION: "$ai_generation",
} as const;
```

- [ ] **Step 2: Add client event constants**

Edit `src/lib/analytics.ts`. Add two entries to `EVENTS`:

```ts
export const EVENTS = {
  LINK_SAVE_SUBMITTED: "link_save_submitted",
  LINK_SAVE_SUCCEEDED: "link_save_succeeded",
  LINK_SAVE_FAILED: "link_save_failed",
  ITEM_VIEWED: "item_viewed",
  ITEM_ACTION_TAKEN: "item_action_taken",
  ITEM_CORRECTION_SUBMITTED: "item_correction_submitted",
  ITEM_RETRY_CLICKED: "item_retry_clicked",
  ITEM_ARCHIVED: "item_archived",
  ITEM_RESTORED: "item_restored",
  CATEGORY_TAB_CHANGED: "category_tab_changed",
  SEARCH_PERFORMED: "search_performed",
  VIEW_TOGGLED: "view_toggled",
  MAP_OPENED: "map_opened",
  MAP_PIN_CLICKED: "map_pin_clicked",
} as const;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```
git add convex/analytics.ts src/lib/analytics.ts
git commit -m "feat(analytics): add geocode + map event constants"
```

---

## Task 4: Add `enrichWithGeocoding` helper (pure-ish) with TDD

**Files:**
- Create: `tests/convex/enrichWithGeocoding.test.ts`
- Modify: `convex/processUrl.ts` (add helper near top, below imports)

- [ ] **Step 1: Write the failing test**

Create `tests/convex/enrichWithGeocoding.test.ts`:

```ts
jest.mock("../../convex/geocode", () => ({
  geocodePlace: jest.fn(),
}));

import { geocodePlace } from "../../convex/geocode";
import { enrichWithGeocoding } from "../../convex/processUrl";

const mocked = geocodePlace as jest.Mock;

beforeEach(() => {
  mocked.mockReset();
});

test("food: attaches place object on OK", async () => {
  mocked.mockResolvedValueOnce({
    status: "OK",
    lat: 13.75,
    lng: 100.5,
    formatted_address: "Bangkok",
    place_id: "ChIJabc",
  });
  const out = await enrichWithGeocoding(
    { name: "Jay Fai", address: "327 Maha Chai Rd, Bangkok" },
    "food",
  );
  expect(out.place).toMatchObject({
    lat: 13.75,
    lng: 100.5,
    geocoder_status: "OK",
    formatted_address: "Bangkok",
    place_id: "ChIJabc",
  });
  expect(typeof (out.place as Record<string, unknown>).geocoded_at).toBe("string");
});

test("food: stores failed status when geocoder returns ZERO_RESULTS", async () => {
  mocked.mockResolvedValueOnce({ status: "ZERO_RESULTS" });
  const out = await enrichWithGeocoding(
    { name: "X", address: "Y" },
    "food",
  );
  expect(out.place).toMatchObject({ geocoder_status: "ZERO_RESULTS" });
  expect((out.place as Record<string, unknown>).lat).toBeUndefined();
});

test("food: no name+address → returns extraction unchanged", async () => {
  const out = await enrichWithGeocoding({ bullets: ["only bullets"] }, "food");
  expect(out.place).toBeUndefined();
  expect(mocked).not.toHaveBeenCalled();
});

test("travel: enriches every itinerary stop with its own place", async () => {
  mocked
    .mockResolvedValueOnce({ status: "OK", lat: 1, lng: 2, formatted_address: "A", place_id: "pa" })
    .mockResolvedValueOnce({ status: "ZERO_RESULTS" })
    .mockResolvedValueOnce({ status: "OK", lat: 3, lng: 4, formatted_address: "C", place_id: "pc" });

  const out = await enrichWithGeocoding(
    {
      title: "Trip",
      itinerary: [
        { order: 1, name: "A", location_text: "LA", google_maps_query: "A LA" },
        { order: 2, name: "B", location_text: "LB", google_maps_query: "B LB" },
        { order: 3, name: "C", location_text: "LC", google_maps_query: "C LC" },
      ],
    },
    "travel",
  );
  const stops = out.itinerary as Array<Record<string, unknown>>;
  expect((stops[0].place as Record<string, unknown>).geocoder_status).toBe("OK");
  expect((stops[1].place as Record<string, unknown>).geocoder_status).toBe("ZERO_RESULTS");
  expect((stops[2].place as Record<string, unknown>).geocoder_status).toBe("OK");
  expect(mocked).toHaveBeenCalledTimes(3);
});

test("travel: falls back to name + location_text when google_maps_query missing", async () => {
  mocked.mockResolvedValueOnce({ status: "OK", lat: 0, lng: 0, formatted_address: "x", place_id: "p" });
  await enrichWithGeocoding(
    { itinerary: [{ order: 1, name: "Cafe X", location_text: "Rome" }] },
    "travel",
  );
  expect(mocked).toHaveBeenCalledWith("Cafe X, Rome");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/convex/enrichWithGeocoding.test.ts`
Expected: FAIL — `enrichWithGeocoding` is not exported from `convex/processUrl.ts`.

- [ ] **Step 3: Add `enrichWithGeocoding` + `toPlaceField` to `convex/processUrl.ts`**

In `convex/processUrl.ts`, add this import near the top (below the existing `captureServer`/`SERVER_EVENTS` import):

```ts
import { geocodePlace, type GeocodeResult } from "./geocode";
```

Then add these two functions just above the `// ─── Types ──` section marker:

```ts
export function toPlaceField(r: GeocodeResult): Record<string, unknown> {
  if (r.status === "OK") {
    return {
      lat: r.lat,
      lng: r.lng,
      formatted_address: r.formatted_address,
      place_id: r.place_id,
      geocoder_status: "OK",
      geocoded_at: new Date().toISOString(),
    };
  }
  return {
    geocoder_status: r.status,
    geocoded_at: new Date().toISOString(),
    ...(r.error ? { error: r.error } : {}),
  };
}

export async function enrichWithGeocoding(
  extraction: Record<string, unknown>,
  category: "food" | "travel",
): Promise<Record<string, unknown>> {
  if (category === "food") {
    const name = typeof extraction.name === "string" ? extraction.name : "";
    const address = typeof extraction.address === "string" ? extraction.address : "";
    const query = [name, address].filter((s) => s && s.trim()).join(", ");
    if (!query) return extraction;
    const result = await geocodePlace(query);
    return { ...extraction, place: toPlaceField(result) };
  }

  const itinerary = Array.isArray(extraction.itinerary)
    ? (extraction.itinerary as Array<Record<string, unknown>>)
    : [];
  if (!itinerary.length) return extraction;

  const enriched = await Promise.all(
    itinerary.map(async (stop) => {
      const gmq = typeof stop.google_maps_query === "string" ? stop.google_maps_query : "";
      const name = typeof stop.name === "string" ? stop.name : "";
      const loc = typeof stop.location_text === "string" ? stop.location_text : "";
      const query = gmq || [name, loc].filter((s) => s && s.trim()).join(", ");
      if (!query) return stop;
      const result = await geocodePlace(query);
      return { ...stop, place: toPlaceField(result) };
    }),
  );
  return { ...extraction, itinerary: enriched };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/convex/enrichWithGeocoding.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```
git add convex/processUrl.ts tests/convex/enrichWithGeocoding.test.ts
git commit -m "feat(geocode): add enrichWithGeocoding helper for food + travel"
```

---

## Task 5: Wire geocoding into the `processItem` pipeline

**Files:**
- Modify: `convex/processUrl.ts` (around line 1053, after extraction-complete emit and before the thumbnail block)

- [ ] **Step 1: Read the target block**

Open `convex/processUrl.ts` and locate the section after:

```ts
console.log(`[processUrl] Extraction complete — category: ${extraction.category}, action: ${extraction.actionTaken}, dataKeys: ${extractedKeys.join(", ")}`);
```

and before:

```ts
let thumbnailR2Key: string | undefined;
```

This is where the geocoding step slots in.

- [ ] **Step 2: Insert the geocoding step**

Insert immediately after the `Extraction complete` log line:

```ts
      if (extraction.category === "food" || extraction.category === "travel") {
        const geocodeStart = Date.now();
        try {
          const enriched = await enrichWithGeocoding(
            extraction.extractedData as Record<string, unknown>,
            extraction.category,
          );
          extraction.extractedData = enriched;

          const stopsRequested =
            extraction.category === "travel"
              ? (enriched.itinerary as Array<Record<string, unknown>> | undefined)?.length ?? 0
              : 1;
          const stopsSucceeded =
            extraction.category === "travel"
              ? ((enriched.itinerary as Array<Record<string, unknown>> | undefined) ?? []).filter(
                  (s) => (s.place as Record<string, unknown> | undefined)?.geocoder_status === "OK",
                ).length
              : (enriched.place as Record<string, unknown> | undefined)?.geocoder_status === "OK"
                ? 1
                : 0;

          await captureServer({
            distinctId,
            event: SERVER_EVENTS.ITEM_GEOCODED,
            properties: {
              item_id: savedItemId,
              category: extraction.category,
              stops_requested: stopsRequested,
              stops_succeeded: stopsSucceeded,
              latency_ms: Date.now() - geocodeStart,
            },
          });
        } catch (geoErr) {
          await captureServer({
            distinctId,
            event: SERVER_EVENTS.ITEM_GEOCODE_FAILED,
            properties: {
              item_id: savedItemId,
              category: extraction.category,
              latency_ms: Date.now() - geocodeStart,
              error: geoErr instanceof Error ? geoErr.message : "unknown",
            },
          });
        }
      }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run existing tests (sanity)**

Run: `npm test -- --silent`
Expected: all existing suites still pass.

- [ ] **Step 5: Commit**

```
git add convex/processUrl.ts
git commit -m "feat(geocode): wire enrichWithGeocoding into processItem pipeline"
```

---

## Task 6: Add `flattenToPoints` pure function with TDD

**Files:**
- Create: `tests/convex/places-flatten.test.ts`
- Create: `convex/places.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/convex/places-flatten.test.ts`:

```ts
import { flattenToPoints, type FlattenInput } from "../../convex/places";

const baseItem = (overrides: Partial<FlattenInput[number]>): FlattenInput[number] => ({
  _id: "it_1" as unknown as FlattenInput[number]["_id"],
  sourceUrl: "https://tiktok.com/@x/video/1",
  category: "food",
  status: "done",
  archived: false,
  extractedData: null,
  thumbnailUrl: null,
  ...overrides,
});

test("food: OK place → 1 point with sub_label=cuisine", () => {
  const points = flattenToPoints([
    baseItem({
      category: "food",
      extractedData: {
        name: "Jay Fai",
        cuisine: "Thai street food",
        place: { lat: 13.75, lng: 100.5, geocoder_status: "OK" },
      },
    }),
  ]);
  expect(points).toHaveLength(1);
  expect(points[0]).toMatchObject({
    point_id: "it_1",
    name: "Jay Fai",
    category: "food",
    sub_label: "Thai street food",
    lat: 13.75,
    lng: 100.5,
  });
});

test("food: failed geocoding → 0 points", () => {
  const points = flattenToPoints([
    baseItem({
      category: "food",
      extractedData: {
        name: "X",
        place: { geocoder_status: "ZERO_RESULTS" },
      },
    }),
  ]);
  expect(points).toHaveLength(0);
});

test("travel: multi-stop itinerary emits one point per OK stop with sub_label=type", () => {
  const points = flattenToPoints([
    baseItem({
      _id: "it_2" as unknown as FlattenInput[number]["_id"],
      category: "travel",
      extractedData: {
        title: "Tokyo",
        itinerary: [
          { order: 1, name: "Senso-ji", type: "attraction", place: { lat: 35.7, lng: 139.8, geocoder_status: "OK" } },
          { order: 2, name: "Shibuya", type: "neighborhood", place: { geocoder_status: "ZERO_RESULTS" } },
          { order: 3, name: "Afuri", type: "restaurant", place: { lat: 35.66, lng: 139.71, geocoder_status: "OK" } },
        ],
      },
    }),
  ]);
  expect(points).toHaveLength(2);
  expect(points[0]).toMatchObject({
    point_id: "it_2:1",
    item_id: "it_2",
    name: "Senso-ji",
    category: "travel",
    sub_label: "attraction",
  });
  expect(points[1]).toMatchObject({
    point_id: "it_2:3",
    name: "Afuri",
    sub_label: "restaurant",
  });
});

test("archived items are excluded", () => {
  const points = flattenToPoints([
    baseItem({
      archived: true,
      extractedData: {
        name: "X",
        place: { lat: 1, lng: 2, geocoder_status: "OK" },
      },
    }),
  ]);
  expect(points).toHaveLength(0);
});

test("non-done items are excluded", () => {
  const points = flattenToPoints([
    baseItem({
      status: "processing",
      extractedData: { name: "X", place: { lat: 1, lng: 2, geocoder_status: "OK" } },
    }),
  ]);
  expect(points).toHaveLength(0);
});

test("null extractedData → 0 points", () => {
  const points = flattenToPoints([baseItem({ extractedData: null })]);
  expect(points).toHaveLength(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/convex/places-flatten.test.ts`
Expected: FAIL — "Cannot find module '../../convex/places'".

- [ ] **Step 3: Implement `convex/places.ts` (query left as a stub; flatten is the real logic)**

Create `convex/places.ts`:

```ts
import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

export type MapPoint = {
  point_id: string;
  item_id: Id<"savedItems">;
  name: string;
  category: "food" | "travel";
  sub_label: string | null;
  lat: number;
  lng: number;
  source_url: string;
  thumbnail_url: string | null;
};

export type FlattenInput = Array<{
  _id: Id<"savedItems">;
  sourceUrl: string;
  category: string;
  status: "pending" | "processing" | "done" | "failed";
  archived: boolean;
  extractedData: unknown;
  thumbnailUrl: string | null;
}>;

function isOkPlace(
  place: unknown,
): place is { lat: number; lng: number; geocoder_status: "OK" } {
  if (!place || typeof place !== "object") return false;
  const p = place as Record<string, unknown>;
  return (
    p.geocoder_status === "OK" &&
    typeof p.lat === "number" &&
    typeof p.lng === "number"
  );
}

export function flattenToPoints(items: FlattenInput): MapPoint[] {
  const out: MapPoint[] = [];
  for (const item of items) {
    if (item.archived) continue;
    if (item.status !== "done") continue;
    if (item.category !== "food" && item.category !== "travel") continue;
    const data = item.extractedData as Record<string, unknown> | null;
    if (!data) continue;

    if (item.category === "food") {
      if (!isOkPlace(data.place)) continue;
      const place = data.place as { lat: number; lng: number };
      out.push({
        point_id: String(item._id),
        item_id: item._id,
        name: typeof data.name === "string" ? data.name : "Untitled",
        category: "food",
        sub_label: typeof data.cuisine === "string" ? data.cuisine : null,
        lat: place.lat,
        lng: place.lng,
        source_url: item.sourceUrl,
        thumbnail_url: item.thumbnailUrl,
      });
      continue;
    }

    // travel
    const itinerary = Array.isArray(data.itinerary)
      ? (data.itinerary as Array<Record<string, unknown>>)
      : [];
    for (const stop of itinerary) {
      if (!isOkPlace(stop.place)) continue;
      const place = stop.place as { lat: number; lng: number };
      const order = stop.order ?? stop.name;
      out.push({
        point_id: `${String(item._id)}:${String(order)}`,
        item_id: item._id,
        name: typeof stop.name === "string" ? stop.name : "Untitled",
        category: "travel",
        sub_label: typeof stop.type === "string" ? stop.type : null,
        lat: place.lat,
        lng: place.lng,
        source_url: item.sourceUrl,
        thumbnail_url: item.thumbnailUrl,
      });
    }
  }
  return out;
}

export const mapPoints = query({
  args: { category: v.union(v.literal("food"), v.literal("travel")) },
  handler: async (ctx, args): Promise<MapPoint[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const rows = await ctx.db
      .query("savedItems")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(250);

    return flattenToPoints(
      rows
        .filter((r) => r.category === args.category)
        .map((r) => ({
          _id: r._id,
          sourceUrl: r.sourceUrl,
          category: r.category,
          status: r.status,
          archived: r.archived === true,
          extractedData: r.extractedData ?? null,
          thumbnailUrl: null,
        })),
    );
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/convex/places-flatten.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```
git add convex/places.ts tests/convex/places-flatten.test.ts
git commit -m "feat(places): add flattenToPoints + mapPoints Convex query"
```

---

## Task 7: Add thumbnail resolution to `mapPoints`

**Files:**
- Modify: `convex/places.ts`

- [ ] **Step 1: Read existing thumbnail helpers**

Open `convex/items.ts` and find the helper that resolves a thumbnail URL from an item (used by `toResponse`). Look for a function whose body calls `ctx.storage.getUrl` for `thumbnailStorageId` and constructs an R2 URL from `thumbnailR2Key`. Note its name so you can reuse it.

- [ ] **Step 2: Extract `resolveThumbnailUrl` to a shared module if not exported**

If the helper is not exported from `convex/items.ts`, export it. Its signature should be:

```ts
export async function resolveThumbnailUrl(
  ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } },
  item: { thumbnailStorageId?: Id<"_storage">; thumbnailR2Key?: string },
): Promise<string | null>
```

If no such helper exists yet, create one in `convex/items.ts` based on the existing pattern found in `toResponse` (i.e. mirror how `list` builds thumbnail URLs per item today). Keep behavior identical; don't refactor unrelated code.

- [ ] **Step 3: Wire thumbnails into `mapPoints`**

Edit `convex/places.ts`. Import the helper and call it per row:

```ts
import { resolveThumbnailUrl } from "./items";
```

Replace the existing `handler` body of `mapPoints` with:

```ts
  handler: async (ctx, args): Promise<MapPoint[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const rows = await ctx.db
      .query("savedItems")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(250);

    const filtered = rows.filter((r) => r.category === args.category);
    const enriched = await Promise.all(
      filtered.map(async (r) => ({
        _id: r._id,
        sourceUrl: r.sourceUrl,
        category: r.category,
        status: r.status,
        archived: r.archived === true,
        extractedData: r.extractedData ?? null,
        thumbnailUrl: await resolveThumbnailUrl(ctx, r),
      })),
    );

    return flattenToPoints(enriched);
  },
```

- [ ] **Step 4: Typecheck + tests**

Run: `npx tsc --noEmit && npx jest tests/convex/places-flatten.test.ts`
Expected: no type errors, tests still pass (flatten is unchanged).

- [ ] **Step 5: Commit**

```
git add convex/places.ts convex/items.ts
git commit -m "feat(places): resolve thumbnails when flattening to MapPoints"
```

---

## Task 8: Backfill geocoding for existing items

**Files:**
- Modify: `convex/items.ts` (add `listMissingGeocoding` internal query + `updateExtractedData` internal mutation)
- Modify: `convex/processUrl.ts` (add `backfillGeocoding` internal action)

- [ ] **Step 1: Add `listMissingGeocoding` internalQuery to `convex/items.ts`**

At the bottom of `convex/items.ts`, append:

```ts
function hasOkGeocoding(extractedData: unknown, category: string): boolean {
  if (!extractedData || typeof extractedData !== "object") return false;
  const d = extractedData as Record<string, unknown>;
  if (category === "food") {
    const p = d.place as Record<string, unknown> | undefined;
    return !!p && p.geocoder_status === "OK";
  }
  if (category === "travel") {
    const it = Array.isArray(d.itinerary) ? (d.itinerary as Array<Record<string, unknown>>) : [];
    if (!it.length) return true; // nothing to geocode
    return it.every((s) => {
      const p = s.place as Record<string, unknown> | undefined;
      return !!p && p.geocoder_status === "OK";
    });
  }
  return true;
}

export const listMissingGeocoding = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("savedItems")
      .withIndex("by_status", (q) => q.eq("status", "done"))
      .collect();

    return rows
      .filter((r) => r.category === "food" || r.category === "travel")
      .filter((r) => !hasOkGeocoding(r.extractedData, r.category))
      .map((r) => ({
        id: r._id,
        userId: r.userId,
        category: r.category as "food" | "travel",
        extractedData: r.extractedData ?? null,
      }));
  },
});

export const updateExtractedData = internalMutation({
  args: {
    id: v.id("savedItems"),
    extractedData: v.any(),
  },
  handler: async (ctx, { id, extractedData }) => {
    const item = await ctx.db.get(id);
    if (!item) return;
    await ctx.db.patch(id, { extractedData });
  },
});
```

- [ ] **Step 2: Add `backfillGeocoding` internalAction to `convex/processUrl.ts`**

At the bottom of `convex/processUrl.ts`, after the existing `backfillThumbnails` action, add:

```ts
export const backfillGeocoding = internalAction({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const all = await ctx.runQuery(internal.items.listMissingGeocoding);
    const page = all.slice(0, limit);
    let succeeded = 0;
    let failed = 0;

    for (const item of page) {
      try {
        const enriched = await enrichWithGeocoding(
          (item.extractedData as Record<string, unknown> | null) ?? {},
          item.category,
        );
        await ctx.runMutation(internal.items.updateExtractedData, {
          id: item.id,
          extractedData: enriched,
        });
        succeeded++;
      } catch (err) {
        failed++;
        console.error(`[backfillGeocoding] ${item.id} failed:`, err);
      }
    }

    return {
      processed: page.length,
      succeeded,
      failed,
      remaining: Math.max(0, all.length - page.length),
    };
  },
});
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```
git add convex/items.ts convex/processUrl.ts
git commit -m "feat(places): add backfillGeocoding internal action"
```

---

## Task 9: Google Maps script loader

**Files:**
- Create: `src/lib/google-maps-loader.ts`

- [ ] **Step 1: Create the loader**

Create `src/lib/google-maps-loader.ts`:

```ts
import { Loader } from "@googlemaps/js-api-loader";

let loaderPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (loaderPromise) return loaderPromise;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error("NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY is not set"),
    );
  }
  const loader = new Loader({
    apiKey,
    version: "weekly",
    libraries: [],
  });
  loaderPromise = loader.load();
  return loaderPromise;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/lib/google-maps-loader.ts
git commit -m "feat(map): add Google Maps loader singleton"
```

---

## Task 10: `<PlacesMap>` client component

**Files:**
- Create: `src/components/feed/PlacesMap.tsx`

- [ ] **Step 1: Implement the component**

Create `src/components/feed/PlacesMap.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import { track, EVENTS } from "@/lib/analytics";

type Category = "food" | "travel";
type Props = { category: Category; onPinClick: (itemId: string) => void };
type LoadState = "loading" | "ready" | "error";

export function PlacesMap({ category, onPinClick }: Props) {
  const points = useQuery(api.places.mapPoints, { category });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const trackedOpenRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new g.maps.Map(containerRef.current, {
          center: { lat: 20, lng: 0 },
          zoom: 2,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        infoRef.current = new g.maps.InfoWindow();
        setLoadState("ready");
      })
      .catch((err) => {
        console.error("[PlacesMap] failed to load Google Maps", err);
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
      infoRef.current?.close();
      clustererRef.current?.clearMarkers();
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current.clear();
      mapRef.current = null;
      clustererRef.current = null;
      infoRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (loadState !== "ready" || !mapRef.current) return;
    if (!points) return;

    if (!trackedOpenRef.current) {
      track(EVENTS.MAP_OPENED, { category, point_count: points.length });
      trackedOpenRef.current = true;
    }

    const g = window.google;
    const map = mapRef.current;

    const nextIds = new Set(points.map((p) => p.point_id));
    markersRef.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    });

    for (const p of points) {
      let marker = markersRef.current.get(p.point_id);
      if (!marker) {
        marker = new g.maps.Marker({
          position: { lat: p.lat, lng: p.lng },
          title: p.name,
        });
        marker.addListener("click", () => {
          if (!infoRef.current || !mapRef.current) return;
          infoRef.current.setContent(renderInfoHTML(p));
          infoRef.current.open({ anchor: marker, map: mapRef.current });
          document
            .getElementById(`open-item-${p.point_id}`)
            ?.addEventListener(
              "click",
              () => {
                track(EVENTS.MAP_PIN_CLICKED, {
                  item_id: p.item_id,
                  point_id: p.point_id,
                  category: p.category,
                  sub_label: p.sub_label,
                });
                onPinClick(p.item_id);
              },
              { once: true },
            );
        });
        markersRef.current.set(p.point_id, marker);
      } else {
        marker.setPosition({ lat: p.lat, lng: p.lng });
      }
    }

    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current.addMarkers(Array.from(markersRef.current.values()));
    } else {
      clustererRef.current = new MarkerClusterer({
        map,
        markers: Array.from(markersRef.current.values()),
      });
    }

    if (points.length > 0) {
      const bounds = new g.maps.LatLngBounds();
      for (const p of points) bounds.extend({ lat: p.lat, lng: p.lng });
      map.fitBounds(bounds, 48);
      if (points.length === 1) map.setZoom(13);
    }
  }, [points, loadState, category, onPinClick]);

  useEffect(() => {
    trackedOpenRef.current = false;
  }, [category]);

  if (loadState === "error") {
    return (
      <div className="flex items-center justify-center h-[60vh] text-fa-muted text-sm">
        Map unavailable. Check your Google Maps API key.
      </div>
    );
  }

  if (points === undefined || loadState === "loading") {
    return (
      <div className="h-[60vh] rounded-lg bg-fa-surface animate-pulse" aria-label="Loading map" />
    );
  }

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-fa-muted text-sm text-center px-4">
        No places with coordinates yet. New items will appear here once they're processed.
      </div>
    );
  }

  return <div ref={containerRef} className="h-[70vh] rounded-lg overflow-hidden" />;
}

function renderInfoHTML(p: {
  point_id: string;
  name: string;
  sub_label: string | null;
  thumbnail_url: string | null;
}): string {
  const thumb = p.thumbnail_url
    ? `<img src="${p.thumbnail_url}" alt="" style="width:100%;height:96px;object-fit:cover;border-radius:4px;margin-bottom:8px" />`
    : "";
  const sub = p.sub_label
    ? `<div style="font-size:12px;color:#666;margin-bottom:8px">${escapeHTML(p.sub_label)}</div>`
    : "";
  return `
    <div style="width:200px;font-family:inherit">
      ${thumb}
      <div style="font-weight:600;font-size:13px;margin-bottom:4px">${escapeHTML(p.name)}</div>
      ${sub}
      <button id="open-item-${p.point_id}" style="width:100%;min-height:44px;background:#111;color:#fff;border:0;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">Open saved item</button>
    </div>
  `;
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/components/feed/PlacesMap.tsx
git commit -m "feat(map): add PlacesMap component with clustered markers"
```

---

## Task 11: Wire the Map toggle into `FeedApp.tsx`

**Files:**
- Modify: `src/components/feed/FeedApp.tsx`

- [ ] **Step 1: Import the component**

Near the top of `src/components/feed/FeedApp.tsx`, after the existing `dynamic` import block, add:

```tsx
const PlacesMap = dynamic(
  () => import("@/components/feed/PlacesMap").then((m) => ({ default: m.PlacesMap })),
  { ssr: false },
);
```

- [ ] **Step 2: Derive the map-view state**

Inside the main `FeedApp` component body (near where `activeCategory` is computed), add:

```tsx
const mapView = searchParams.get("view") === "map";
const showMapToggle = activeCategory === "food" || activeCategory === "travel";

useEffect(() => {
  if (mapView && !showMapToggle) {
    updateParam({ view: null });
  }
}, [mapView, showMapToggle, updateParam]);
```

(Add `useEffect` to the existing `react` import at the top of the file if it's not already imported.)

- [ ] **Step 3: Add the Map toggle button**

In the "Feed vs archive + count (single pill)" block around line 432, add a third button *inside the same pill container*, immediately after the `Archive` button and before the count span:

```tsx
            {showMapToggle && (
              <button
                type="button"
                onClick={() => {
                  track(EVENTS.VIEW_TOGGLED, {
                    to: mapView ? "feed" : "map",
                    from: mapView ? "map" : archiveView ? "archive" : "feed",
                  });
                  updateParam({ view: mapView ? null : "map" });
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  mapView ? "bg-fa-pill-active text-fa-primary" : "text-fa-subtle hover:text-fa-muted"
                }`}
              >
                Map
              </button>
            )}
```

- [ ] **Step 4: Swap the body when in map view**

Replace the `<main>` block (the one that renders the grid) with:

```tsx
      <main className="max-w-5xl mx-auto px-4 py-6">
        {mapView && showMapToggle ? (
          <PlacesMap
            category={activeCategory as "food" | "travel"}
            onPinClick={(id) => openItem(id)}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            ) : filteredItems.length === 0 ? (
              <EmptyState category={activeCategory} archiveView={archiveView} />
            ) : (
              filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  categories={categories.map((c) => ({ slug: c.slug, label: c.label }))}
                  onCardClick={openItem}
                />
              ))
            )}
          </div>
        )}
      </main>
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors; lint passes (warnings OK).

- [ ] **Step 6: Commit**

```
git add src/components/feed/FeedApp.tsx
git commit -m "feat(map): add Map toggle to FeedApp for food + travel tabs"
```

---

## Task 12: Full test suite sanity

**Files:** none (verification only)

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: all suites pass. No regressions in existing tests.

- [ ] **Step 2: Final typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: If anything fails, fix and re-commit in focused commits**

No commit if all green.

---

## Task 13: Manual browser QA

**Files:** none (manual verification per CLAUDE.md UI rule)

- [ ] **Step 1: Start dev servers**

Run in two terminals:
```
npx convex dev
npm run dev
```
Expected: frontend at `http://localhost:3000`.

- [ ] **Step 2: Verify pipeline geocodes new saves**

  1. Log in.
  2. Save a new TikTok or Instagram URL that's clearly food (e.g. a restaurant review).
  3. Wait for `status: done`.
  4. Open Convex dashboard → `savedItems` → the new row. Confirm `extractedData.place.geocoder_status === "OK"` with numeric `lat`/`lng`.
  5. Save a new travel URL with multiple stops. Confirm each `extractedData.itinerary[i].place` is populated.

Expected: both items' `place` fields are populated.

- [ ] **Step 3: Verify map toggle behavior**

  1. Click the Food category tab. A "Map" button appears in the view-pill.
  2. Click Map. The grid is replaced by the map; pins render and cluster at low zoom.
  3. Zoom in; clusters split into individual markers.
  4. Click a marker → InfoWindow opens with the place name, cuisine, and "Open saved item" button.
  5. Click "Open saved item" → the existing item modal opens for the right item.
  6. Switch to Travel — map stays in map view, now showing travel pins.
  7. Switch to any non-food/non-travel tab (e.g. Recipe). The Map toggle disappears and the view reverts to the grid.
  8. With `?view=map` in the URL while on Food, refresh the page. Map view is preserved.
  9. While on a supported tab and map view, hit the Archive toggle. Confirm behavior is sane (current product decision: Map and Archive are orthogonal — archiving on/off while in map view is acceptable, since map only shows non-archived items).

Expected: all steps pass.

- [ ] **Step 4: Verify PostHog events fire**

Open PostHog Live Events. Confirm:
- `map_opened` fires with `category` + `point_count` when the toggle flips on.
- `map_pin_clicked` fires on "Open saved item" with `item_id`, `point_id`, `category`, `sub_label`.
- On a fresh save, `item_geocoded` (server-side) appears in PostHog within ~60s with `stops_requested`, `stops_succeeded`, `latency_ms`.

Expected: all three events visible.

- [ ] **Step 5: If any step fails, file a fix as a separate commit**

Do not proceed to Task 14 unless all of Task 13 is green.

---

## Task 14: Backfill existing items

**Files:** none (runtime action)

- [ ] **Step 1: Run the backfill in pages**

Run:
```
npx convex run processUrl:backfillGeocoding '{"limit": 50}'
```
Expected output JSON: `{ processed, succeeded, failed, remaining }`.

- [ ] **Step 2: Repeat until `remaining` is 0**

Run the same command until `remaining: 0`.

- [ ] **Step 3: Spot-check in UI**

Reload the app, open Food tab → Map. Confirm previously-saved food items now appear as pins.

- [ ] **Step 4: No commit** — this is a runtime operation, not a code change.

---

## Notes for the implementing engineer

- **Pipeline hook is best-effort.** Section 3 wraps geocoding in try/catch. A failure must not mark the item as `failed`. If you find yourself throwing from inside the geocode step, stop — re-read `convex/processUrl.ts` line ~1092 and verify your code does not.
- **Marker re-renders.** The PlacesMap diff by `point_id` is important. Don't recreate all markers on every Convex update; the cluster rebuild is expensive when zoomed in.
- **Key on the client.** `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` ships in the JS bundle. That's expected; Google's model is referrer restriction, not secrecy.
- **Backfill is idempotent.** `hasOkGeocoding` skips items that are already fully geocoded. Running it twice is safe.
- **`extractedData` is `v.any()`** — no schema migration needed. Don't add a field to `schema.ts`.
- **Don't touch the archive/feed toggle logic.** The map toggle is additive; orthogonal to archive.
