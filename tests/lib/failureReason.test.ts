import {
  sanitizeFailureReason,
  userFacingFailureReason,
} from "../../src/lib/failureReason";

describe("userFacingFailureReason", () => {
  it("describes a scrape failure without echoing the provider error", () => {
    const reason = userFacingFailureReason(
      new Error("Actor run failed: status 500 body {token:secret}"),
      "scrape",
    );
    expect(reason).toMatch(/could not load this post/i);
    expect(reason).not.toMatch(/secret|token|500/i);
  });

  it("describes classify and extract failures by stage", () => {
    expect(userFacingFailureReason(new Error("model blew up"), "categorize")).toMatch(
      /classify/i,
    );
    expect(userFacingFailureReason(new Error("bad json"), "extract")).toMatch(
      /pull details/i,
    );
    expect(userFacingFailureReason(new Error("db patch failed"), "save")).toMatch(
      /finish saving/i,
    );
  });

  it("hides missing credentials and does not repeat env names", () => {
    for (const message of [
      "APIFY_API_TOKEN is not configured",
      "X_BEARER_TOKEN is not configured",
      "GEMINI_API_KEY is not configured",
      "Request failed: Bearer ya29.super-secret",
    ]) {
      const reason = userFacingFailureReason(new Error(message), "scrape");
      expect(reason).toBe("Processing is temporarily unavailable. Try again later.");
      expect(reason).not.toMatch(/APIFY|GEMINI|BEARER|ya29|configured/i);
    }
  });

  it("maps rate limits and network failures to safe copy", () => {
    expect(
      userFacingFailureReason(new Error("429 Too Many Requests: quota exceeded"), "extract"),
    ).toMatch(/busy/i);
    expect(userFacingFailureReason(new Error("fetch failed"), "scrape")).toMatch(
      /reach the source/i,
    );
    expect(userFacingFailureReason(new Error("ETIMEDOUT"), "categorize")).toMatch(
      /analysis service/i,
    );
  });

  it("handles non-Error throws", () => {
    expect(userFacingFailureReason("socket hang up", "extract")).toMatch(/analysis service/i);
  });
});

describe("sanitizeFailureReason", () => {
  it("keeps a short user-safe message", () => {
    expect(sanitizeFailureReason("Could not load this post.")).toBe(
      "Could not load this post.",
    );
  });

  it("replaces secrets, stacks, and empty input with the fallback", () => {
    const fallback = "Could not extract content from this link.";
    expect(sanitizeFailureReason(undefined)).toBe(fallback);
    expect(sanitizeFailureReason("   ")).toBe(fallback);
    expect(sanitizeFailureReason("GEMINI_API_KEY leaked")).toBe(fallback);
    expect(sanitizeFailureReason("Error: something\n    at processItem (processUrl.ts:10)")).toBe(
      fallback,
    );
    expect(sanitizeFailureReason("x".repeat(241))).toBe(fallback);
  });
});
