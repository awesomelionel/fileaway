import { WRAPPER_INSTRUCTIONS, shouldUseVideoAnalysis } from "../../convex/processUrl";

describe("Extraction prompt schemas", () => {
  describe("buildExtractionPrompt wrapper", () => {
    it("includes social-media inference guidance", () => {
      expect(WRAPPER_INSTRUCTIONS).toContain("infer");
      expect(WRAPPER_INSTRUCTIONS).toContain("hashtags");
      expect(WRAPPER_INSTRUCTIONS).toContain("null");
      expect(WRAPPER_INSTRUCTIONS).toContain("CRITICAL");
      expect(WRAPPER_INSTRUCTIONS).toContain("truncate");
      expect(WRAPPER_INSTRUCTIONS).toContain("array");
    });
  });
});

describe("shouldUseVideoAnalysis", () => {
  it("returns true for tiktok video-analysis with a videoUrl", () => {
    expect(shouldUseVideoAnalysis("video-analysis", "tiktok", "https://cdn.tiktok.com/v.mp4")).toBe(true);
  });

  it("returns true for instagram video-analysis with a videoUrl", () => {
    expect(shouldUseVideoAnalysis("video-analysis", "instagram", "https://cdn.instagram.com/v.mp4")).toBe(true);
  });

  it("returns true for twitter video-analysis with a videoUrl", () => {
    expect(shouldUseVideoAnalysis("video-analysis", "twitter", "https://video.twimg.com/v.mp4")).toBe(true);
  });

  it("returns false for youtube even with a videoUrl", () => {
    expect(shouldUseVideoAnalysis("video-analysis", "youtube", "https://yt.com/v.mp4")).toBe(false);
  });

  it("returns false for other platform", () => {
    expect(shouldUseVideoAnalysis("video-analysis", "other", "https://example.com/v.mp4")).toBe(false);
  });

  it("returns false for non-video-analysis category", () => {
    expect(shouldUseVideoAnalysis("recipe", "tiktok", "https://cdn.tiktok.com/v.mp4")).toBe(false);
  });

  it("returns false when videoUrl is absent", () => {
    expect(shouldUseVideoAnalysis("video-analysis", "tiktok", undefined)).toBe(false);
  });
});
