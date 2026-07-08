/** Jest stub: jose is ESM-only and not needed by the unit under test
 * (appleProfileFromClaims), only imported transitively by convex/appleNative.ts. */
export const createRemoteJWKSet = (_url: URL) => {
  return async () => ({});
};

export const jwtVerify = async (
  _token: string,
  _jwks: unknown,
  _options?: unknown,
): Promise<{ payload: Record<string, unknown> }> => {
  return { payload: {} };
};

export type JWTPayload = Record<string, unknown>;
