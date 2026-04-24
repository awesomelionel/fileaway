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
