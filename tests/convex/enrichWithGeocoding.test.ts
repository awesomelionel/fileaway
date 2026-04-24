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
