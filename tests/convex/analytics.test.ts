const captureMock = jest.fn();
const shutdownMock = jest.fn().mockResolvedValue(undefined);

jest.mock("posthog-node", () => ({
  PostHog: jest.fn().mockImplementation(() => ({
    capture: captureMock,
    shutdown: shutdownMock,
  })),
}));

import { captureServer, SERVER_EVENTS } from "../../convex/analytics";

beforeEach(() => {
  captureMock.mockReset();
  shutdownMock.mockReset();
  shutdownMock.mockResolvedValue(undefined);
  process.env.NEXT_PUBLIC_POSTHOG_TOKEN = "phc_test";
});

test("captureServer forwards event + props with distinct_id and awaits shutdown", async () => {
  await captureServer({
    distinctId: "user_123",
    event: SERVER_EVENTS.ITEM_PROCESSING_STARTED,
    properties: { item_id: "item_456", platform: "tiktok" },
  });

  expect(captureMock).toHaveBeenCalledWith({
    distinctId: "user_123",
    event: "item_processing_started",
    properties: { item_id: "item_456", platform: "tiktok" },
  });
  expect(shutdownMock).toHaveBeenCalledTimes(1);
});

test("captureServer is a no-op without a token", async () => {
  delete process.env.NEXT_PUBLIC_POSTHOG_TOKEN;
  await captureServer({
    distinctId: "user_123",
    event: SERVER_EVENTS.ITEM_PROCESSING_STARTED,
    properties: {},
  });
  expect(captureMock).not.toHaveBeenCalled();
});
