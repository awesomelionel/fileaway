"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  categoryAccentStyle,
  dashboardCategorySlugs,
  getCategoryMeta,
} from "@/lib/categoryMeta";
import Link from "next/link";

export function DashboardView() {
  const stats = useQuery(api.items.stats);
  const categoryRows = useQuery(api.adminCategories.listCategories);

  if (stats === undefined) {
    // Loading
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-fa-surface rounded-lg border border-fa-border-soft" />
        ))}
      </div>
    );
  }

  if (stats === null) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-fa-subtle text-sm">
        Not signed in.
      </div>
    );
  }

  const categories = dashboardCategorySlugs(stats.byCategory, categoryRows);

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
            className="bg-fa-surface border border-fa-border-soft rounded-lg p-4 text-center"
          >
            <p className={`text-2xl font-bold font-mono ${warn ? "text-[#ef4444]" : "text-fa-primary"}`}>
              {value}
            </p>
            <p className="text-[11px] text-fa-subtle mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* By category */}
      <div>
        <h2 className="text-xs font-medium uppercase tracking-wider text-fa-subtle mb-3">
          By category
        </h2>
        <div className="space-y-2">
          {categories.map((cat) => {
            const count = stats.byCategory[cat] ?? 0;
            const meta = getCategoryMeta(cat);
            const max = Math.max(...Object.values(stats.byCategory), 1);
            return (
              <div key={cat} className="flex items-center gap-3" style={categoryAccentStyle(meta)}>
                <span className="text-xs w-20 flex-shrink-0 truncate cat-accent-text" title={meta.label}>
                  {meta.label}
                </span>
                <div className="flex-1 h-2 bg-fa-muted-bg rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 cat-accent-fill"
                    style={{
                      width: `${(count / max) * 100}%`,
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-fa-icon-muted w-6 text-right flex-shrink-0">
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
          <h2 className="text-xs font-medium uppercase tracking-wider text-fa-subtle mb-3">
            Recent saves
          </h2>
          <div className="space-y-1.5">
            {stats.recentItems.map((item) => {
              const meta = getCategoryMeta(item.category);
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 bg-fa-surface border border-fa-border-soft rounded-lg px-4 py-2.5"
                  style={categoryAccentStyle(meta)}
                >
                  <span className="text-[10px] font-medium cat-accent-text w-16 flex-shrink-0 truncate" title={meta.label}>
                    {meta.label}
                  </span>
                  <span className="text-xs text-fa-icon-muted font-mono truncate flex-1">
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
          className="text-xs text-fa-subtle hover:text-fa-muted transition-colors"
        >
          ← Back to feed
        </Link>
      </div>
    </div>
  );
}
