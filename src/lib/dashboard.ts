export interface RecentItem {
  id: string;
  sourceUrl: string;
  category: string;
  status: string;
  createdAt: string;
}

export interface DashboardStats {
  total: number;
  /** Counts of items with status "done", keyed by category. */
  byCategory: Record<string, number>;
  failedCount: number;
  processingCount: number;
  /** First 5 items from the input (caller should pass sorted desc by time). */
  recentItems: RecentItem[];
}

export function computeStats(
  items: Array<{
    _id: string;
    sourceUrl: string;
    category: string;
    status: string;
    _creationTime: number;
  }>
): DashboardStats {
  const byCategory: Record<string, number> = {};
  let failedCount = 0;
  let processingCount = 0;

  for (const item of items) {
    if (item.status === "done") {
      byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
    }
    if (item.status === "failed") failedCount++;
    if (item.status === "processing" || item.status === "pending") processingCount++;
  }

  return {
    total: items.length,
    byCategory,
    failedCount,
    processingCount,
    recentItems: items.slice(0, 5).map((i) => ({
      id: i._id,
      sourceUrl: i.sourceUrl,
      category: i.category,
      status: i.status,
      createdAt: new Date(i._creationTime).toISOString(),
    })),
  };
}
