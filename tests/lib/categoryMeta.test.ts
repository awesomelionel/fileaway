import {
  BUILT_IN_CATEGORY_SLUGS,
  CUSTOM_CATEGORY_PALETTE,
  categoryAccentStyle,
  dashboardCategorySlugs,
  getCategoryMeta,
  normalizeCategoryColor,
} from "@/lib/categoryMeta";

function channelAverage(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return (r + g + b) / 3;
}

describe("normalizeCategoryColor", () => {
  it("accepts hex colors and normalizes them to #rrggbb", () => {
    expect(normalizeCategoryColor("#A83253")).toBe("#a83253");
    expect(normalizeCategoryColor("  #abc ")).toBe("#aabbcc");
    expect(normalizeCategoryColor("#abcd")).toBe("#aabbcc");
    expect(normalizeCategoryColor("#a8325380")).toBe("#a83253");
  });

  it("rejects missing and invalid values", () => {
    for (const bad of [
      null,
      undefined,
      "",
      "   ",
      "red",
      "rgb(168, 50, 83)",
      "var(--fa-cat-food)",
      "#gg0000",
      "#12",
      "#12345",
      "#a83253;color:red",
      "url(#a83253)",
      "#a83253</style>",
    ]) {
      expect(normalizeCategoryColor(bad)).toBeNull();
    }
  });
});

