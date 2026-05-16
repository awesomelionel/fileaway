import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";
import { ResendMagicLink } from "./ResendMagicLink";
import { rateLimiter } from "./rateLimiter";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

async function verifyTurnstileToken(token: unknown): Promise<void> {
  if (typeof token !== "string" || token.length === 0) {
    console.error("[turnstile] missing token from client");
    throw new Error("Captcha verification failed. Please refresh and try again.");
  }
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[turnstile] TURNSTILE_SECRET_KEY is not set in Convex env");
    throw new Error("TURNSTILE_SECRET_KEY is not set");
  }
  const body = new URLSearchParams({ secret, response: token });
  const res = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body });
  const data = (await res.json()) as {
    success?: boolean;
    "error-codes"?: string[];
  };
  if (!data.success) {
    console.error("[turnstile] siteverify rejected token", data["error-codes"]);
    throw new Error("Captcha verification failed. Please refresh and try again.");
  }
}

const ProtectedPassword = Password({
  verify: ResendMagicLink,
});

// The Password provider wraps a ConvexCredentials config: its real `authorize`
// (and `extraProviders`) live in `.options`, and `merge(provider, provider.options)`
// in materializeAndDefaultProviders copies them up to the top level — overwriting
// anything we set there. So we wrap `options.authorize` directly to run pre-checks
// before signUp.
{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opts = (ProtectedPassword as any).options as {
    authorize: (params: Record<string, unknown>, ctx: unknown) => Promise<unknown>;
  };
  const originalAuthorize = opts.authorize;
  opts.authorize = async (params, ctx) => {
    if (params.flow === "signUp") {
      const email = typeof params.email === "string" ? params.email.trim().toLowerCase() : "";
      if (!email) throw new Error("Email is required");
      await verifyTurnstileToken(params.turnstileToken);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await rateLimiter.limit(ctx as any, "signUpGlobal", { throws: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await rateLimiter.limit(ctx as any, "signUpPerEmail", { key: email, throws: true });
    }
    return originalAuthorize(params, ctx);
  };
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [ProtectedPassword, GitHub, Google],
  callbacks: {
    async redirect({ redirectTo }) {
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
