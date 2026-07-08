import { isLikelyUrl, normalizeUrl, extractShareUrl } from "@/lib/inputMode";

describe("input mode helpers", () => {
  test("treats http and https URLs as saveable links", () => {
    expect(isLikelyUrl("https://www.tiktok.com/@user/video/123")).toBe(true);
    expect(isLikelyUrl("http://example.com/post")).toBe(true);
  });

  test("treats domain-like pasted values as saveable links", () => {
    expect(isLikelyUrl("instagram.com/p/abc123")).toBe(true);
    expect(normalizeUrl("instagram.com/p/abc123")).toBe("https://instagram.com/p/abc123");
  });

  test("treats ordinary search text as search input", () => {
    expect(isLikelyUrl("pasta recipes")).toBe(false);
    expect(isLikelyUrl("leg day workout")).toBe(false);
  });
});

describe("extractShareUrl", () => {
  test("prefers webUrl", () => {
    expect(
      extractShareUrl({ webUrl: "https://www.tiktok.com/@chef/video/7", text: "check this" }),
    ).toBe("https://www.tiktok.com/@chef/video/7");
  });
  test("falls back to first URL inside shared text", () => {
    expect(
      extractShareUrl({ text: "look! https://vt.tiktok.com/ZS8xyz/ so good" }),
    ).toBe("https://vt.tiktok.com/ZS8xyz/");
  });
  test("normalizes bare domains", () => {
    expect(extractShareUrl({ text: "tiktok.com/@a/video/1" })).toBe(
      "https://tiktok.com/@a/video/1",
    );
  });
  test("returns null for non-URLs", () => {
    expect(extractShareUrl({ text: "just some words" })).toBeNull();
    expect(extractShareUrl({})).toBeNull();
  });
});
