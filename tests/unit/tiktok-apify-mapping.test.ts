import { __testables } from "../../convex/processUrl";

describe("TikTok Apify mapping", () => {
  describe("pickTikTokThumbnailUrl", () => {
    it("prefers flattened videoMeta.coverUrl when present", () => {
      const item: Record<string, unknown> = {
        "videoMeta.coverUrl": "https://cdn.example.com/cover-from-flat.jpg",
        coverUrl: "https://cdn.example.com/cover-fallback.jpg",
      };

      expect(__testables.pickTikTokThumbnailUrl(item)).toBe(
        "https://cdn.example.com/cover-from-flat.jpg",
      );
    });

    it("falls back to nested videoMeta.coverUrl when present", () => {
      const item: Record<string, unknown> = {
        videoMeta: { coverUrl: "https://cdn.example.com/cover-from-nested.jpg" },
      };

      expect(__testables.pickTikTokThumbnailUrl(item)).toBe(
        "https://cdn.example.com/cover-from-nested.jpg",
      );
    });

    it("falls back to coverUrl if no videoMeta cover exists", () => {
      const item: Record<string, unknown> = {
        coverUrl: "https://cdn.example.com/cover-root.jpg",
      };

      expect(__testables.pickTikTokThumbnailUrl(item)).toBe(
        "https://cdn.example.com/cover-root.jpg",
      );
    });
  });

  describe("pickTikTokVideoUrl", () => {
    it("prefers videoUrl over webVideoUrl", () => {
      const item: Record<string, unknown> = {
        videoUrl: "https://cdn.example.com/video.mp4",
        webVideoUrl: "https://www.tiktok.com/@u/video/123",
      };

      expect(__testables.pickTikTokVideoUrl(item)).toBe(
        "https://cdn.example.com/video.mp4",
      );
    });

    it("falls back to webVideoUrl when videoUrl is missing", () => {
      const item: Record<string, unknown> = {
        webVideoUrl: "https://www.tiktok.com/@u/video/123",
      };

      expect(__testables.pickTikTokVideoUrl(item)).toBe(
        "https://www.tiktok.com/@u/video/123",
      );
    });
  });
});

