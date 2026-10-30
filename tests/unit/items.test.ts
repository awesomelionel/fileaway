import {
  ALREADY_PROCESSING_MESSAGE,
  extractThumbnailUrl,
  reprocessScheduleBlock,
} from "../../convex/items";

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

describe("reprocess schedule guard", () => {
  it("refuses to schedule when the item is already pending or processing", () => {
    for (const action of ["retry", "reprocess"] as const) {
      expect(reprocessScheduleBlock("pending", action)).toBe(ALREADY_PROCESSING_MESSAGE);
      expect(reprocessScheduleBlock("processing", action)).toBe(ALREADY_PROCESSING_MESSAGE);
    }
  });

  it("allows a failed retry and a done category reprocess", () => {
    expect(reprocessScheduleBlock("failed", "retry")).toBeNull();
    expect(reprocessScheduleBlock("done", "reprocess")).toBeNull();
  });

  it("rejects the wrong terminal status without scheduling", () => {
    expect(reprocessScheduleBlock("done", "retry")).toBe("Only failed items can be retried");
    expect(reprocessScheduleBlock("failed", "reprocess")).toBe(
      "Only done items can be re-processed",
    );
  });
});

describe("thumbnail in extractedData (pipeline persistence)", () => {
  it("extractThumbnailUrl returns the thumbnail when present in extractedData", () => {
    const extracted = {
      name: "Best Ramen",
      address: "123 Main St",
      thumbnailUrl: "https://tiktok.com/cover-merged.jpg",
    };
    expect(extractThumbnailUrl(extracted, null)).toBe(
      "https://tiktok.com/cover-merged.jpg",
    );
  });
});
