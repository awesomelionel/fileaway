import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { createAccount, retrieveAccount } from "@convex-dev/auth/server";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export function appleProfileFromClaims(
  claims: Pick<JWTPayload, "sub"> & { email?: unknown },
  fullName?: string,
) {
  if (!claims.sub) throw new Error("Apple identity token missing sub claim");
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
    name: fullName || undefined,
  };
}

export function isAppleEmailVerified(claims: JWTPayload): boolean {
  const emailVerified = claims["email_verified"];
  return emailVerified === true || emailVerified === "true";
}

// Native Sign in with Apple (App Store Guideline 4.8).
// The client obtains an identityToken via expo-apple-authentication and we
// verify it server-side against Apple's JWKS. audience = our bundle id.
export const AppleNative = ConvexCredentials({
  id: "apple-native",
  authorize: async (params, ctx) => {
    const identityToken = params.identityToken;
    if (typeof identityToken !== "string") throw new Error("Missing identityToken");
    const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
      issuer: "https://appleid.apple.com",
      audience: process.env.APPLE_BUNDLE_ID ?? "com.fileaway.app",
    });
    const profile = appleProfileFromClaims(
      payload,
      typeof params.fullName === "string" ? params.fullName : undefined,
    );
    try {
      const { user } = await retrieveAccount(ctx, {
        provider: "apple-native",
        account: { id: profile.id },
      });
      return { userId: user._id };
    } catch {
      const profileFields: Record<string, string> = {};
      if (profile.email) profileFields.email = profile.email;
      if (profile.name) profileFields.name = profile.name;
      const { user } = await createAccount(ctx, {
        provider: "apple-native",
        account: { id: profile.id },
        profile: profileFields,
        shouldLinkViaEmail: isAppleEmailVerified(payload),
      });
      return { userId: user._id };
    }
  },
});
