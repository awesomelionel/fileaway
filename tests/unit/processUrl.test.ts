import { EXTRACTION_SCHEMAS, WRAPPER_INSTRUCTIONS } from "../../convex/processUrl";

describe("Extraction prompt schemas", () => {
  describe("how-to category", () => {
    it("contains title field (not topic)", () => {
      expect(EXTRACTION_SCHEMAS["how-to"]).toContain('"title"');
      expect(EXTRACTION_SCHEMAS["how-to"]).not.toContain('"topic"');
    });

    it("contains summary field", () => {
      expect(EXTRACTION_SCHEMAS["how-to"]).toContain('"summary"');
    });
  });

  describe("video-analysis category", () => {
    it("contains title field", () => {
      expect(EXTRACTION_SCHEMAS["video-analysis"]).toContain('"title"');
    });

    it("contains summary and key_points fields", () => {
      expect(EXTRACTION_SCHEMAS["video-analysis"]).toContain('"summary"');
      expect(EXTRACTION_SCHEMAS["video-analysis"]).toContain('"key_points"');
    });
  });

  describe("other category", () => {
    it("contains title field", () => {
      expect(EXTRACTION_SCHEMAS["other"]).toContain('"title"');
    });

    it("contains summary field", () => {
      expect(EXTRACTION_SCHEMAS["other"]).toContain('"summary"');
    });
  });

  describe("buildExtractionPrompt wrapper", () => {
    it("includes social-media inference guidance", () => {
      // We need to test the wrapper text — export a helper or test via a dummy call
      // Since buildExtractionPrompt is not exported, export WRAPPER_INSTRUCTIONS instead
      expect(WRAPPER_INSTRUCTIONS).toContain("infer");
      expect(WRAPPER_INSTRUCTIONS).toContain("hashtags");
      expect(WRAPPER_INSTRUCTIONS).toContain("null");
    });
  });

  describe("food category", () => {
    it("contains inference hints for address", () => {
      expect(EXTRACTION_SCHEMAS["food"]).toContain("infer");
    });
    it("contains dishes_mentioned field", () => {
      expect(EXTRACTION_SCHEMAS["food"]).toContain('"dishes_mentioned"');
    });
  });

  describe("recipe category", () => {
    it("contains inference hints", () => {
      expect(EXTRACTION_SCHEMAS["recipe"]).toContain("infer");
    });
    it("contains steps field as array", () => {
      expect(EXTRACTION_SCHEMAS["recipe"]).toContain('"steps"');
    });
  });

  describe("fitness category", () => {
    it("contains inference hints", () => {
      expect(EXTRACTION_SCHEMAS["fitness"]).toContain("infer");
    });
    it("contains exercises field", () => {
      expect(EXTRACTION_SCHEMAS["fitness"]).toContain('"exercises"');
    });
  });
});
