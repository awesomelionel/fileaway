/** Jest stub: @convex-dev/auth/server is ESM-only (no require), so tests map it here. */
let mockUserId: string | null = "user1";

export const setMockUserId = (id: string | null) => {
  mockUserId = id;
};

export async function getAuthUserId(_ctx: unknown): Promise<string | null> {
  return mockUserId;
}

export async function createAccount(
  _ctx: unknown,
  _args: unknown,
): Promise<{ user: { _id: string } }> {
  return { user: { _id: "user1" } };
}

export async function retrieveAccount(
  _ctx: unknown,
  _args: unknown,
): Promise<{ user: { _id: string } }> {
  return { user: { _id: "user1" } };
}
