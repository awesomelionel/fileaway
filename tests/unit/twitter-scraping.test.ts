import { mapApifyTweetToScrapeResult } from "../../convex/processUrl";
import { SAMPLE_APIFY_TWEETS } from "../fixtures/sample-urls";

describe("mapApifyTweetToScrapeResult", () => {
  describe("text mapping", () => {
    it("maps tweet text to title and description", () => {
      const result = mapApifyTweetToScrapeResult(
        SAMPLE_APIFY_TWEETS.textOnly,
        "https://x.com/leopardracer/status/1001",
      );
      expect(result.platform).toBe("twitter");
      expect(result.title).toBe(
        "Just shipped a new feature for Ethereum devs 🚀 #ethereum #dev",
      );
      expect(result.description).toBe(result.title);
    });

    it("returns undefined title and description for empty tweet text", () => {
      const result = mapApifyTweetToScrapeResult(
        SAMPLE_APIFY_TWEETS.emptyText,
        "https://x.com/silentbob/status/1004",
      );
      expect(result.title).toBeUndefined();
      expect(result.description).toBeUndefined();
    });
  });

  describe("author mapping", () => {
    it("maps author name and handle", () => {
      const result = mapApifyTweetToScrapeResult(
        SAMPLE_APIFY_TWEETS.textOnly,
        "https://x.com/leopardracer/status/1001",
      );
      expect(result.authorName).toBe("Leopard Racer");
      expect(result.authorHandle).toBe("leopardracer");
    });
  });

  describe("hashtag mapping", () => {
    it("strips leading # from hashtags", () => {
      const result = mapApifyTweetToScrapeResult(
        SAMPLE_APIFY_TWEETS.hashtagsWithHash,
        "https://x.com/tagger/status/1005",
      );
      expect(result.hashtags).toEqual(["web3", "zkp", "noprefix"]);
    });

    it("returns undefined hashtags when array is empty", () => {
      const result = mapApifyTweetToScrapeResult(
        SAMPLE_APIFY_TWEETS.withPhoto,
        "https://x.com/hikerjane/status/1002",
      );
      expect(result.hashtags).toBeUndefined();
    });
  });

  describe("thumbnail mapping", () => {
    it("uses photo url as thumbnailUrl for photo tweets", () => {
      const result = mapApifyTweetToScrapeResult(
        SAMPLE_APIFY_TWEETS.withPhoto,
        "https://x.com/hikerjane/status/1002",
      );
      expect(result.thumbnailUrl).toBe(
        "https://pbs.twimg.com/media/photo123.jpg",
      );
    });

    it("uses video thumbnailUrl (poster frame) for video tweets", () => {
      const result = mapApifyTweetToScrapeResult(
        SAMPLE_APIFY_TWEETS.withVideo,
        "https://x.com/trickmaster/status/1003",
      );
      expect(result.thumbnailUrl).toBe(
        "https://pbs.twimg.com/ext_tw_video_thumb/1003/pu/img/thumb.jpg",
      );
    });

    it("returns undefined thumbnailUrl when no media", () => {
      const result = mapApifyTweetToScrapeResult(
        SAMPLE_APIFY_TWEETS.textOnly,
        "https://x.com/leopardracer/status/1001",
      );
      expect(result.thumbnailUrl).toBeUndefined();
    });
  });

  describe("engagement stats", () => {
    it("maps likeCount and viewCount", () => {
      const result = mapApifyTweetToScrapeResult(
        SAMPLE_APIFY_TWEETS.textOnly,
        "https://x.com/leopardracer/status/1001",
      );
      expect(result.likeCount).toBe(100);
      expect(result.viewCount).toBe(1000);
    });

    it("stores retweetCount and replyCount in metadata", () => {
      const result = mapApifyTweetToScrapeResult(
        SAMPLE_APIFY_TWEETS.textOnly,
        "https://x.com/leopardracer/status/1001",
      );
      expect((result.metadata as Record<string, unknown>).retweetCount).toBe(20);
      expect((result.metadata as Record<string, unknown>).replyCount).toBe(5);
    });
  });
});
