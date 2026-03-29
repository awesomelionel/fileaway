"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { SavedItemResponse, CategoryType } from "@/lib/api/types";
import { fetchItems } from "@/lib/api/client";
import { ItemCard, CATEGORY_META } from "@/components/feed/ItemCard";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabValue = "all" | CategoryType;

const TABS: { value: TabValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "food", label: "Food" },
  { value: "recipe", label: "Recipe" },
  { value: "fitness", label: "Fitness" },
  { value: "how-to", label: "How-To" },
  { value: "video-analysis", label: "Video" },
  { value: "other", label: "Other" },
];

// ─── URL input form ───────────────────────────────────────────────────────────

function UrlInput({ onSaved }: { onSaved: () => void }) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (res.ok) {
        setStatus("success");
        setUrl("");
        onSaved();
        setTimeout(() => setStatus("idle"), 2500);
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus("error");
        setErrorMsg(data.error ?? "Failed to save");
        setTimeout(() => setStatus("idle"), 3000);
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a TikTok, Instagram, YouTube or X link…"
          disabled={status === "loading"}
          className="w-full bg-[#1a1a1e] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-sm text-[#e8e8e8] placeholder-[#3a3a3a] outline-none focus:border-[#3a3a4a] transition-colors disabled:opacity-50 font-mono"
        />
      </div>
      <button
        type="submit"
        disabled={status === "loading" || !url.trim()}
        className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
          status === "success"
            ? "bg-[#22c55e20] text-[#22c55e] border border-[#22c55e30]"
            : status === "error"
            ? "bg-[#ef444420] text-[#ef4444] border border-[#ef444430]"
            : "bg-[#e8e8e8] text-[#0d0d0f] hover:bg-white"
        }`}
      >
        {status === "loading" ? "Saving…" : status === "success" ? "✓ Saved" : status === "error" ? "Error" : "Save"}
      </button>

      {status === "error" && errorMsg && (
        <p className="absolute top-full left-0 mt-1 text-xs text-[#ef4444]">{errorMsg}</p>
      )}
    </form>
  );
}

// ─── Category tabs ────────────────────────────────────────────────────────────

function CategoryTabs({
  active,
  counts,
  onChange,
}: {
  active: TabValue;
  counts: Record<string, number>;
  onChange: (v: TabValue) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
      {TABS.map(({ value, label }) => {
        const isActive = active === value;
        const color = value !== "all" ? CATEGORY_META[value as CategoryType].color : undefined;
        const count = value === "all" ? counts._total : counts[value];

        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            style={isActive && color ? { borderColor: color, color } : undefined}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? "bg-[#1a1a1e] border border-[#333]"
                : "text-[#555] hover:text-[#888] hover:bg-[#141418] border border-transparent"
            }`}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span
                className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                  isActive ? "bg-[#ffffff10]" : "bg-[#1a1a1a] text-[#444]"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-[#141418] border border-[#1e1e1e] border-l-4 border-l-[#222] rounded-lg p-4 space-y-3 animate-pulse">
      <div className="flex gap-2">
        <div className="h-4 w-12 bg-[#1f1f1f] rounded" />
        <div className="h-4 w-16 bg-[#1f1f1f] rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3.5 w-3/4 bg-[#1f1f1f] rounded" />
        <div className="h-3 w-1/2 bg-[#1a1a1a] rounded" />
        <div className="h-3 w-5/6 bg-[#1a1a1a] rounded" />
      </div>
      <div className="h-7 w-28 bg-[#1a1a1a] rounded" />
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ category }: { category: TabValue }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
      <p className="text-3xl mb-3 opacity-40">
        {category === "food"
          ? "🍜"
          : category === "recipe"
          ? "📋"
          : category === "fitness"
          ? "💪"
          : category === "how-to"
          ? "📖"
          : category === "video-analysis"
          ? "🎬"
          : "📂"}
      </p>
      <p className="text-sm text-[#444]">
        {category === "all"
          ? "No items yet — paste a link above to get started"
          : `No ${CATEGORY_META[category as CategoryType]?.label ?? category} items yet`}
      </p>
    </div>
  );
}

