"use client";

import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
    <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 mb-10 group w-fit">
          <div className="w-7 h-7 rounded grid grid-cols-2 gap-0.5 p-1.5 bg-[#1a1a1e] border border-[#2a2a2a] group-hover:border-[#3a3a3a] transition-colors">
            <div className="bg-[#f97316] rounded-[1px]" />
            <div className="bg-[#22c55e] rounded-[1px]" />
            <div className="bg-[#3b82f6] rounded-[1px]" />
            <div className="bg-[#a855f7] rounded-[1px]" />
          </div>
          <span className="font-bold text-sm tracking-tight text-[#e8e8e8]">
            file<span className="text-[#555]">away</span>
          </span>
        </a>

        <h1 className="text-xl font-semibold text-[#e8e8e8] mb-1">Sign in</h1>
        <p className="text-sm text-[#555] mb-7">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[#888] hover:text-[#ccc] transition-colors underline underline-offset-2">
            Create one
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div>
            <label htmlFor="email" className="block text-xs text-[#666] mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
              className="w-full bg-[#1a1a1e] border border-[#2a2a2a] rounded-lg px-3.5 py-2.5 text-sm text-[#e8e8e8] placeholder-[#3a3a3a] outline-none focus:border-[#3a3a4a] transition-colors disabled:opacity-50"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs text-[#666] mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
              className="w-full bg-[#1a1a1e] border border-[#2a2a2a] rounded-lg px-3.5 py-2.5 text-sm text-[#e8e8e8] placeholder-[#3a3a3a] outline-none focus:border-[#3a3a4a] transition-colors disabled:opacity-50"
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
            className="w-full bg-[#e8e8e8] text-[#0d0d0f] rounded-lg py-2.5 text-sm font-medium hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-1"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
