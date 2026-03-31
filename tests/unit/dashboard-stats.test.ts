import { computeStats } from "@/lib/dashboard";

function makeItem(overrides: {
  _id?: string;
  sourceUrl?: string;
  category?: string;
  status?: string;
  _creationTime?: number;
}) {
  return {
    _id: "id1",
    sourceUrl: "https://tiktok.com/video/1",
    category: "food",
    status: "done",
    _creationTime: 1_000_000,
    ...overrides,
  };
}

describe("computeStats()", () => {
  it("returns zero counts for an empty array", () => {
    const result = computeStats([]);
    expect(result.total).toBe(0);
    expect(result.byCategory).toEqual({});
    expect(result.failedCount).toBe(0);
    expect(result.processingCount).toBe(0);
    expect(result.recentItems).toHaveLength(0);
  });

  it("counts done items by category", () => {
    const items = [
      makeItem({ _id: "1", category: "food",   status: "done" }),
      makeItem({ _id: "2", category: "food",   status: "done" }),
      makeItem({ _id: "3", category: "recipe", status: "done" }),
    ];
    const result = computeStats(items);
    expect(result.total).toBe(3);
    expect(result.byCategory).toEqual({ food: 2, recipe: 1 });
  });

  it("does NOT count pending/processing/failed items in byCategory", () => {
    const items = [
      makeItem({ _id: "1", category: "food", status: "pending" }),
      makeItem({ _id: "2", category: "food", status: "processing" }),
      makeItem({ _id: "3", category: "food", status: "failed" }),
    ];
    const result = computeStats(items);
    expect(result.byCategory).toEqual({});
  });

  it("counts failed items in failedCount", () => {
    const items = [
      makeItem({ _id: "1", status: "failed" }),
      makeItem({ _id: "2", status: "failed" }),
      makeItem({ _id: "3", status: "done" }),
    ];
    const result = computeStats(items);
    expect(result.failedCount).toBe(2);
  });

  it("counts pending and processing together in processingCount", () => {
    const items = [
      makeItem({ _id: "1", status: "pending" }),
      makeItem({ _id: "2", status: "processing" }),
      makeItem({ _id: "3", status: "done" }),
    ];
    const result = computeStats(items);
    expect(result.processingCount).toBe(2);
  });

  it("returns up to 5 items in recentItems regardless of input size", () => {
    const items = Array.from({ length: 8 }, (_, i) =>
      makeItem({ _id: `id${i}`, _creationTime: i * 1000 })
    );
    const result = computeStats(items);
    expect(result.recentItems).toHaveLength(5);
  });

  it("formats createdAt as ISO string", () => {
    const ts = new Date("2026-01-15T10:00:00.000Z").getTime();
    const items = [makeItem({ _id: "1", _creationTime: ts })];
    const result = computeStats(items);
    expect(result.recentItems[0].createdAt).toBe("2026-01-15T10:00:00.000Z");
  });

  it("recentItems preserves the input order (most recent first)", () => {
    const items = [
      makeItem({ _id: "newest", _creationTime: 3000 }),
      makeItem({ _id: "middle", _creationTime: 2000 }),
      makeItem({ _id: "oldest", _creationTime: 1000 }),
    ];
    const result = computeStats(items);
    expect(result.recentItems[0].id).toBe("newest");
    expect(result.recentItems[2].id).toBe("oldest");
  });
});
