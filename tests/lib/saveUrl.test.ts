import {
  formatSaveRateLimit,
  messageFromSaveError,
  platformFromHostname,
  prepareSaveUrl,
  reusableSavedItem,
  SAVE_URL_MESSAGES,
} from "@/lib/saveUrl";

describe("prepareSaveUrl", () => {
  it("canonicalizes bare TikTok, Instagram, and X links", () => {
    expect(prepareSaveUrl("tiktok.com/@user/video/123")).toEqual({
      ok: true,
      url: "https://tiktok.com/@user/video/123",
      platform: "tiktok",
    });
    expect(prepareSaveUrl("www.instagram.com/reel/ABC123/")).toEqual({
      ok: true,
      url: "https://www.instagram.com/reel/ABC123/",
      platform: "instagram",
    });
    expect(prepareSaveUrl("x.com/user/status/123456")).toEqual({
      ok: true,
      url: "https://x.com/user/status/123456",
      platform: "twitter",
    });
    expect(prepareSaveUrl("https://twitter.com/user/status/99")).toEqual({
      ok: true,
      url: "https://twitter.com/user/status/99",
      platform: "twitter",
    });
  });

  it("accepts scrape short-link hosts", () => {
    expect(prepareSaveUrl("https://vm.tiktok.com/ZMRkxxxxxxx/")).toMatchObject({
      ok: true,
      platform: "tiktok",
    });
    expect(prepareSaveUrl("https://mobile.twitter.com/user/status/5")).toMatchObject({
      ok: true,
      platform: "twitter",
    });
  });

  it("keeps http when the paste already has it, and is stable when reapplied", () => {
    const once = prepareSaveUrl("http://instagram.com/p/abc");
    expect(once).toMatchObject({ ok: true, url: "http://instagram.com/p/abc" });
    if (!once.ok) throw new Error("expected ok");
    expect(prepareSaveUrl(once.url)).toEqual(once);
  });

  it("lowercases the host and drops the default port", () => {
    expect(prepareSaveUrl("HTTPS://TikTok.com:443/@user/video/1")).toEqual({
      ok: true,
      url: "https://tiktok.com/@user/video/1",
      platform: "tiktok",
    });
  });

  it("rejects YouTube without treating it as a generic bad URL", () => {
    expect(prepareSaveUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      ok: false,
      message: SAVE_URL_MESSAGES.youtube,
      platform: "youtube",
    });
    expect(prepareSaveUrl("youtu.be/dQw4w9WgXcQ")).toMatchObject({
      ok: false,
      platform: "youtube",
    });
    expect(prepareSaveUrl("https://m.youtube.com/watch?v=abc")).toMatchObject({
      ok: false,
      platform: "youtube",
    });
  });

  it("rejects unsupported sites and lookalike hosts", () => {
    expect(prepareSaveUrl("https://example.com/blog")).toEqual({
      ok: false,
      message: SAVE_URL_MESSAGES.unsupported,
      platform: "other",
    });
    expect(prepareSaveUrl("https://nottiktok.com/@user/video/1")).toMatchObject({
      ok: false,
      platform: "other",
    });
    expect(prepareSaveUrl("https://evil.com/tiktok.com/@user/video/1")).toMatchObject({
      ok: false,
      platform: "other",
    });
    expect(prepareSaveUrl("https://tiktok.com.evil.com/@user/video/1")).toMatchObject({
      ok: false,
      platform: "other",
    });
    expect(prepareSaveUrl("https://box.com/file")).toMatchObject({
      ok: false,
      platform: "other",
    });
  });

  it("rejects non-URLs, other protocols, and credentialed URLs", () => {
    expect(prepareSaveUrl("pasta recipes")).toMatchObject({
      ok: false,
      message: SAVE_URL_MESSAGES.invalid,
      platform: null,
    });
    expect(prepareSaveUrl("   ")).toMatchObject({ ok: false, platform: null });
    expect(prepareSaveUrl("ftp://tiktok.com/video")).toMatchObject({
      ok: false,
      message: SAVE_URL_MESSAGES.invalid,
    });
    expect(prepareSaveUrl("javascript:alert(1)")).toMatchObject({ ok: false, platform: null });
    expect(prepareSaveUrl("https://user:pass@tiktok.com/@user/video/1")).toEqual({
      ok: false,
      message: SAVE_URL_MESSAGES.invalid,
      platform: null,
    });
  });
});

describe("platformFromHostname", () => {
  it("does not treat a suffix embedded in another label as a match", () => {
    expect(platformFromHostname("notx.com")).toBe("other");
    expect(platformFromHostname("x.com")).toBe("twitter");
    expect(platformFromHostname("www.x.com")).toBe("twitter");
  });
});

describe("reusableSavedItem", () => {
  it("skips archived copies and keeps the first active match", () => {
    const active = { id: "new", archived: false };
    const archived = { id: "old", archived: true };
    const legacy = { id: "legacy" };
    expect(reusableSavedItem([archived, active])).toEqual(active);
    expect(reusableSavedItem([legacy])).toEqual(legacy);
    expect(reusableSavedItem([archived])).toBeNull();
  });
});

describe("formatSaveRateLimit", () => {
  it("describes the wait in seconds or minutes", () => {
    expect(formatSaveRateLimit(1000)).toBe(
      "You're saving links too quickly. Try again in 1 second.",
    );
    expect(formatSaveRateLimit(45_100)).toBe(
      "You're saving links too quickly. Try again in 46 seconds.",
    );
    expect(formatSaveRateLimit(120_000)).toBe(
      "You're saving links too quickly. Try again in 2 minutes.",
    );
  });
});

describe("messageFromSaveError", () => {
  it("reads a string ConvexError data payload", () => {
    expect(
      messageFromSaveError({
        data: SAVE_URL_MESSAGES.unsupported,
        message: "[CONVEX M(items:save)] Uncaught ConvexError: ignored",
      }),
    ).toBe(SAVE_URL_MESSAGES.unsupported);
  });

  it("reads a message field and unwraps plain Convex server errors", () => {
    expect(messageFromSaveError({ data: { message: "Custom" } })).toBe("Custom");
    expect(
      messageFromSaveError(
        new Error("[CONVEX M(items:save)] Uncaught Error: Not authenticated\n    at handler"),
      ),
    ).toBe("Not authenticated");
  });

  it("falls back when the error has no usable message", () => {
    expect(messageFromSaveError(null)).toBe("Couldn't save that link. Try again.");
  });
});
