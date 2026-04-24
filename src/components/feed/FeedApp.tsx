"use client";

import { useState, useCallback, useTransition } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ItemCard, getCategoryMeta } from "@/components/feed/ItemCard";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery, useMutation, usePreloadedQuery, Preloaded } from "convex/react";
import { api } from "../../../convex/_generated/api";
import dynamic from "next/dynamic";
import { track, EVENTS, urlHost } from "@/lib/analytics";

function detectPlatform(url: string): "tiktok" | "instagram" | "youtube" | "twitter" | "other" {
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/twitter\.com|x\.com/i.test(url)) return "twitter";
  return "other";
}

const DetailModal = dynamic(
  () => import("@/components/feed/DetailModal").then((m) => ({ default: m.DetailModal })),
  { ssr: false },
);

// ─── Types ────────────────────────────────────────────────────────────────────

type TabValue = string;

// ─── URL input form ───────────────────────────────────────────────────────────

function UrlInput() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const saveItem = useMutation(api.items.save);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    const cleaned = url.trim();
    const platform = detectPlatform(cleaned);
    track(EVENTS.LINK_SAVE_SUBMITTED, { platform, url_host: urlHost(cleaned) });

    setStatus("loading");
    setErrorMsg("");

    try {
      const id = await saveItem({ url: cleaned });
      track(EVENTS.LINK_SAVE_SUCCEEDED, {
        platform,
        url_host: urlHost(cleaned),
        item_id: String(id),
      });
      setStatus("success");
      setUrl("");
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      track(EVENTS.LINK_SAVE_FAILED, {
        platform,
        url_host: urlHost(cleaned),
        error_message: msg,
      });
      setStatus("error");
      setErrorMsg(msg);
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
          className="w-full bg-fa-input border border-fa-line rounded-lg px-4 py-2.5 text-sm text-fa-primary placeholder-fa-placeholder outline-none focus:border-fa-ring transition-colors disabled:opacity-50 font-mono"
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
            : "bg-fa-btn-bg text-fa-btn-fg hover:bg-fa-btn-hover"
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
  tabs,
  onChange,
}: {
  active: string;
  counts: Record<string, number>;
  tabs: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
      {tabs.map(({ value, label }) => {
        const isActive = active === value;
        const color = value !== "all" ? getCategoryMeta(value).color : undefined;
        const count = value === "all" ? counts._total : counts[value];
        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            style={isActive && color ? { borderColor: color, color } : undefined}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? "bg-fa-input border border-fa-strong"
                : "text-fa-subtle hover:text-fa-muted hover:bg-fa-elevated border border-transparent"
            }`}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${isActive ? "bg-fa-count-active" : "bg-fa-muted-bg text-fa-faint"}`}>
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
    <div className="bg-fa-surface border border-fa-border-soft border-l-4 border-l-fa-line rounded-lg p-4 space-y-3 animate-pulse">
      <div className="flex gap-2">
        <div className="h-4 w-12 bg-fa-chip rounded" />
        <div className="h-4 w-16 bg-fa-chip rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3.5 w-3/4 bg-fa-chip rounded" />
        <div className="h-3 w-1/2 bg-fa-muted-bg rounded" />
        <div className="h-3 w-5/6 bg-fa-muted-bg rounded" />
      </div>
      <div className="h-7 w-28 bg-fa-muted-bg rounded" />
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  category,
  archiveView,
}: {
  category: TabValue;
  archiveView: boolean;
}) {
  if (archiveView) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
        <p className="text-3xl mb-3 opacity-40">📦</p>
        <p className="text-sm text-fa-faint">Nothing archived yet</p>
      </div>
    );
  }
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
          : category === "travel"
          ? "🧭"
          : "📂"}
      </p>
      <p className="text-sm text-fa-faint">
        {category === "all"
          ? "No items yet — paste a link above to get started"
          : `No ${getCategoryMeta(category).label} items yet`}
      </p>
    </div>
  );
}

// ─── Sign out button ──────────────────────────────────────────────────────────

function SignOutButton() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    await signOut();
    router.push("/login");
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs text-fa-subtle hover:text-fa-muted hover:bg-fa-elevated border border-transparent transition-all disabled:opacity-40"
    >
      {loading ? "Logging out…" : "Logout"}
    </button>
  );
}

// ─── Main FeedApp ─────────────────────────────────────────────────────────────

type FeedAppProps = {
  preloadedItems: Preloaded<typeof api.items.list>;
  preloadedCategories: Preloaded<typeof api.adminCategories.listCategories>;
};

