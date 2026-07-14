"use client";

import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";

export default function ForgotPasswordPage() {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!normalizedEmail) {
      setError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth/verify?email=${encodeURIComponent(
        normalizedEmail,
      )}&mode=signin`;
      await signIn("password", {
        email: normalizedEmail,
        flow: "email-verification",
        redirectTo,
      });
      setSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const lower = message.toLowerCase();
      if (lower.includes("rate limit") || lower.includes("too many")) {
        setError("Too many attempts. Please try again later.");
      } else {
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-dvh bg-fa-canvas flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-sm text-center">
            <Logo size="md" className="mx-auto mb-10 w-fit" />
            <h1 className="text-xl font-semibold text-fa-primary mb-2">Check your email</h1>
            <p className="text-sm text-fa-subtle mb-6">
              If there is a fileaway account for{" "}
              <span className="text-fa-primary">{normalizedEmail}</span>, we sent a magic link that will sign you in.
            </p>
            <Link
              href="/login"
              className="text-sm text-fa-muted hover:text-fa-secondary transition-colors underline underline-offset-2"
            >
              Back to sign in
            </Link>
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-fa-canvas flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <Logo size="md" className="mb-10 w-fit" />

          <h1 className="text-xl font-semibold text-fa-primary mb-1">Sign in with email</h1>
          <p className="text-sm text-fa-subtle mb-7">
            Enter your email and we&apos;ll send a magic link that signs you in.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <div>
              <label htmlFor="email" className="block text-xs text-fa-icon-muted mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
                className="w-full bg-fa-input border border-fa-line rounded-lg px-3.5 py-2.5 text-sm text-fa-primary placeholder-fa-placeholder outline-none focus:border-fa-ring transition-colors disabled:opacity-50"
                placeholder="you@example.com"
              />
            </div>

            {error && (
              <p className="text-xs text-[#ef4444] bg-[#ef444410] border border-[#ef444420] rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-fa-btn-bg text-fa-btn-fg rounded-lg py-2.5 text-sm font-medium hover:bg-fa-btn-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-1"
            >
              {loading ? "Sending…" : "Send magic link"}
            </button>
          </form>

          <p className="mt-6 text-sm text-fa-subtle">
            Remember your password?{" "}
            <Link href="/login" className="text-fa-muted hover:text-fa-secondary transition-colors underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
