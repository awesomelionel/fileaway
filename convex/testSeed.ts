import { internalAction, internalMutation } from "./_generated/server";
import { createAccount, modifyAccountCredentials } from "@convex-dev/auth/server";
import { v } from "convex/values";

// Dev-only: reset a password account's secret so the developer can sign in
// on the Simulator against the dev deployment.
export const setDevPassword = internalAction({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: args.email, secret: args.password },
    });
    return "updated";
  },
});

export const markTestUserVerified = internalMutation({
  args: {},
  handler: async (ctx) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q: any) =>
        q.eq("provider", "password").eq("providerAccountId", "ios-test@fileaway.dev"),
      )
      .unique();
    if (!account) throw new Error("test account missing");
    await ctx.db.patch(account._id, { emailVerified: "ios-test@fileaway.dev" });
    return "verified";
  },
});

// Temporary dev-only seeding helper for diagnosing mobile sign-in.
// Remove before merging: gives a known-credential password account.
export const seedTestUser = internalAction({
  args: {},
  handler: async (ctx) => {
    await createAccount(ctx, {
      provider: "password",
      account: { id: "ios-test@fileaway.dev", secret: "fileaway-test-1234!" },
      profile: { email: "ios-test@fileaway.dev" } as any,
    });
    return "seeded";
  },
});
