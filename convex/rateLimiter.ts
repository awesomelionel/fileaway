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

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  signUpPerEmail: { kind: "fixed window", rate: 3, period: HOUR },
  signUpGlobal: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 10 },
  ...SAVE_RATE_LIMITS,
  ...SAVE_REUSE_RATE_LIMITS,
});
