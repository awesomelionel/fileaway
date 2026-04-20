import { mapXApiTweetToScrapeResult, extractTweetId } from "../../convex/processUrl";
import { SAMPLE_X_API_TWEETS } from "../fixtures/sample-urls";

describe("extractTweetId", () => {
  it("extracts ID from x.com URL", () => {
    expect(extractTweetId("https://x.com/user/status/1234567890")).toBe("1234567890");
  });

  it("extracts ID from twitter.com URL", () => {
    expect(extractTweetId("https://twitter.com/user/status/9876543210")).toBe("9876543210");
  });

  it("returns null for non-tweet URL", () => {
    expect(extractTweetId("https://x.com/user")).toBeNull();
    expect(extractTweetId("https://example.com")).toBeNull();
  });
});

describe("mapXApiTweetToScrapeResult", () => {
  describe("text mapping", () => {
    it("maps tweet text to title and description", () => {
      const result = mapXApiTweetToScrapeResult(
        SAMPLE_X_API_TWEETS.textOnly,
        "https://x.com/leopardracer/status/1001",
      );
      expect(result.platform).toBe("twitter");
      expect(result.title).toBe(
        "Just shipped a new feature for Ethereum devs 🚀 #ethereum #dev",
      );
      expect(result.description).toBe(result.title);
    });

    it("returns undefined title and description for empty tweet text", () => {
      const result = mapXApiTweetToScrapeResult(
        SAMPLE_X_API_TWEETS.emptyText,
        "https://x.com/silentbob/status/1004",
      );
      expect(result.title).toBeUndefined();
      expect(result.description).toBeUndefined();
    });
  });

  describe("author mapping", () => {
    it("maps author name and handle from includes.users", () => {
      const result = mapXApiTweetToScrapeResult(
        SAMPLE_X_API_TWEETS.textOnly,
        "https://x.com/leopardracer/status/1001",
      );
      expect(result.authorName).toBe("Leopard Racer");
      expect(result.authorHandle).toBe("leopardracer");
    });
  });

  describe("hashtag mapping", () => {
    it("maps hashtags from entities.hashtags", () => {
      const result = mapXApiTweetToScrapeResult(
        SAMPLE_X_API_TWEETS.withHashtags,
        "https://x.com/tagger/status/1005",
      );
      expect(result.hashtags).toEqual(["web3", "zkp"]);
    });

    it("returns undefined hashtags when no entities", () => {
      const result = mapXApiTweetToScrapeResult(
        SAMPLE_X_API_TWEETS.withPhoto,
        "https://x.com/hikerjane/status/1002",
      );
      expect(result.hashtags).toBeUndefined();
    });
  });

  describe("thumbnail mapping", () => {
    it("uses photo url as thumbnailUrl for photo tweets", () => {
      const result = mapXApiTweetToScrapeResult(
        SAMPLE_X_API_TWEETS.withPhoto,
        "https://x.com/hikerjane/status/1002",
      );
      expect(result.thumbnailUrl).toBe(
        "https://pbs.twimg.com/media/photo123.jpg",
      );
    });

    it("uses preview_image_url (poster frame) for video tweets", () => {
      const result = mapXApiTweetToScrapeResult(
        SAMPLE_X_API_TWEETS.withVideo,
        "https://x.com/trickmaster/status/1003",
      );
      expect(result.thumbnailUrl).toBe(
        "https://pbs.twimg.com/ext_tw_video_thumb/1003/pu/img/thumb.jpg",
      );
    });

    it("returns undefined thumbnailUrl when no media", () => {
      const result = mapXApiTweetToScrapeResult(
        SAMPLE_X_API_TWEETS.textOnly,
        "https://x.com/leopardracer/status/1001",
      );
      expect(result.thumbnailUrl).toBeUndefined();
    });
  });

  describe("engagement stats", () => {
    it("maps like_count to likeCount and impression_count to viewCount", () => {
      const result = mapXApiTweetToScrapeResult(
        SAMPLE_X_API_TWEETS.textOnly,
        "https://x.com/leopardracer/status/1001",
      );
      expect(result.likeCount).toBe(100);
      expect(result.viewCount).toBe(1000);
    });

    it("stores retweetCount and replyCount in metadata", () => {
      const result = mapXApiTweetToScrapeResult(
        SAMPLE_X_API_TWEETS.textOnly,
        "https://x.com/leopardracer/status/1001",
      );
      expect((result.metadata as Record<string, unknown>).retweetCount).toBe(20);
      expect((result.metadata as Record<string, unknown>).replyCount).toBe(5);
    });
  });
});
