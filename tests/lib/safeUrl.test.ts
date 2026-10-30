import { safeMapsHref, safeUrl, sanitizeExtractedUrls } from "@/lib/safeUrl";

describe("safeUrl", () => {
  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    " javascript:alert(1)",
    "\tjavascript:alert(1)",
    "\njavascript:alert(1)",
    "\r\nJAVASCRIPT:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "java\r\nscript:alert(1)",
    "\u0000javascript:alert(1)",
    "\u000Bjavascript:alert(1)",
    "\u000Cjavascript:alert(1)",
    "  JAVASCRIPT\n:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "DATA:text/html,hi",
    "vbscript:msgbox(1)",
    "VBSCRIPT:msgbox(1)",
    "blob:https://google.com/uuid",
    "file:///etc/passwd",
    "/maps",
    "//maps.google.com/maps",
    "maps.google.com/?q=Paris",
    "https://user:pass@maps.google.com/maps",
    "https://maps.google.com@evil.com/",
  ])("rejects %p", (value) => {
    expect(safeUrl(value)).toBeNull();
    expect(safeUrl(value, { allowHttp: true })).toBeNull();
  });

  it("accepts https and canonicalizes the host", () => {
    expect(safeUrl("https://www.tiktok.com/@user/video/1")).toBe(
      "https://www.tiktok.com/@user/video/1",
    );
    expect(safeUrl("HTTPS://Example.COM/a")).toBe("https://example.com/a");
  });

  it("allows http only when a saved source link needs it", () => {
    expect(safeUrl("http://instagram.com/p/abc")).toBeNull();
    expect(safeUrl("http://instagram.com/p/abc", { allowHttp: true })).toBe(
      "http://instagram.com/p/abc",
    );
  });

  it("rejects non-strings and empty input", () => {
    expect(safeUrl(null)).toBeNull();
    expect(safeUrl(undefined)).toBeNull();
    expect(safeUrl(42)).toBeNull();
    expect(safeUrl("   ")).toBeNull();
  });
});

describe("safeMapsHref", () => {
  it.each([
    ["https://google.com/maps/place/Paris", "https://google.com/maps/place/Paris"],
    [
      "https://www.google.com/maps/search/?api=1&query=cafe",
      "https://www.google.com/maps/search/?api=1&query=cafe",
    ],
    ["https://maps.google.com/?q=Paris", "https://maps.google.com/?q=Paris"],
    ["https://maps.app.goo.gl/abc123", "https://maps.app.goo.gl/abc123"],
    ["https://goo.gl/maps/abc", "https://goo.gl/maps/abc"],
    [
      "https://www.google.co.uk/maps/place/London",
      "https://www.google.co.uk/maps/place/London",
    ],
    [
      "https://www.google.com.au/maps/search/?api=1&query=a",
      "https://www.google.com.au/maps/search/?api=1&query=a",
    ],
    ["https://maps.google.co.uk/?q=London", "https://maps.google.co.uk/?q=London"],
    ["https://WWW.Google.COM/maps/place/X", "https://www.google.com/maps/place/X"],
    ["http://maps.google.com/?q=Paris", "https://maps.google.com/?q=Paris"],
    ["http://www.google.co.uk/maps/place/London", "https://www.google.co.uk/maps/place/London"],
  ])("accepts %s", (input, expected) => {
    expect(safeMapsHref({ url: input })).toBe(expected);
  });

  it.each([
    "https://google.com.evil.com/maps",
    "https://maps.google.com.evil.com/",
    "https://www.google.com.evil.com/maps",
    "https://evilgoogle.com/maps",
    "https://notmaps.google.com/maps",
    "https://goo.gl/notmaps",
    "https://goo.gl.evil.com/maps",
    "https://maps.app.goo.gl.evil.com/x",
    "https://www.google.com/url?q=https://evil.com",
    "https://www.google.com/maps-evil",
    "https://evil.com/maps.app.goo.gl",
    "javascript:alert(1)",
    " \nJAVASCRIPT:alert(1)",
    "data:text/html,hi",
    "/maps",
  ])("rejects lookalike or non-map %p", (url) => {
    expect(safeMapsHref({ url })).toBeNull();
  });

  it("keeps a real maps link ahead of the search fallback", () => {
    expect(
      safeMapsHref({
        url: "https://maps.app.goo.gl/abc",
        query: "somewhere else",
        name: "Elsewhere",
      }),
    ).toBe("https://maps.app.goo.gl/abc");
  });

  it("falls back to a Google Maps search from the query, then the name", () => {
    expect(
      safeMapsHref({
        url: "javascript:alert(1)",
        query: "Louvre Museum",
        name: "Louvre",
      }),
    ).toBe("https://www.google.com/maps/search/?api=1&query=Louvre%20Museum");

    expect(
      safeMapsHref({
        url: "https://google.com.evil.com/maps",
        name: "Eiffel Tower",
      }),
    ).toBe("https://www.google.com/maps/search/?api=1&query=Eiffel%20Tower");
  });

  it("encodes a hostile query into the search parameter", () => {
    const href = safeMapsHref({ url: "data:text/html,hi", query: "javascript:alert(1)" });
    expect(href).toBe(
      "https://www.google.com/maps/search/?api=1&query=javascript%3Aalert(1)",
    );
    expect(href).not.toContain("javascript:");
    expect(new URL(href!).protocol).toBe("https:");
  });

  it("returns null when nothing usable is left", () => {
    expect(safeMapsHref({ url: "javascript:alert(1)" })).toBeNull();
    expect(safeMapsHref({ url: "   ", query: "  ", name: "" })).toBeNull();
  });
});

