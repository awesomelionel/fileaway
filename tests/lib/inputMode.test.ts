import { isLikelyUrl, normalizeUrl } from "@/lib/inputMode";

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
