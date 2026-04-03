"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useConvexAuth } from "convex/react";
import Link from "next/link";

export default function CockpitPage() {
  const { isAuthenticated } = useConvexAuth();
  const categories = useQuery(
    api.adminCategories.listCategories,
    isAuthenticated ? {} : "skip",
  );

  const seedCategories = useMutation(api.adminCategories.seedCategories);
  const [seedStatus, setSeedStatus] = useState<"idle" | "loading" | "done">("idle");

  const handleSeed = async () => {
    setSeedStatus("loading");
    try {
      await seedCategories();
      setSeedStatus("done");
    } catch {
      setSeedStatus("idle");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-fa-canvas flex items-center justify-center">
        <p className="text-fa-subtle text-sm">Not authenticated</p>
      </div>
    );
  }

  if (categories === undefined) {
    return (
      <div className="min-h-screen bg-fa-canvas flex items-center justify-center">
        <p className="text-fa-subtle text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fa-canvas text-fa-primary">
      <header className="border-b border-fa-border bg-fa-canvas/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-fa-subtle hover:text-fa-muted text-xs">← Feed</a>
            <h1 className="font-bold text-sm tracking-tight">
              Cockpit
              <span className="text-fa-faint font-normal ml-2 text-xs">Category Management</span>
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {categories.length === 0 && (
          <div className="bg-fa-surface border border-fa-line rounded-lg p-6 text-center space-y-3">
            <p className="text-sm text-fa-secondary">No categories found. Seed the built-in defaults?</p>
            <button
              onClick={handleSeed}
              disabled={seedStatus !== "idle"}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-fa-btn-bg text-fa-btn-fg hover:bg-fa-btn-hover disabled:opacity-40 transition-all"
            >
              {seedStatus === "loading" ? "Seeding…" : seedStatus === "done" ? "✓ Seeded!" : "Seed Built-in Categories"}
            </button>
          </div>
        )}

        {categories.length > 0 && (
          <>
            <div className="flex justify-between items-center">
              <p className="text-xs text-fa-subtle">{categories.length} categories</p>
              <Link
                href="/cockpit/new"
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-fa-btn-bg text-fa-btn-fg hover:bg-fa-btn-hover transition-all"
              >
                + New Category
              </Link>
            </div>

            <div className="bg-fa-surface border border-fa-line rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-fa-separator text-xs text-fa-subtle">
                    <th className="text-left px-4 py-2 font-medium">Slug</th>
                    <th className="text-left px-4 py-2 font-medium">Label</th>
                    <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Hint</th>
                    <th className="text-center px-4 py-2 font-medium w-16">Order</th>
                    <th className="text-center px-4 py-2 font-medium w-20">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat._id} className="border-b border-fa-separator last:border-b-0 hover:bg-fa-elevated transition-colors">
                      <td className="px-4 py-2.5">
                        <Link href={`/cockpit/${cat._id}`} className="font-mono text-xs text-fa-secondary hover:text-fa-primary transition-colors">
                          {cat.slug}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <Link href={`/cockpit/${cat._id}`} className="text-fa-primary font-medium hover:underline">
                          {cat.label}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-fa-subtle truncate max-w-[200px] hidden sm:table-cell">{cat.categorizationHint}</td>
                      <td className="px-4 py-2.5 text-center font-mono text-xs text-fa-faint">{cat.sortOrder}</td>
                      <td className="px-4 py-2.5 text-center">
                        {cat.isBuiltIn ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3b82f610] text-[#3b82f6]">built-in</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#22c55e10] text-[#22c55e]">custom</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
