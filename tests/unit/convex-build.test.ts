import { buildPlan, isPreviewDeployKey } from "../../scripts/build";

const PROD_KEY = "prod:happy-animal-123|secret";
const PREVIEW_KEY = "preview:my-team:my-project|secret";

describe("buildPlan", () => {
  it("deploys Convex on Vercel production", () => {
    expect(
      buildPlan({ VERCEL: "1", VERCEL_ENV: "production", CONVEX_DEPLOY_KEY: PROD_KEY }),
    ).toEqual({
      deployConvex: true,
      command: "npx convex deploy --cmd 'next build'",
    });
  });

  it("skips Convex deploy on Vercel preview when the key is a production key", () => {
    expect(
      buildPlan({ VERCEL: "1", VERCEL_ENV: "preview", CONVEX_DEPLOY_KEY: PROD_KEY }),
    ).toEqual({ deployConvex: false, command: "next build" });
  });

  it("skips Convex deploy on Vercel preview when the key is a legacy production key", () => {
    expect(
      buildPlan({ VERCEL: "1", VERCEL_ENV: "preview", CONVEX_DEPLOY_KEY: "legacy-admin-key" }),
    ).toEqual({ deployConvex: false, command: "next build" });
  });

  it("skips Convex deploy on Vercel development builds", () => {
    expect(
      buildPlan({ VERCEL: "1", VERCEL_ENV: "development", CONVEX_DEPLOY_KEY: PROD_KEY }),
    ).toEqual({ deployConvex: false, command: "next build" });
  });

  it("still deploys on Vercel preview when the key is a Preview Deploy Key", () => {
    expect(isPreviewDeployKey(PREVIEW_KEY)).toBe(true);
    expect(
      buildPlan({ VERCEL: "1", VERCEL_ENV: "preview", CONVEX_DEPLOY_KEY: PREVIEW_KEY }),
    ).toEqual({
      deployConvex: true,
      command: "npx convex deploy --cmd 'next build'",
    });
  });

  it("does not treat a concrete preview deployment key as a Preview Deploy Key", () => {
    expect(isPreviewDeployKey("preview:deployment-name|secret")).toBe(false);
    expect(
      buildPlan({
        VERCEL: "1",
        VERCEL_ENV: "preview",
        CONVEX_DEPLOY_KEY: "preview:deployment-name|secret",
      }),
    ).toEqual({ deployConvex: false, command: "next build" });
  });

  it("deploys on a local build", () => {
    expect(buildPlan({ CONVEX_DEPLOY_KEY: PROD_KEY })).toEqual({
      deployConvex: true,
      command: "npx convex deploy --cmd 'next build'",
    });
  });

  it("skips Convex deploy for Netlify deploy previews with a production key", () => {
    expect(
      buildPlan({ NETLIFY: "true", CONTEXT: "deploy-preview", CONVEX_DEPLOY_KEY: PROD_KEY }),
    ).toEqual({ deployConvex: false, command: "next build" });
    expect(
      buildPlan({ NETLIFY: "true", CONTEXT: "production", CONVEX_DEPLOY_KEY: PROD_KEY }).deployConvex,
    ).toBe(true);
  });
});