describe("sanitizeExtractedUrls", () => {
  it("rewrites nested maps links and drops script thumbnail URLs", () => {
    const original = {
      summary: "mentions javascript:alert(1) as text",
      thumbnailUrl: "javascript:alert(1)",
      displayUrl: "data:text/html,hi",
      itinerary: [
        {
          name: "Louvre",
          google_maps_query: "Louvre Museum Paris",
          google_maps_url: "\nJAVASCRIPT:alert(1)",
          tips: ["go early"],
        },
        {
          name: "Notre-Dame",
          google_maps_url: "https://maps.google.com/?q=Notre-Dame",
        },
      ],
    };

    const sanitized = sanitizeExtractedUrls(original);

    expect(original.itinerary[0].google_maps_url).toBe("\nJAVASCRIPT:alert(1)");
    expect(sanitized.summary).toBe("mentions javascript:alert(1) as text");
    expect(sanitized).not.toHaveProperty("thumbnailUrl");
    expect(sanitized).not.toHaveProperty("displayUrl");
    expect(sanitized.itinerary[0].google_maps_url).toBe(
      "https://www.google.com/maps/search/?api=1&query=Louvre%20Museum%20Paris",
    );
    expect(sanitized.itinerary[0].tips).toEqual(["go early"]);
    expect(sanitized.itinerary[1].google_maps_url).toBe(
      "https://maps.google.com/?q=Notre-Dame",
    );
  });

  it("upgrades an http maps link and keeps a valid https thumbnail", () => {
    const sanitized = sanitizeExtractedUrls({
      thumbnail_url: "https://cdn.example.com/thumb.jpg",
      itinerary: [
        {
          name: "Paris",
          google_maps_url: "http://maps.google.com/?q=Paris",
        },
      ],
    });

    expect(sanitized.thumbnail_url).toBe("https://cdn.example.com/thumb.jpg");
    expect(sanitized.itinerary[0].google_maps_url).toBe("https://maps.google.com/?q=Paris");
  });

  it("is idempotent", () => {
    const once = sanitizeExtractedUrls({
      thumbnailUrl: "https://cdn.example.com/a.jpg",
      itinerary: [{ name: "Cafe", google_maps_url: "javascript:alert(1)" }],
    });
    expect(sanitizeExtractedUrls(once)).toEqual(once);
  });
});
