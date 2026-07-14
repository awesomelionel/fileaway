import { deleteAccount } from "../../convex/users";
import { setMockUserId } from "../__mocks__/convex-auth-server";

type Doc = { _id: string; [k: string]: unknown };

function makeDb(tables: Record<string, Doc[]>) {
  const deleted: string[] = [];
  return {
    deleted,
    query: (table: string) => ({
      withIndex: (_name: string, _cb: (q: unknown) => unknown) => ({
        collect: async () =>
          tables[table]?.filter((d) => d.userId === "user1" || d.sessionId === "s1" || d.accountId === "a1") ?? [],
      }),
    }),
    delete: async (id: string) => {
      deleted.push(id);
    },
    get: async (id: string) => ({ _id: id }),
  };
}

test("deleteAccount cascades auth tables, savedItems, then the user", async () => {
  setMockUserId("user1");
  const db = makeDb({
    authSessions: [{ _id: "s1", userId: "user1" }],
    authRefreshTokens: [{ _id: "rt1", sessionId: "s1" }],
    authAccounts: [{ _id: "a1", userId: "user1" }],
    authVerificationCodes: [{ _id: "vc1", accountId: "a1" }],
    savedItems: [{ _id: "i1", userId: "user1" }, { _id: "i2", userId: "user1" }],
  });
  const result = await (deleteAccount as any).handler({ db }, {});
  expect(result).toBe(true);
  expect(db.deleted).toEqual(expect.arrayContaining(["rt1", "vc1", "s1", "a1", "i1", "i2", "user1"]));
  // user row must be deleted last
  expect(db.deleted[db.deleted.length - 1]).toBe("user1");
});

test("deleteAccount throws when not signed in", async () => {
  setMockUserId(null);
  await expect((deleteAccount as any).handler({ db: makeDb({}) }, {})).rejects.toThrow();
});
