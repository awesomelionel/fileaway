import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { rateLimiter } from "./rateLimiter";

// Dev escape hatch: clear the signup rate limit for an email.
// Run with: npx convex run signupAdmin:resetSignupLimit '{"email":"you@example.com"}'
export const resetSignupLimit = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const key = email.trim().toLowerCase();
    await rateLimiter.reset(ctx, "signUpPerEmail", { key });
    await rateLimiter.reset(ctx, "signUpGlobal");
    return { ok: true, email: key };
  },
});
