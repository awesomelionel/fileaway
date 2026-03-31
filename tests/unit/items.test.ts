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

  it("falls back to rawContent.thumbnailUrl when extractedData has no thumbnail", () => {
    const extracted = { name: "Some food" };
    const raw = { thumbnailUrl: "https://cdn.example.com/thumb.jpg" };
    expect(extractThumbnailUrl(extracted, raw)).toBe("https://cdn.example.com/thumb.jpg");
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
