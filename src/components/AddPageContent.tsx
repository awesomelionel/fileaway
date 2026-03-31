"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function AddPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlParam = searchParams.get("url") ?? "";
  const [url, setUrl] = useState(urlParam);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");
  const saveItem = useMutation(api.items.save);
  const autoSubmitted = useRef(false);

  const handleSave = async (targetUrl: string) => {
    if (!targetUrl.trim()) return;
    setStatus("saving");
    setErrorMsg("");
    try {
      await saveItem({ url: targetUrl.trim() });
      setStatus("done");
      setTimeout(() => router.push("/"), 1500);
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to save");
    }
  };

  // Auto-submit if URL was passed via query param
  useEffect(() => {
    if (urlParam && !autoSubmitted.current) {
      autoSubmitted.current = true;
      handleSave(urlParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-[#e8e8e8] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <div className="w-10 h-10 rounded grid grid-cols-2 gap-0.5 p-2 bg-[#1a1a1e] border border-[#2a2a2a] mx-auto mb-3">
            <div className="bg-[#f97316] rounded-[1px]" />
            <div className="bg-[#22c55e] rounded-[1px]" />
            <div className="bg-[#3b82f6] rounded-[1px]" />
            <div className="bg-[#a855f7] rounded-[1px]" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">
            file<span className="text-[#555]">away</span>
          </h1>
        </div>

        {status === "saving" && (
          <div className="text-center py-6 space-y-2">
            <svg
              className="h-6 w-6 animate-spin text-[#6366f1] mx-auto"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-[#888]">Saving link…</p>
          </div>
        )}

        {status === "done" && (
          <div className="text-center py-6 space-y-2">
            <p className="text-[#22c55e] text-2xl">✓</p>
            <p className="text-sm text-[#888]">Saved! Returning to feed…</p>
          </div>
        )}

        {(status === "idle" || status === "error") && (
          <div className="bg-[#141418] border border-[#1e1e1e] rounded-xl p-5 space-y-4">
            <p className="text-sm text-[#888]">Save a link to fileaway</p>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="w-full bg-[#1a1a1e] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-sm text-[#e8e8e8] placeholder-[#3a3a3a] outline-none focus:border-[#3a3a4a] font-mono"
            />
            {status === "error" && (
              <p className="text-xs text-[#ef4444]">{errorMsg}</p>
            )}
            <button
              onClick={() => handleSave(url)}
              disabled={!url.trim()}
              className="w-full py-2.5 rounded-lg text-sm font-medium bg-[#e8e8e8] text-[#0d0d0f] hover:bg-white transition-all disabled:opacity-40"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
