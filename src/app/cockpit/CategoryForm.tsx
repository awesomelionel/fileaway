"use client";

import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";

export interface CategoryFormData {
  slug: string;
  label: string;
  extractionPrompt: string;
  categorizationHint: string;
  sortOrder: number;
}

export function CategoryForm({
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