export function FeedApp({ preloadedItems, preloadedCategories }: FeedAppProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");

  const activeCategory = (searchParams.get("category") as TabValue | null) ?? "all";
  const searchQuery = searchParams.get("q") ?? "";
  const archiveView = searchParams.get("view") === "archive";

  // Feed view: SSR-preloaded, stays reactive. Archive view: lazy client query.
  const feedItems = usePreloadedQuery(preloadedItems);
  const archiveItems = useQuery(api.items.list, archiveView ? { view: "archive" } : "skip");
  const allItems = archiveView ? (archiveItems ?? []) : feedItems;
  const loading = archiveView && archiveItems === undefined;

  const categories = usePreloadedQuery(preloadedCategories);
  const tabs: { value: string; label: string }[] = [
    { value: "all", label: "All" },
    ...categories.map((c) => ({ value: c.slug, label: c.label })),
  ];

  const activeItemId = searchParams.get("item");
  const activeItem = activeItemId ? allItems.find((i) => i.id === activeItemId) ?? null : null;

  const openItem = useCallback(
    (id: string) => {
      const item = allItems.find((i) => i.id === id);
      if (item) {
        track(EVENTS.ITEM_VIEWED, {
          item_id: id,
          category: item.category,
          platform: item.platform,
        });
      }
      const params = new URLSearchParams(searchParams.toString());
      params.set("item", id);
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname, allItems],
  );

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

  const handleSearch = (value: string) => {
    setSearchInput(value);
    const timer = setTimeout(() => {
      updateParam({ q: value || null });
      if (value.trim().length > 0) {
        track(EVENTS.SEARCH_PERFORMED, {
          query_length: value.trim().length,
          result_count: filteredItems.length,
        });
      }
    }, 350);
    return () => clearTimeout(timer);
  };

  return (
    <div className="min-h-screen bg-fa-canvas text-fa-primary">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-fa-border bg-fa-canvas/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3">
          {/* Top row: logo + nav + sign out */}
          <div className="flex items-center gap-3">
            {/* Logo */}
            <a href="/" className="flex-shrink-0 flex items-center gap-2 group">
              <div className="w-6 h-6 rounded grid grid-cols-2 gap-0.5 p-1 bg-fa-input border border-fa-line group-hover:border-fa-ring transition-colors">
                <div className="bg-[#f97316] rounded-[1px]" />
                <div className="bg-[#22c55e] rounded-[1px]" />
                <div className="bg-[#3b82f6] rounded-[1px]" />
                <div className="bg-[#a855f7] rounded-[1px]" />
              </div>
              <span className="font-bold text-sm tracking-tight text-fa-primary">
                file<span className="text-fa-logo-dim">away</span>
              </span>
            </a>

            {/* Desktop URL input — hidden on mobile */}
            <div className="hidden sm:block flex-1 relative">
              <UrlInput />
            </div>

            {/* Nav links + sign out — pushed to right */}
            <div className="ml-auto flex items-center gap-1">
              <a
                href="/dashboard"
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs text-fa-subtle hover:text-fa-muted hover:bg-fa-elevated border border-transparent transition-all"
              >
                Stats
              </a>
              <a
                href="/share"
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs text-fa-subtle hover:text-fa-muted hover:bg-fa-elevated border border-transparent transition-all"
              >
                Share
              </a>
              <SignOutButton />
            </div>
          </div>

          {/* Mobile URL input — shown below top row on mobile only */}
          <div className="sm:hidden mt-2">
            <UrlInput />
          </div>
        </div>
      </header>

      {/* Filters row */}
      <div className="sm:sticky sm:top-[57px] z-20 bg-fa-canvas/95 backdrop-blur-sm border-b border-fa-border">
        <div className="max-w-5xl mx-auto px-4 py-2 flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fa-faint text-xs">⌕</span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search…"
              className="bg-fa-surface border border-fa-line rounded-lg pl-7 pr-3 py-1.5 text-xs text-fa-secondary placeholder-fa-placeholder outline-none focus:border-fa-line w-36 transition-all focus:w-48"
            />
          </div>

          {/* Category tabs */}
          <div className="flex-1 min-w-0">
            <CategoryTabs
              active={activeCategory}
              counts={counts}
              tabs={tabs}
              onChange={(v) => {
                track(EVENTS.CATEGORY_TAB_CHANGED, { from: activeCategory, to: v });
                updateParam({ category: v === "all" ? null : v });
              }}
            />
          </div>

          {/* Feed vs archive + count (single pill) */}
          <div className="flex items-center rounded-lg border border-fa-line bg-fa-surface p-0.5 flex-shrink-0 gap-0.5">
            <button
              type="button"
              onClick={() => {
                track(EVENTS.VIEW_TOGGLED, { to: "feed", from: archiveView ? "archive" : "feed" });
                updateParam({ view: null });
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                !archiveView ? "bg-fa-pill-active text-fa-primary" : "text-fa-subtle hover:text-fa-muted"
              }`}
            >
              Feed
            </button>
            <button
              type="button"
              onClick={() => {
                track(EVENTS.VIEW_TOGGLED, { to: "archive", from: archiveView ? "archive" : "feed" });
                updateParam({ view: "archive" });
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                archiveView ? "bg-fa-pill-active text-fa-primary" : "text-fa-subtle hover:text-fa-muted"
              }`}
            >
              Archive
            </button>
            {!loading && (
              <span
                className="flex items-center min-w-[1.75rem] justify-center pl-2 pr-1.5 ml-0.5 border-l border-fa-line text-[11px] text-fa-faint font-mono tabular-nums"
                aria-live="polite"
                aria-label={`${filteredItems.length} items`}
              >
                {filteredItems.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Feed */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : filteredItems.length === 0 ? (
            <EmptyState category={activeCategory} archiveView={archiveView} />
          ) : (
            filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                categories={categories.map((c) => ({ slug: c.slug, label: c.label }))}
                onCardClick={openItem}
              />
            ))
          )}
        </div>
      </main>
      {activeItem && (
        <DetailModal
          key={activeItem.id}
          item={activeItem}
          categories={categories.map((c) => ({ slug: c.slug, label: c.label }))}
        />
      )}
    </div>
  );
}
