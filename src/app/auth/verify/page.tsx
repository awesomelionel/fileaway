"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function VerifyInner() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const email = params.get("email");
  const hasParams = !!token && !!email;

  const [status, setStatus] = useState<"verifying" | "error">(
    hasParams ? "verifying" : "error",
  );
  const [error, setError] = useState(
    hasParams ? "" : "This verification link is missing required information.",
  );
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !hasParams) return;
    ran.current = true;

    (async () => {
      try {
        await signIn("password", { email: email!, code: token!, flow: "email-verification" });
        router.replace("/");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes("expired") || message.toLowerCase().includes("invalid")) {
          setError("This verification link is invalid or has expired.");
        } else {
          setError("We couldn't verify your email. Please try signing up again.");
        }
        setStatus("error");
      }
    })();
  }, [hasParams, email, token, signIn, router]);

  return (
    <div className="min-h-screen bg-fa-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {status === "verifying" ? (
          <>
            <h1 className="text-xl font-semibold text-fa-primary mb-2">Verifying…</h1>
            <p className="text-sm text-fa-subtle">Hang tight, finishing up your sign-up.</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-fa-primary mb-2">Verification failed</h1>
            <p className="text-sm text-fa-subtle mb-6">{error}</p>
            <Link
              href="/signup"
              className="text-sm text-fa-muted hover:text-fa-secondary transition-colors underline underline-offset-2"
            >
              Back to sign up
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
