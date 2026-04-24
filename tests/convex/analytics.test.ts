const captureMock = jest.fn();
const flushMock = jest.fn().mockResolvedValue(undefined);
const PostHogCtor = jest.fn().mockImplementation(() => ({
  capture: captureMock,
  flush: flushMock,
}));

jest.mock("posthog-node", () => ({
  PostHog: PostHogCtor,
}));

beforeEach(() => {
  jest.resetModules();
  captureMock.mockReset();
  flushMock.mockReset();
  flushMock.mockResolvedValue(undefined);
  PostHogCtor.mockClear();
  process.env.NEXT_PUBLIC_POSTHOG_TOKEN = "phc_test";
});

test("captureServer forwards event + props with distinct_id and flushes", async () => {
  const { captureServer, SERVER_EVENTS } = await import("../../convex/analytics");
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
  expect(flushMock).toHaveBeenCalledTimes(1);
});

test("captureServer reuses a single PostHog client across calls", async () => {
  const { captureServer, SERVER_EVENTS } = await import("../../convex/analytics");
  await captureServer({
    distinctId: "u1",
    event: SERVER_EVENTS.ITEM_PROCESSING_STARTED,
    properties: {},
  });
  await captureServer({
    distinctId: "u1",
    event: SERVER_EVENTS.ITEM_SCRAPE_COMPLETED,
    properties: {},
  });
  expect(PostHogCtor).toHaveBeenCalledTimes(1);
  expect(captureMock).toHaveBeenCalledTimes(2);
});

test("captureServer is a no-op without a token", async () => {
  delete process.env.NEXT_PUBLIC_POSTHOG_TOKEN;
  const { captureServer, SERVER_EVENTS } = await import("../../convex/analytics");
  await captureServer({
    distinctId: "user_123",
    event: SERVER_EVENTS.ITEM_PROCESSING_STARTED,
    properties: {},
  });
  expect(captureMock).not.toHaveBeenCalled();
});
