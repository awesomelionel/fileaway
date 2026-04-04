"use client";

import { useQuery, useMutation } from "convex/react";
import { useRouter, useParams } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useConvexAuth } from "convex/react";
import { CategoryForm } from "../CategoryForm";

export default function EditCategoryPage() {
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const category = useQuery(
    api.adminCategories.getCategory,
    isAuthenticated ? { id: id as Id<"categories"> } : "skip",
  );
  const updateCategory = useMutation(api.adminCategories.updateCategory);
  const deleteCategory = useMutation(api.adminCategories.deleteCategory);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-fa-canvas flex items-center justify-center">
        <p className="text-fa-subtle text-sm">Not authenticated</p>
      </div>
    );
  }

  if (category === undefined) {
    return (
      <div className="min-h-screen bg-fa-canvas flex items-center justify-center">
        <p className="text-fa-subtle text-sm">Loading…</p>
      </div>
    );
  }

  if (category === null) {
    return (
      <div className="min-h-screen bg-fa-canvas flex items-center justify-center">
        <p className="text-fa-subtle text-sm">Category not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fa-canvas text-fa-primary">
      <header className="border-b border-fa-border bg-fa-canvas/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/cockpit" className="text-fa-subtle hover:text-fa-muted text-xs">← Cockpit</a>
          <h1 className="font-bold text-sm tracking-tight">Edit: {category.label}</h1>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">
        <CategoryForm
          initial={category}
          onSave={async (data) => {
            await updateCategory({
              id: category._id,
              label: data.label,
              extractionPrompt: data.extractionPrompt,
              categorizationHint: data.categorizationHint,
              sortOrder: data.sortOrder,
            });
            router.push("/cockpit");
          }}
          onCancel={() => router.push("/cockpit")}
          onDelete={
            category.isBuiltIn
              ? undefined
              : async () => {
                  if (confirm(`Delete category "${category.label}"? This cannot be undone.`)) {
                    await deleteCategory({ id: category._id });
                    router.push("/cockpit");
                  }
                }
          }
        />
      </main>
    </div>
  );
}
