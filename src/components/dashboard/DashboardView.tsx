"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CATEGORY_META } from "@/components/feed/ItemCard";
import type { CategoryType } from "@/lib/api/types";
import Link from "next/link";

export function DashboardView() {
  const stats = useQuery(api.items.stats);

  if (stats === undefined) {
    // Loading
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-[#141418] rounded-lg border border-[#1e1e1e]" />
        ))}
      </div>
    );
  }

  if (stats === null) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-[#555] text-sm">
        Not signed in.
      </div>
    );
  }

  const categories: CategoryType[] = [
    "food", "recipe", "fitness", "how-to", "video-analysis", "other",
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total saved", value: stats.total },
          { label: "Processed",   value: Object.values(stats.byCategory).reduce((s: number, n) => s + n, 0) },
          { label: "Processing",  value: stats.processingCount },
          { label: "Failed",      value: stats.failedCount,    warn: stats.failedCount > 0 },
        ].map(({ label, value, warn }) => (
          <div
            key={label}
            className="bg-[#141418] border border-[#1e1e1e] rounded-lg p-4 text-center"
          >
            <p className={`text-2xl font-bold font-mono ${warn ? "text-[#ef4444]" : "text-[#e8e8e8]"}`}>
              {value}
            </p>
            <p className="text-[11px] text-[#555] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* By category */}
      <div>
        <h2 className="text-xs font-medium uppercase tracking-wider text-[#555] mb-3">
          By category
        </h2>
        <div className="space-y-2">
          {categories.map((cat) => {
            const count = stats.byCategory[cat] ?? 0;
            const meta = CATEGORY_META[cat];
            const max = Math.max(...Object.values(stats.byCategory), 1);
            return (
              <div key={cat} className="flex items-center gap-3">
                <span className={`text-xs w-20 flex-shrink-0 ${meta.text}`}>
                  {meta.label}
                </span>
                <div className="flex-1 h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(count / max) * 100}%`,
                      backgroundColor: meta.color,
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-[#666] w-6 text-right flex-shrink-0">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent saves */}
      {stats.recentItems.length > 0 && (
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wider text-[#555] mb-3">
            Recent saves
          </h2>
          <div className="space-y-1.5">
            {stats.recentItems.map((item) => {
              const meta = CATEGORY_META[item.category as CategoryType] ?? CATEGORY_META.other;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 bg-[#141418] border border-[#1e1e1e] rounded-lg px-4 py-2.5"
                >
                  <span className={`text-[10px] font-medium ${meta.text} w-16 flex-shrink-0`}>
                    {meta.label}
                  </span>
                  <span className="text-xs text-[#666] font-mono truncate flex-1">
                    {item.sourceUrl}
                  </span>
                  <span
                    className={`text-[10px] flex-shrink-0 ${
                      item.status === "done"
                        ? "text-[#22c55e]"
                        : item.status === "failed"
                        ? "text-[#ef4444]"
                        : "text-[#f59e0b]"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="pt-2">
        <Link
          href="/"
          className="text-xs text-[#555] hover:text-[#888] transition-colors"
        >
          ← Back to feed
        </Link>
      </div>
    </div>
  );
}
