import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password, GitHub, Google],
  callbacks: {
    redirect({ redirectTo }) {
      const allowed = [
        process.env.APP_URL,
        "http://localhost:3000",
      ].filter(Boolean) as string[];
      if (allowed.some((origin) => redirectTo.startsWith(origin))) {
        return redirectTo;
      }
      return process.env.APP_URL ?? redirectTo;
    },
  },
});
