import { me } from "../../convex/users";
import { setMockUserId } from "../__mocks__/convex-auth-server";

type Doc = { _id: string; email?: string; name?: string };

function makeDb(user: Doc | null) {
  return {
    get: async (_id: string) => user,
  };
}

test("users.me returns the email (and name) for a signed-in user", async () => {
  setMockUserId("user1");
  const db = makeDb({ _id: "user1", email: "person@example.com", name: "Person" });
  const result = await (me as any).handler({ db }, {});
  expect(result).toEqual({ email: "person@example.com", name: "Person" });
});

test("users.me returns null when signed out", async () => {
  setMockUserId(null);
  const db = makeDb(null);
  const result = await (me as any).handler({ db }, {});
  expect(result).toBeNull();
});
