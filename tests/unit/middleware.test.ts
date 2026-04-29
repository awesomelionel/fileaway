import fs from "fs";
import path from "path";

const middlewareSource = fs.readFileSync(
  path.join(__dirname, "../../src/middleware.ts"),
  "utf8",
);
const matcherMatch = middlewareSource.match(/matcher:\s*\[\s*"([^"]+)"/);
if (!matcherMatch) {
  throw new Error("Could not find middleware matcher");
}
const matcherSource = matcherMatch[1];

function matcherApplies(path: string) {
  const pattern = matcherSource.startsWith("/") ? matcherSource.slice(1) : matcherSource;
  return new RegExp(`^/${pattern}$`).test(path);
}

test("middleware excludes PostHog ingest proxy routes", () => {
  expect(matcherApplies("/ingest")).toBe(false);
  expect(matcherApplies("/ingest/e/")).toBe(false);
  expect(matcherApplies("/ingest/static/array.js")).toBe(false);
});

test("middleware still applies to app routes", () => {
  expect(matcherApplies("/dashboard")).toBe(true);
  expect(matcherApplies("/add")).toBe(true);
  expect(matcherApplies("/ingestion")).toBe(true);
});
