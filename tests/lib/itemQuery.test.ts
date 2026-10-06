import { hrefWithoutItemParam } from "../../src/lib/itemQuery";

describe("hrefWithoutItemParam", () => {
  it("drops item and keeps the rest of the feed query", () => {
    expect(
      hrefWithoutItemParam("/feed", "category=recipe&q=pasta&item=abc123"),
    ).toBe("/feed?category=recipe&q=pasta");
  });

  it("returns the pathname when item is the only param", () => {
    expect(hrefWithoutItemParam("/", "?item=abc123")).toBe("/");
  });

  it("leaves a URL without an item param unchanged", () => {
    expect(hrefWithoutItemParam("/", "view=archive")).toBe("/?view=archive");
  });
});
