export default {
  // Used by Convex's internal auth/JWT verification (not by Convex Auth's
  // provider registry). Required for Next.js middleware helpers to work.
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};

