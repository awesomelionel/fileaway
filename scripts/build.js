/**
 * Vercel production builds deploy Convex, then build Next.js.
 * Vercel Preview (and other non-production hosted builds) often have the
 * production CONVEX_DEPLOY_KEY, and `convex deploy` refuses that on purpose.
 *
 * - Production, local, and any build with a Convex Preview Deploy Key:
 *   `npx convex deploy --cmd 'next build'`
 * - Preview/dev hosted builds with a production (or missing) deploy key:
 *   `next build` only. Functions stay on the existing deployment.
 *   Set a Preview Deploy Key on the Vercel Preview environment to opt into
 *   per-branch Convex preview deployments. See
 *   https://docs.convex.dev/production/hosting/vercel
 */
const { spawnSync } = require("node:child_process");

/** preview:team:project|key — not a concrete deployment key. */
function isPreviewDeployKey(adminKey) {
  const parts = adminKey.split("|");
  if (parts.length < 2) return false;
  const prefixParts = parts[0].split(":");
  return prefixParts[0] === "preview" && prefixParts.length === 3;
}

/** Mirrors Convex's non-production check for Vercel and Netlify. */
function isNonProdHostedBuild(env) {
  if (env.VERCEL) return env.VERCEL_ENV !== "production";
  if (env.NETLIFY) return env.CONTEXT !== "production";
  return false;
}

function buildPlan(env) {
  const deployKey = env.CONVEX_DEPLOY_KEY ?? "";
  if (isNonProdHostedBuild(env) && !isPreviewDeployKey(deployKey)) {
    return { deployConvex: false, command: "next build" };
  }
  return {
    deployConvex: true,
    command: "npx convex deploy --cmd 'next build'",
  };
}

function main() {
  const plan = buildPlan(process.env);
  if (!plan.deployConvex) {
    const host = process.env.VERCEL
      ? `Vercel ${process.env.VERCEL_ENV ?? "preview"}`
      : `Netlify ${process.env.CONTEXT ?? "preview"}`;
    console.log(
      `[build] ${host} is not a production build and CONVEX_DEPLOY_KEY is not a Convex Preview Deploy Key. ` +
        "Skipping convex deploy so this preview does not push to production. " +
        "Running next build only. Production deploys still run convex deploy.",
    );
  }
  const result = spawnSync(plan.command, {
    stdio: "inherit",
    shell: true,
  });
  process.exit(result.status ?? 1);
}

module.exports = { isPreviewDeployKey, isNonProdHostedBuild, buildPlan };

if (require.main === module) {
  main();
}
