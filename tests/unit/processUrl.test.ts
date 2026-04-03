import { WRAPPER_INSTRUCTIONS } from "../../convex/processUrl";

describe("Extraction prompt schemas", () => {
  describe("buildExtractionPrompt wrapper", () => {
    it("includes social-media inference guidance", () => {
      expect(WRAPPER_INSTRUCTIONS).toContain("infer");
      expect(WRAPPER_INSTRUCTIONS).toContain("hashtags");
      expect(WRAPPER_INSTRUCTIONS).toContain("null");
    });
  });
});
