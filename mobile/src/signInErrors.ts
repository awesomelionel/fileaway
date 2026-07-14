// Errors we authored with user-ready messages — shown verbatim by SignInScreen.
export class KnownSignInError extends Error {}

export const OFFLINE_MESSAGE =
  "Can't reach the server. Check your connection and try again.";

export function withSignInTimeout<T>(p: Promise<T>, ms = 20000): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new KnownSignInError(OFFLINE_MESSAGE)), ms),
    ),
  ]);
}
