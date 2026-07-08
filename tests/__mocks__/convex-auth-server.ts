/** Jest stub: @convex-dev/auth/server is ESM-only (no require), so tests map it here. */
let mockUserId: string | null = "user1";

export const setMockUserId = (id: string | null) => {
  mockUserId = id;
};

export async function getAuthUserId(_ctx: unknown): Promise<string | null> {
  return mockUserId;
}
