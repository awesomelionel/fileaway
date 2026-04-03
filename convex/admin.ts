import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";

export const ADMIN_EMAIL = "lioneltan@gmail.com";

export async function getAuthUserEmail(
  ctx: QueryCtx | MutationCtx,
): Promise<string | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  return (user?.email as string | undefined) ?? null;
}

export async function assertAdmin(ctx: QueryCtx | MutationCtx): Promise<void> {
  const email = await getAuthUserEmail(ctx);
  if (email !== ADMIN_EMAIL) {
    throw new Error("Not authorized");
  }
}

export async function isAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const email = await getAuthUserEmail(ctx);
  return email === ADMIN_EMAIL;
}