describe("getCategoryMeta", () => {
  it("keeps built-in categories on design tokens", () => {
    expect(getCategoryMeta("food")).toMatchObject({
      label: "Food",
      builtIn: true,
      color: "var(--fa-cat-food)",
      background: "var(--fa-cat-food-soft)",
      colorDark: "var(--fa-cat-food)",
      backgroundDark: "var(--fa-cat-food-soft)",
    });
    expect(getCategoryMeta("video-analysis").color).toBe("var(--fa-cat-video)");
    expect(getCategoryMeta("travel").background).toBe("var(--fa-cat-travel-soft)");
    expect(getCategoryMeta("  How-To  ").label).toBe("How-To");
  });

  it("ignores a color override for built-in slugs", () => {
    expect(getCategoryMeta("recipe", { color: "#ff00aa" }).color).toBe("var(--fa-cat-recipe)");
  });

  it("uses a valid configured color for custom categories", () => {
    const meta = getCategoryMeta("books", { color: " #A83253 " });
    expect(meta.builtIn).toBe(false);
    expect(meta.label).toBe("Books");
    expect(meta.color).toBe("#a83253");
    expect(meta.background).toBe("color-mix(in srgb, #a83253 18%, transparent)");
    expect(meta.colorDark).toMatch(/^#[0-9a-f]{6}$/);
    expect(channelAverage(meta.colorDark)).toBeGreaterThan(channelAverage(meta.color));
    expect(meta.backgroundDark).toBe(`color-mix(in srgb, ${meta.colorDark} 32%, transparent)`);
  });

  it("falls back to the palette when the color is missing or invalid", () => {
    const fallback = getCategoryMeta("books", 0);
    expect(fallback.color).toBe(CUSTOM_CATEGORY_PALETTE[0]);
    expect(getCategoryMeta("books", { color: "not-a-color", index: 0 }).color).toBe(
      CUSTOM_CATEGORY_PALETTE[0],
    );
    expect(getCategoryMeta("books", { color: null, index: 2 }).color).toBe(
      CUSTOM_CATEGORY_PALETTE[2],
    );
  });

  it("wraps the palette index and hashes when index is omitted", () => {
    expect(getCategoryMeta("field-notes", 1).color).toBe(CUSTOM_CATEGORY_PALETTE[1]);
    expect(getCategoryMeta("field-notes", CUSTOM_CATEGORY_PALETTE.length).color).toBe(
      CUSTOM_CATEGORY_PALETTE[0],
    );
    const hashed = getCategoryMeta("field-notes");
    expect(getCategoryMeta("field-notes", -1).color).toBe(hashed.color);
    expect(getCategoryMeta("field-notes", Number.NaN).color).toBe(hashed.color);
    expect(hashed.color).not.toBe(getCategoryMeta("city-guide").color);
  });

  it("labels a blank custom slug as Other and never builds Tailwind classes", () => {
    const meta = getCategoryMeta("   ", { color: "#a83253;background:url(https://evil.test)" });
    expect(meta.label).toBe("Other");
    expect(meta.color).toMatch(/^#[0-9a-f]{6}$/);
    const serialized = JSON.stringify(meta);
    expect(serialized).not.toMatch(/border-l-\[|bg-\[|text-\[|url\(|;/);
  });

  it("keeps palette colors as-is in light mode and lightens them for dark mode", () => {
    for (const hex of CUSTOM_CATEGORY_PALETTE) {
      const meta = getCategoryMeta("custom", { color: hex });
      expect(meta.color).toBe(hex);
      expect(channelAverage(meta.colorDark)).toBeGreaterThan(channelAverage(hex));
    }
  });

  it("darkens a near-white configured color so it stays readable on paper", () => {
    const meta = getCategoryMeta("pastel", { color: "#ffff99" });
    expect(meta.color).not.toBe("#ffff99");
    expect(channelAverage(meta.color)).toBeLessThan(channelAverage("#ffff99"));
    expect(meta.colorDark).toBe("#ffff99");
  });
});

describe("categoryAccentStyle", () => {
  it("points built-ins at tokens and leaves dark overrides to those tokens", () => {
    expect(categoryAccentStyle(getCategoryMeta("fitness"))).toEqual({
      "--cat-accent": "var(--fa-cat-fitness)",
      "--cat-accent-soft": "var(--fa-cat-fitness-soft)",
    });
  });

  it("sets light and dark variables for a custom color", () => {
    const style = categoryAccentStyle(getCategoryMeta("books", { color: "#a83253" }));
    expect(style["--cat-accent"]).toBe("#a83253");
    expect(style["--cat-accent-soft"]).toContain("#a83253");
    expect(style["--cat-accent-dark"]).toMatch(/^#[0-9a-f]{6}$/);
    expect(style["--cat-accent-soft-dark"]).toContain(style["--cat-accent-dark"]);
  });
});

describe("dashboardCategorySlugs", () => {
  it("includes travel and custom counts when the catalog has not loaded", () => {
    expect(dashboardCategorySlugs({ books: 2, food: 1 })).toEqual([
      ...BUILT_IN_CATEGORY_SLUGS,
      "books",
    ]);
    expect(dashboardCategorySlugs({})).toEqual(BUILT_IN_CATEGORY_SLUGS);
    expect(BUILT_IN_CATEGORY_SLUGS).toContain("travel");
  });

  it("uses catalog order and appends leftover stat slugs", () => {
    expect(
      dashboardCategorySlugs(
        { books: 1, archivedIdea: 4, food: 2 },
        [
          { slug: "food" },
          { slug: "travel" },
          { slug: "books" },
          { slug: "books" },
          { slug: "  " },
        ],
      ),
    ).toEqual([
      "food",
      "travel",
      "books",
      "recipe",
      "fitness",
      "how-to",
      "video-analysis",
      "other",
      "archivedIdea",
    ]);
  });

  it("does not duplicate built-ins already in the catalog", () => {
    const rows = [
      ...BUILT_IN_CATEGORY_SLUGS.map((slug) => ({ slug })),
      { slug: "books" },
    ];
    expect(dashboardCategorySlugs({ books: 3 }, rows)).toEqual([
      ...BUILT_IN_CATEGORY_SLUGS,
      "books",
    ]);
  });

  it("falls back when the catalog is empty", () => {
    expect(dashboardCategorySlugs({ travel: 1 }, [])).toEqual(BUILT_IN_CATEGORY_SLUGS);
  });
});
