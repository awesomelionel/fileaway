"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useConvexAuth } from "convex/react";

export default function CockpitPage() {
  const { isAuthenticated } = useConvexAuth();
  const categories = useQuery(
    api.adminCategories.listCategories,
    isAuthenticated ? {} : "skip",
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const seedCategories = useMutation(api.adminCategories.seedCategories);
  const createCategory = useMutation(api.adminCategories.createCategory);
  const updateCategoryMut = useMutation(api.adminCategories.updateCategory);
  const deleteCategory = useMutation(api.adminCategories.deleteCategory);

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

  const editingCategory = editingId
    ? categories.find((c) => c._id === editingId)
    : null;

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

        {categories.length > 0 && !creating && !editingId && (
          <div className="flex justify-between items-center">
            <p className="text-xs text-fa-subtle">{categories.length} categories</p>
            <button
              onClick={() => setCreating(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-fa-btn-bg text-fa-btn-fg hover:bg-fa-btn-hover transition-all"
            >
              + New Category
            </button>
          </div>
        )}

        {creating && (
          <CategoryForm
            onSave={async (data) => {
              await createCategory(data);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        )}

        {editingCategory && (
          <CategoryForm
            initial={editingCategory}
            onSave={async (data) => {
              await updateCategoryMut({
                id: editingCategory._id,
                label: data.label,
                extractionPrompt: data.extractionPrompt,
                categorizationHint: data.categorizationHint,
                sortOrder: data.sortOrder,
              });
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
            onDelete={
              editingCategory.isBuiltIn
                ? undefined
                : async () => {
                    if (confirm(`Delete category "${editingCategory.label}"? This cannot be undone.`)) {
                      await deleteCategory({ id: editingCategory._id });
                      setEditingId(null);
                    }
                  }
            }
          />
        )}

        {!creating && !editingId && categories.length > 0 && (
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
                  <tr
                    key={cat._id}
                    onClick={() => setEditingId(cat._id)}
                    className="border-b border-fa-separator last:border-b-0 hover:bg-fa-elevated cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-fa-secondary">{cat.slug}</td>
                    <td className="px-4 py-2.5 text-fa-primary font-medium">{cat.label}</td>
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
        )}
      </main>
    </div>
  );
}

interface CategoryFormData {
  slug: string;
  label: string;
  extractionPrompt: string;
  categorizationHint: string;
  sortOrder: number;
}

function CategoryForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: {
    _id: Id<"categories">;
    slug: string;
    label: string;
    extractionPrompt: string;
    categorizationHint: string;
    sortOrder: number;
    isBuiltIn: boolean;
  };
  onSave: (data: CategoryFormData) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [hint, setHint] = useState(initial?.categorizationHint ?? "");
  const [prompt, setPrompt] = useState(initial?.extractionPrompt ?? "");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!initial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim() || !label.trim() || !prompt.trim()) {
      setError("Slug, label, and extraction prompt are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ slug: slug.trim(), label: label.trim(), extractionPrompt: prompt, categorizationHint: hint.trim(), sortOrder });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-fa-surface border border-fa-line rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-fa-primary">
          {isEditing ? `Edit: ${initial.label}` : "New Category"}
        </h2>
        {onDelete && (
          <button onClick={onDelete} className="text-xs px-3 py-1.5 rounded-lg text-[#ef4444] border border-[#ef444430] hover:bg-[#ef444415] transition-colors">
            Delete
          </button>
        )}
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-medium text-fa-subtle uppercase tracking-wider mb-1">Slug</label>
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} disabled={isEditing} placeholder="e.g. travel" className="w-full bg-fa-input border border-fa-line rounded-lg px-3 py-2 text-sm text-fa-primary placeholder-fa-placeholder outline-none focus:border-fa-ring disabled:opacity-50 font-mono" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-fa-subtle uppercase tracking-wider mb-1">Label</label>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Travel" className="w-full bg-fa-input border border-fa-line rounded-lg px-3 py-2 text-sm text-fa-primary placeholder-fa-placeholder outline-none focus:border-fa-ring" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-fa-subtle uppercase tracking-wider mb-1">Sort Order</label>
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} className="w-full bg-fa-input border border-fa-line rounded-lg px-3 py-2 text-sm text-fa-primary outline-none focus:border-fa-ring font-mono" />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-fa-subtle uppercase tracking-wider mb-1">
            Categorization Hint <span className="font-normal text-fa-faint ml-1">(one-line description for AI classification)</span>
          </label>
          <input type="text" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="e.g. travel destinations, trip itineraries, hotel and flight recommendations" className="w-full bg-fa-input border border-fa-line rounded-lg px-3 py-2 text-sm text-fa-primary placeholder-fa-placeholder outline-none focus:border-fa-ring" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-fa-subtle uppercase tracking-wider mb-1">
            Extraction Prompt <span className="font-normal text-fa-faint ml-1">(JSON schema template sent to Gemini)</span>
          </label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={12} placeholder={'Return JSON:\n{\n  "title": "<...>",\n  "summary": "<...>"\n}'} className="w-full bg-fa-input border border-fa-line rounded-lg px-3 py-2 text-sm text-fa-primary placeholder-fa-placeholder outline-none focus:border-fa-ring resize-y font-mono leading-relaxed" />
        </div>
        {error && <p className="text-xs text-[#ef4444]">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-xs text-fa-subtle hover:text-fa-muted hover:bg-fa-elevated border border-fa-line transition-all">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-xs font-medium bg-fa-btn-bg text-fa-btn-fg hover:bg-fa-btn-hover disabled:opacity-40 transition-all">
            {saving ? "Saving…" : isEditing ? "Update Category" : "Create Category"}
          </button>
        </div>
      </form>
    </div>
  );
}
