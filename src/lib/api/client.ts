/**
 * Client-side API functions for fetching and updating saved items.
 * Falls back to mock data when the API is unavailable (e.g. auth not yet wired up).
 */

import type {
  SavedItemResponse,
  SavedItemListResponse,
  ListItemsParams,
  CategoryType,
} from "@/lib/api/types";
import { MOCK_ITEMS } from "@/lib/mock-data";

function buildQueryString(params: ListItemsParams): string {
  const p = new URLSearchParams();
  if (params.category) p.set("category", params.category);
  if (params.status) p.set("status", params.status);
  if (params.q) p.set("q", params.q);
  if (params.page) p.set("page", String(params.page));
  if (params.limit) p.set("limit", String(params.limit));
  return p.toString();
}

function filterMockItems(params: ListItemsParams): SavedItemListResponse {
  let items = [...MOCK_ITEMS];

  if (params.category) {
    const cats = params.category.split(",").map((c) => c.trim());
    items = items.filter((i) => cats.includes(i.category));
  }

  if (params.status) {
    items = items.filter((i) => i.status === params.status);
  }

  if (params.q) {
    const q = params.q.toLowerCase();
    items = items.filter((i) => {
      const text = [i.source_url, JSON.stringify(i.extracted_data || {})]
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });
  }

  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const offset = (page - 1) * limit;
  const total = items.length;
  const paginated = items.slice(offset, offset + limit);

  return { items: paginated, page, limit, total, has_more: offset + paginated.length < total };
}

export async function fetchItems(params: ListItemsParams = {}): Promise<SavedItemListResponse> {
  try {
    const qs = buildQueryString(params);
    const res = await fetch(`/api/items${qs ? `?${qs}` : ""}`);
    if (res.status === 401 || !res.ok) {
      return filterMockItems(params);
    }
    return res.json() as Promise<SavedItemListResponse>;
  } catch {
    return filterMockItems(params);
  }
}

export async function patchItemCategory(
  id: string,
  category: CategoryType,
): Promise<SavedItemResponse | null> {
  try {
    const res = await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
    if (!res.ok) return null;
    return res.json() as Promise<SavedItemResponse>;
  } catch {
    return null;
  }
}
