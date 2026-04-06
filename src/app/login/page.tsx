"use client";

import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  );
}

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }

    setLoading(true);
    try {
      await signIn("password", { email: email.trim(), password, flow: "signIn" });
      router.push("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("invalid") || message.toLowerCase().includes("credentials")) {
        setError("Invalid email or password");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-fa-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 mb-10 group w-fit">
          <div className="w-7 h-7 rounded grid grid-cols-2 gap-0.5 p-1.5 bg-fa-input border border-fa-line group-hover:border-fa-ring transition-colors">
            <div className="bg-[#f97316] rounded-[1px]" />
            <div className="bg-[#22c55e] rounded-[1px]" />
            <div className="bg-[#3b82f6] rounded-[1px]" />
            <div className="bg-[#a855f7] rounded-[1px]" />
          </div>
          <span className="font-bold text-sm tracking-tight text-fa-primary">
            file<span className="text-fa-subtle">away</span>
          </span>
        </a>

        <h1 className="text-xl font-semibold text-fa-primary mb-1">Sign in</h1>
        <p className="text-sm text-fa-subtle mb-7">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-fa-muted hover:text-fa-secondary transition-colors underline underline-offset-2">
            Create one
          </Link>
        </p>

        {/* Social login */}
        <div className="space-y-2 mb-6">
          <button
            type="button"
            onClick={() => void signIn("google", { redirectTo: window.location.origin })}
            className="w-full flex items-center justify-center gap-2.5 bg-fa-input border border-fa-line rounded-lg px-4 py-2.5 text-sm text-fa-primary hover:border-fa-ring transition-colors"
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => void signIn("github", { redirectTo: window.location.origin })}
            className="w-full flex items-center justify-center gap-2.5 bg-fa-input border border-fa-line rounded-lg px-4 py-2.5 text-sm text-fa-primary hover:border-fa-ring transition-colors"
          >
            <GitHubIcon />
            Continue with GitHub
          </button>
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-fa-line" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-fa-canvas px-2 text-fa-icon-muted">or continue with email</span>
          </div>
        </div>

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

          <div>
            <label htmlFor="password" className="block text-xs text-fa-icon-muted mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
              className="w-full bg-fa-input border border-fa-line rounded-lg px-3.5 py-2.5 text-sm text-fa-primary placeholder-fa-placeholder outline-none focus:border-fa-ring transition-colors disabled:opacity-50"
              placeholder="••••••••"
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
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
