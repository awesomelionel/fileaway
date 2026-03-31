import { EXTRACTION_SCHEMAS } from "../../convex/processUrl";

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
});