// ─── Main FeedApp ─────────────────────────────────────────────────────────────

export function FeedApp() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const activeCategory = (searchParams.get("category") as TabValue | null) ?? "all";
  const searchQuery = searchParams.get("q") ?? "";

  const [allItems, setAllItems] = useState<SavedItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(searchQuery);

  const updateParam = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "" || value === "all") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      startTransition(() => {
        router.push(`${pathname}${qs ? `?${qs}` : ""}`);
      });
    },
    [searchParams, router, pathname],
  );

  const loadItems = useCallback(async () => {
    setLoading(true);
    const result = await fetchItems({ limit: 100 });
    setAllItems(result.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Sync search input with URL param
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  // Client-side filter (instant response)
  const filteredItems = allItems.filter((item) => {
    if (activeCategory !== "all" && item.category !== activeCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const text = [item.source_url, JSON.stringify(item.extracted_data ?? {})].join(" ").toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  // Category counts for tabs
  const counts: Record<string, number> = {
    _total: allItems.filter((i) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const text = [i.source_url, JSON.stringify(i.extracted_data ?? {})].join(" ").toLowerCase();
      return text.includes(q);
    }).length,
  };
  for (const item of allItems) {
    if (!searchQuery) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    } else {
      const q = searchQuery.toLowerCase();
      const text = [item.source_url, JSON.stringify(item.extracted_data ?? {})].join(" ").toLowerCase();
      if (text.includes(q)) {
        counts[item.category] = (counts[item.category] ?? 0) + 1;
      }
    }
  }

  const handleCategoryChange = useCallback(
    (id: string, category: CategoryType) => {
      setAllItems((prev) => prev.map((item) => (item.id === id ? { ...item, category } : item)));
    },
    [],
  );

  const handleSearch = (value: string) => {
    setSearchInput(value);
    // Debounce URL update
    const timer = setTimeout(() => {
      updateParam({ q: value || null });
    }, 350);
    return () => clearTimeout(timer);
  };

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-[#e8e8e8]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#1a1a1a] bg-[#0d0d0f]/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          {/* Logo */}
          <a href="/" className="flex-shrink-0 flex items-center gap-2 group">
            <div className="w-6 h-6 rounded grid grid-cols-2 gap-0.5 p-1 bg-[#1a1a1e] border border-[#2a2a2a] group-hover:border-[#3a3a3a] transition-colors">
              <div className="bg-[#f97316] rounded-[1px]" />
              <div className="bg-[#22c55e] rounded-[1px]" />
              <div className="bg-[#3b82f6] rounded-[1px]" />
              <div className="bg-[#a855f7] rounded-[1px]" />
            </div>
            <span className="font-bold text-sm tracking-tight text-[#e8e8e8]">
              file<span className="text-[#555]">away</span>
            </span>
          </a>

          {/* URL input */}
          <div className="flex-1 relative">
            <UrlInput onSaved={loadItems} />
          </div>
        </div>
      </header>

      {/* Filters row */}
      <div className="sticky top-[57px] z-20 bg-[#0d0d0f]/95 backdrop-blur-sm border-b border-[#161616]">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444] text-xs">⌕</span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search…"
              className="bg-[#141418] border border-[#222] rounded-lg pl-7 pr-3 py-1.5 text-xs text-[#ccc] placeholder-[#333] outline-none focus:border-[#2a2a2a] w-40 transition-all focus:w-52"
            />
          </div>

          <div className="w-px h-4 bg-[#222]" />

          {/* Category tabs */}
          <div className="flex-1">
            <CategoryTabs
              active={activeCategory}
              counts={counts}
              onChange={(v) => updateParam({ category: v === "all" ? null : v })}
            />
          </div>

          {/* Item count */}
          {!loading && (
            <span className="flex-shrink-0 text-[11px] text-[#444] font-mono">
              {filteredItems.length}
            </span>
          )}
        </div>
      </div>

      {/* Feed */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : filteredItems.length === 0 ? (
            <EmptyState category={activeCategory} />
          ) : (
            filteredItems.map((item) => (
              <ItemCard key={item.id} item={item} onCategoryChange={handleCategoryChange} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
