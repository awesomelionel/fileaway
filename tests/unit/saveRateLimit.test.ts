import { HOUR, MINUTE } from "@convex-dev/rate-limiter";
import {
  REPROCESS_RATE_LIMITS,
  SAVE_RATE_LIMITS,
  SAVE_REUSE_RATE_LIMITS,
} from "../../convex/rateLimiter";

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

  it("caps reused saves separately from the expensive-processing quota", () => {
    expect(SAVE_REUSE_RATE_LIMITS.saveReusePerMinute).toEqual({
      kind: "fixed window",
      rate: 30,
      period: MINUTE,
    });
    expect(SAVE_REUSE_RATE_LIMITS.saveReusePerHour).toEqual({
      kind: "fixed window",
      rate: 200,
      period: HOUR,
    });
    expect(SAVE_REUSE_RATE_LIMITS.saveReusePerHour.rate).toBeGreaterThan(
      SAVE_RATE_LIMITS.saveItemPerHour.rate,
    );
  });

  it("caps retry and category reprocess on a tighter quota than new saves", () => {
    expect(REPROCESS_RATE_LIMITS.reprocessPerMinute).toEqual({
      kind: "fixed window",
      rate: 5,
      period: MINUTE,
    });
    expect(REPROCESS_RATE_LIMITS.reprocessPerHour).toEqual({
      kind: "fixed window",
      rate: 20,
      period: HOUR,
    });
    expect(REPROCESS_RATE_LIMITS.reprocessPerMinute.rate).toBeLessThan(
      SAVE_RATE_LIMITS.saveItemPerMinute.rate,
    );
    expect(REPROCESS_RATE_LIMITS.reprocessPerHour.rate).toBeLessThan(
      SAVE_RATE_LIMITS.saveItemPerHour.rate,
    );
  });
});