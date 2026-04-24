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
