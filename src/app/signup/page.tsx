"use client";

import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await signIn("password", { email: email.trim(), password, flow: "signUp" });
      router.push("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("already") || message.toLowerCase().includes("exists")) {
        setError("An account with this email already exists");
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

        <h1 className="text-xl font-semibold text-fa-primary mb-1">Create account</h1>
        <p className="text-sm text-fa-subtle mb-7">
          Already have an account?{" "}
          <Link href="/login" className="text-fa-muted hover:text-fa-secondary transition-colors underline underline-offset-2">
            Sign in
          </Link>
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

          <div>
            <label htmlFor="password" className="block text-xs text-fa-icon-muted mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={loading}
              className="w-full bg-fa-input border border-fa-line rounded-lg px-3.5 py-2.5 text-sm text-fa-primary placeholder-fa-placeholder outline-none focus:border-fa-ring transition-colors disabled:opacity-50"
              placeholder="Min. 8 characters"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-xs text-fa-icon-muted mb-1.5">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
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
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
