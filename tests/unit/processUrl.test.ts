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
});
