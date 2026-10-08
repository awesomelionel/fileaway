import {
  BUILT_IN_REUSE_CATEGORY_SLUGS,
  PER_USER_REUSE_FIELDS,
  PROCESSED_RESULT_REUSE_MAX_AGE_MS,
  REUSE_FALLBACK_CATEGORY,
  copyPublicProcessedFields,
  resolveReuseCategory,
  selectReusableProcessedItem,
  type ReuseCandidate,
} from "@/lib/processedReuse";

const NOW = 1_800_000_000_000;

function doneItem(overrides: Partial<ReuseCandidate> = {}): ReuseCandidate {
  return {
    status: "done",
    _creationTime: NOW - 60_000,
    processedAt: NOW - 60_000,
    platform: "tiktok",
    category: "recipe",
    rawContent: { caption: "boil noodles", creator: "public-chef" },
    extractedData: { dish_name: "Ramen", ingredients: ["noodles"] },
    thumbnailR2Key: "thumbs/shared",
    thumbnailStorageId: "storage_public",
    actionTaken: "Export ingredient list",
    userId: "user_owner",
    archived: true,
    userCorrection: "private note: skip the chili",
    failureReason: "old failure that should stay private",
    searchText: "private note: skip the chili ramen",
    sourceUrl: "https://tiktok.com/@chef/video/1",
    ...overrides,
  };
}

describe("selectReusableProcessedItem", () => {
  it("reuses the freshest successful item inside the window", () => {
    const older = doneItem({ processedAt: NOW - 2 * 60_000, extractedData: { dish_name: "Older" } });
    const newer = doneItem({ processedAt: NOW - 30_000, extractedData: { dish_name: "Newer" } });
    const picked = selectReusableProcessedItem([older, newer], NOW);
    expect(picked?.extractedData).toEqual({ dish_name: "Newer" });
  });

  it("misses when nothing has completed", () => {
    expect(selectReusableProcessedItem([], NOW)).toBeNull();
    expect(
      selectReusableProcessedItem(
        [
          doneItem({ status: "pending", processedAt: undefined }),
          doneItem({ status: "processing", processedAt: undefined }),
        ],
        NOW,
      ),
    ).toBeNull();
  });

  it("does not reuse a failed prior item, even when it is newer than a stale success", () => {
    const staleSuccess = doneItem({
      processedAt: NOW - PROCESSED_RESULT_REUSE_MAX_AGE_MS - 1,
      extractedData: { dish_name: "Stale" },
    });
    const failed = doneItem({
      status: "failed",
      processedAt: NOW - 1_000,
      failureReason: "scrape failed",
    });
    expect(selectReusableProcessedItem([failed, staleSuccess], NOW)).toBeNull();
  });

  it("ignores an in-flight save when an older success is still fresh", () => {
    const success = doneItem({ processedAt: NOW - 5_000, extractedData: { dish_name: "Ready" } });
    const pending = doneItem({ status: "pending", processedAt: undefined, _creationTime: NOW });
    expect(selectReusableProcessedItem([pending, success], NOW)?.extractedData).toEqual({
      dish_name: "Ready",
    });
  });

  it("misses a success older than the tunable window and keeps one exactly at the boundary", () => {
    const stale = doneItem({ processedAt: NOW - PROCESSED_RESULT_REUSE_MAX_AGE_MS - 1 });
    const boundary = doneItem({
      processedAt: NOW - PROCESSED_RESULT_REUSE_MAX_AGE_MS,
      extractedData: { dish_name: "Boundary" },
    });
    expect(selectReusableProcessedItem([stale], NOW)).toBeNull();
    expect(selectReusableProcessedItem([boundary], NOW)?.extractedData).toEqual({
      dish_name: "Boundary",
    });
  });

  it("falls back to creation time when processedAt is missing", () => {
    const legacy = doneItem({
      processedAt: undefined,
      _creationTime: NOW - 60_000,
    });
    expect(selectReusableProcessedItem([legacy], NOW)).toBe(legacy);
    const agedOut = doneItem({
      processedAt: undefined,
      _creationTime: NOW - PROCESSED_RESULT_REUSE_MAX_AGE_MS - 1,
    });
    expect(selectReusableProcessedItem([agedOut], NOW)).toBeNull();
  });
});

describe("copyPublicProcessedFields", () => {
  it("copies content fields and drops per-user state", () => {
    const source = doneItem();
    const copy = copyPublicProcessedFields(source, { catalogHasSlug: true });

    expect(copy).toEqual({
      status: "done",
      platform: "tiktok",
      category: "recipe",
      processedAt: source.processedAt,
      rawContent: { caption: "boil noodles", creator: "public-chef" },
      extractedData: { dish_name: "Ramen", ingredients: ["noodles"] },
      thumbnailR2Key: "thumbs/shared",
      thumbnailStorageId: "storage_public",
      actionTaken: "Export ingredient list",
    });

    for (const field of PER_USER_REUSE_FIELDS) {
      expect(copy).not.toHaveProperty(field);
    }
    expect(copy).not.toHaveProperty("sourceUrl");
    expect(JSON.stringify(copy)).not.toContain("user_owner");
    expect(JSON.stringify(copy)).not.toContain("private note");
    expect(JSON.stringify(copy)).not.toContain("old failure");
  });

  it("deep-copies extracted data and raw content so the source can change independently", () => {
    const source = doneItem();
    const copy = copyPublicProcessedFields(source, { catalogHasSlug: true });
    (source.extractedData as { dish_name: string }).dish_name = "Changed";
    (source.rawContent as { caption: string }).caption = "changed caption";
    source.userCorrection = "another private note";

    expect(copy.extractedData).toEqual({ dish_name: "Ramen", ingredients: ["noodles"] });
    expect(copy.rawContent).toEqual({ caption: "boil noodles", creator: "public-chef" });
    expect(JSON.stringify(copy)).not.toContain("another private note");
  });

  it("keeps the original processedAt so a copy does not extend freshness", () => {
    const source = doneItem({ processedAt: NOW - 10 * 24 * 60 * 60 * 1000 });
    const copy = copyPublicProcessedFields(source, { catalogHasSlug: true });
    expect(copy.processedAt).toBe(source.processedAt);
    expect(selectReusableProcessedItem([{ ...source, ...copy, _creationTime: NOW }], NOW)).not.toBeNull();
  });
});

describe("resolveReuseCategory", () => {
  it("keeps a custom slug only while the catalog still has it", () => {
    expect(resolveReuseCategory("date-night", true)).toBe("date-night");
    expect(resolveReuseCategory("date-night", false)).toBe(REUSE_FALLBACK_CATEGORY);
  });

  it("keeps built-in slugs when the catalog has not been seeded", () => {
    for (const slug of BUILT_IN_REUSE_CATEGORY_SLUGS) {
      expect(resolveReuseCategory(slug, false)).toBe(slug);
    }
  });

  it("falls back on the copied item when the custom category is gone", () => {
    const copy = copyPublicProcessedFields(doneItem({ category: "date-night" }), {
      catalogHasSlug: false,
    });
    expect(copy.category).toBe("other");
    expect(copy.extractedData).toEqual({ dish_name: "Ramen", ingredients: ["noodles"] });
  });
});
