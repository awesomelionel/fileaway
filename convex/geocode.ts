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
