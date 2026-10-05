/** Jest stub: the real component talks to Convex at runtime. Tests only need the period constants. */
export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;

export class RateLimiter {
  constructor(
    public component: unknown,
    public config: Record<string, unknown>,
  ) {}

  async limit() {
    return { ok: true as const, retryAfter: 0 };
  }

  async reset() {
    return undefined;
  }
}
