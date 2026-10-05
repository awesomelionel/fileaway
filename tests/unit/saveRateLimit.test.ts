import { HOUR, MINUTE } from "@convex-dev/rate-limiter";
import { SAVE_RATE_LIMITS } from "../../convex/rateLimiter";

describe("save rate limits", () => {
  it("allows a short burst and caps hourly new saves", () => {
    expect(SAVE_RATE_LIMITS.saveItemPerMinute).toEqual({
      kind: "fixed window",
      rate: 10,
      period: MINUTE,
    });
    expect(SAVE_RATE_LIMITS.saveItemPerHour).toEqual({
      kind: "fixed window",
      rate: 40,
      period: HOUR,
    });
    expect(MINUTE).toBe(60_000);
    expect(HOUR).toBe(3_600_000);
  });
});