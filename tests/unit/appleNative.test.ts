import { appleProfileFromClaims, isAppleEmailVerified } from "../../convex/appleNative";

test("maps Apple claims to a profile", () => {
  expect(
    appleProfileFromClaims({ sub: "001234.abc", email: "a@b.com" }, "Lionel T"),
  ).toEqual({ id: "001234.abc", email: "a@b.com", name: "Lionel T" });
});

test("tolerates missing email and name (Apple only sends them once)", () => {
  expect(appleProfileFromClaims({ sub: "001234.abc" })).toEqual({
    id: "001234.abc",
    email: undefined,
    name: undefined,
  });
});

test("throws on missing sub", () => {
  expect(() => appleProfileFromClaims({} as any)).toThrow();
});

test("isAppleEmailVerified accepts boolean true and string 'true'", () => {
  expect(isAppleEmailVerified({ email_verified: true })).toBe(true);
  expect(isAppleEmailVerified({ email_verified: "true" })).toBe(true);
});

test("isAppleEmailVerified rejects everything else", () => {
  expect(isAppleEmailVerified({ email_verified: "false" })).toBe(false);
  expect(isAppleEmailVerified({ email_verified: false })).toBe(false);
  expect(isAppleEmailVerified({})).toBe(false);
});
