import { useAuthActions } from "@convex-dev/auth/react";
import { makeRedirectUri } from "expo-auth-session";
import { openAuthSessionAsync } from "expo-web-browser";

const redirectTo = makeRedirectUri(); // fileaway://

export function useOAuthSignIn(provider: "github" | "google") {
  const { signIn } = useAuthActions();
  return async () => {
    const { redirect } = await signIn(provider, { redirectTo });
    if (!redirect) return;
    const result = await openAuthSessionAsync(redirect.toString(), redirectTo);
    if (result.type === "success") {
      const url = new URL(result.url);
      const error = url.searchParams.get("error");
      if (error) throw new Error(`Provider returned: ${error}`);
      const code = url.searchParams.get("code");
      if (!code) throw new Error("Sign-in was cancelled or returned no code");
      await signIn(provider, { code });
    }
  };
}
