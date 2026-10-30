import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

/**
 * Per-user limits for `items.save`. Consumed only after the URL is valid and
 * not a duplicate, so rejected or already-saved links do not count.
 * - saveItemPerMinute: 10 new saves / minute (stops tight loops)
 * - saveItemPerHour: 40 new saves / hour (caps Apify, Gemini, and R2 spend)
 *
 * Cross-user reuse copies an already-processed result and does not call
 * Apify, the X API, Gemini, or R2, so it does not consume the limits above.
 * It still counts against a higher abuse cap so one user cannot insert
 * unbounded rows.
 * - saveReusePerMinute: 30 reused saves / minute
 * - saveReusePerHour: 200 reused saves / hour
 */
export const SAVE_RATE_LIMITS = {
  saveItemPerMinute: { kind: "fixed window" as const, rate: 10, period: MINUTE },
  saveItemPerHour: { kind: "fixed window" as const, rate: 40, period: HOUR },
};

export const SAVE_REUSE_RATE_LIMITS = {
  saveReusePerMinute: { kind: "fixed window" as const, rate: 30, period: MINUTE },
  saveReusePerHour: { kind: "fixed window" as const, rate: 200, period: HOUR },
};

/**
 * Per-user limits for `items.retryItem` and `items.reprocessWithCategory`.
 * Both schedule `processItem` (Apify + Gemini + R2), the same paid work as a
 * new save, but they are correction traffic rather than new links.
 * A dedicated window keeps that spend off the save quota: retries cannot
 * lock someone out of saving, and saves cannot hide a reprocess loop.
 * - reprocessPerMinute: 5 jobs / minute (stops a tight click or API loop)
 * - reprocessPerHour: 20 jobs / hour (caps paid reprocessing)
 */
export const REPROCESS_RATE_LIMITS = {
  reprocessPerMinute: { kind: "fixed window" as const, rate: 5, period: MINUTE },
  reprocessPerHour: { kind: "fixed window" as const, rate: 20, period: HOUR },
};

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  signUpPerEmail: { kind: "fixed window", rate: 3, period: HOUR },
  signUpGlobal: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 10 },
  ...SAVE_RATE_LIMITS,
  ...SAVE_REUSE_RATE_LIMITS,
  ...REPROCESS_RATE_LIMITS,
});
