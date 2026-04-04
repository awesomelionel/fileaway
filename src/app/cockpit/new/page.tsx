"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import { useConvexAuth } from "convex/react";
import { CategoryForm } from "../CategoryForm";

export default function NewCategoryPage() {
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const createCategory = useMutation(api.adminCategories.createCategory);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-fa-canvas flex items-center justify-center">
        <p className="text-fa-subtle text-sm">Not authenticated</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fa-canvas text-fa-primary">
      <header className="border-b border-fa-border bg-fa-canvas/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/cockpit" className="text-fa-subtle hover:text-fa-muted text-xs">← Cockpit</a>
          <h1 className="font-bold text-sm tracking-tight">New Category</h1>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">
        <CategoryForm
          onSave={async (data) => {
            await createCategory(data);
            router.push("/cockpit");
          }}
          onCancel={() => router.push("/cockpit")}
        />
      </main>
    </div>
  );
}
