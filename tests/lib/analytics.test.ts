const captureMock = jest.fn();
jest.mock("posthog-js", () => ({
  __esModule: true,
  default: {
    get __loaded() {
      return (globalThis as unknown as { __ph_loaded?: boolean }).__ph_loaded ?? false;
    },
    capture: (...args: unknown[]) => captureMock(...args),
  },
}));

import { track, EVENTS } from "@/lib/analytics";

// Stub window so typeof window !== "undefined" inside track().
beforeAll(() => {
  (globalThis as unknown as { window?: unknown }).window = globalThis;
});
afterAll(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

beforeEach(() => {
  captureMock.mockReset();
  (globalThis as unknown as { __ph_loaded?: boolean }).__ph_loaded = true;
});

test("track forwards event name and props to posthog.capture", () => {
  track(EVENTS.LINK_SAVE_SUBMITTED, { platform: "tiktok", url_host: "tiktok.com" });
  expect(captureMock).toHaveBeenCalledWith("link_save_submitted", {
    platform: "tiktok",
    url_host: "tiktok.com",
  });
});

test("track is a no-op when posthog has not loaded", () => {
  (globalThis as unknown as { __ph_loaded?: boolean }).__ph_loaded = false;
  track(EVENTS.LINK_SAVE_SUBMITTED, { platform: "tiktok", url_host: "tiktok.com" });
  expect(captureMock).not.toHaveBeenCalled();
});

test("EVENTS contains the core funnel names", () => {
  expect(EVENTS).toMatchObject({
    LINK_SAVE_SUBMITTED: "link_save_submitted",
    LINK_SAVE_SUCCEEDED: "link_save_succeeded",
    LINK_SAVE_FAILED: "link_save_failed",
    ITEM_VIEWED: "item_viewed",
    ITEM_ACTION_TAKEN: "item_action_taken",
  });
});
