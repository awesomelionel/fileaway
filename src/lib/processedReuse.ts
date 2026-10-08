/**
 * Cross-user reuse of a successfully processed link.
 *
 * Design: copy public, content-derived fields off the freshest done
 * `savedItems` row for the canonical URL. A separate cache table would have
 * to be written from every success path (process, thumbnail upload, user
 * reprocess) and would still need the same privacy and staleness rules.
 * Copy-on-save leaves the scrape/Gemini output format unchanged.
 *
 * Pending, processing, and failed rows are never reused. If the only prior
 * saves are still in flight, the new save processes on its own — we do not
 * wait or attach to another user's job.
 *
 * Do not persist the source item id. That would link two users' libraries.
 */

/** Tune how long a successful extraction may be copied. Inclusive. */
export const PROCESSED_RESULT_REUSE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Newest done rows inspected per save. Bounded so a widely saved URL cannot
 * scan the whole table. An older row reprocessed outside this window is missed
 * and processed again.
 */
export const REUSE_CANDIDATE_LIMIT = 16;

/** Used when a custom category was deleted and is no longer in the catalog. */
export const REUSE_FALLBACK_CATEGORY = "other";

/**
 * Built-ins stay valid even when the categories table has not been seeded.
 * Custom slugs are valid only when the catalog still has that slug.
 */
export const BUILT_IN_REUSE_CATEGORY_SLUGS = [
  "food",
  "recipe",
  "fitness",
  "how-to",
  "video-analysis",
  "travel",
  "other",
] as const;

const REUSE_PLATFORMS = ["tiktok", "instagram", "youtube", "twitter", "other"] as const;

export type ReusePlatform = (typeof REUSE_PLATFORMS)[number];

export type ReuseItemStatus = "pending" | "processing" | "done" | "failed";

/** Fields a candidate may carry. Per-user fields are accepted so tests can prove they are dropped. */
export type ReuseCandidate = {
  status: ReuseItemStatus;
  _creationTime: number;
  processedAt?: number;
  platform: ReusePlatform;
  category: string;
  rawContent?: unknown;
  extractedData?: unknown;
  thumbnailStorageId?: string;
  thumbnailR2Key?: string;
  actionTaken?: string;
  userId?: string;
  archived?: boolean;
  userCorrection?: string;
  failureReason?: string;
  searchText?: string;
  sourceUrl?: string;
};

export type PublicProcessedCopy<TStorage extends string = string> = {
  status: "done";
  platform: ReusePlatform;
  category: string;
  /** Original processing time, so a copy does not refresh the freshness window. */
  processedAt: number;
  rawContent?: unknown;
  extractedData?: unknown;
  thumbnailStorageId?: TStorage;
  thumbnailR2Key?: string;
  actionTaken?: string;
};

/** Per-user state that must never be copied onto another user's item. */
export const PER_USER_REUSE_FIELDS = [
  "userId",
  "archived",
  "userCorrection",
  "failureReason",
  "searchText",
] as const;

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** When the row was successfully processed. Older rows have no `processedAt`. */
export function processedFreshnessMs(item: {
  processedAt?: number;
  _creationTime: number;
}): number {
  return item.processedAt ?? item._creationTime;
}

export function isProcessedResultFresh(
  processedAtMs: number,
  now: number,
  maxAgeMs: number = PROCESSED_RESULT_REUSE_MAX_AGE_MS,
): boolean {
  return now - processedAtMs <= maxAgeMs;
}

/**
 * Freshest successful row inside the staleness window.
 * Non-done rows are ignored, including a newer failure or an in-flight save.
 */
export function selectReusableProcessedItem<T extends ReuseCandidate>(
  candidates: readonly T[],
  now: number,
  maxAgeMs: number = PROCESSED_RESULT_REUSE_MAX_AGE_MS,
): T | null {
  let best: T | null = null;
  let bestAt = -Infinity;
  for (const item of candidates) {
    if (item.status !== "done") continue;
    const at = processedFreshnessMs(item);
    if (!isProcessedResultFresh(at, now, maxAgeMs)) continue;
    if (at > bestAt) {
      best = item;
      bestAt = at;
    }
  }
  return best;
}

export function resolveReuseCategory(slug: string, catalogHasSlug: boolean): string {
  if (catalogHasSlug) return slug;
  if ((BUILT_IN_REUSE_CATEGORY_SLUGS as readonly string[]).includes(slug)) return slug;
  return REUSE_FALLBACK_CATEGORY;
}

/**
 * Public content snapshot for a new user's item.
 * `actionTaken` is the pipeline's suggested action, not a record that someone
 * clicked it. Notes, archive state, ownership, failure text, and search text
 * (which embeds notes) are omitted.
 */
export function copyPublicProcessedFields<TStorage extends string = string>(
  source: ReuseCandidate & { thumbnailStorageId?: TStorage },
  options: { catalogHasSlug: boolean },
): PublicProcessedCopy<TStorage> {
  const copy: PublicProcessedCopy<TStorage> = {
    status: "done",
    platform: source.platform,
    category: resolveReuseCategory(source.category, options.catalogHasSlug),
    processedAt: processedFreshnessMs(source),
  };
  if (source.rawContent !== undefined) copy.rawContent = cloneJson(source.rawContent);
  if (source.extractedData !== undefined) copy.extractedData = cloneJson(source.extractedData);
  if (source.thumbnailStorageId !== undefined) copy.thumbnailStorageId = source.thumbnailStorageId;
  if (source.thumbnailR2Key !== undefined) copy.thumbnailR2Key = source.thumbnailR2Key;
  if (source.actionTaken !== undefined) copy.actionTaken = source.actionTaken;
  return copy;
}
