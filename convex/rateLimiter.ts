import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  signUpPerEmail: { kind: "fixed window", rate: 3, period: HOUR },
  signUpGlobal: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 10 },
});
