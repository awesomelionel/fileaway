import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SavedItemResponse, SavedItemListResponse } from "@/lib/api/types";
import type { CategoryType, ItemStatus } from "@/lib/supabase/types";

const VALID_CATEGORIES = new Set<string>(["food", "fitness", "recipe", "how-to", "video-analysis", "other"]);
const VALID_STATUSES = new Set<string>(["pending", "processing", "done", "failed"]);
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

function extractThumbnailUrl(extracted_data: Record<string, unknown> | null): string | null {
  if (!extracted_data) return null;
  const url = extracted_data.thumbnailUrl ?? extracted_data.thumbnail_url ?? extracted_data.displayUrl;
  return typeof url === "string" ? url : null;
}

function toResponse(row: Record<string, unknown>): SavedItemResponse {
  const extracted_data = (row.extracted_data as Record<string, unknown> | null) ?? null;
  return {
    id: row.id as string,
    source_url: row.source_url as string,
    platform: row.platform as SavedItemResponse["platform"],
    category: row.category as CategoryType,
    extracted_data,
    action_taken: (row.action_taken as string | null) ?? null,
    status: row.status as ItemStatus,
    thumbnail_url: extractThumbnailUrl(extracted_data),
    created_at: row.created_at as string,
    processed_at: row.status === "done" ? (row.updated_at as string) : null,
  };
}

/**
 * GET /api/items
 *
 * Returns the authenticated user's saved items, paginated.
 *
 * Query parameters:
 *   category  — comma-separated list of CategoryType values
 *   status    — one ItemStatus value
 *   q         — text search across extracted_data
 *   page      — page number, 1-based (default: 1)
 *   limit     — items per page (default: 20, max: 100)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  // Parse pagination
  const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
  const rawLimit = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = (page - 1) * limit;

  // Parse filters
  const categoryParam = searchParams.get("category");
  const statusParam = searchParams.get("status");
  const q = searchParams.get("q")?.trim() ?? null;

  let categories: CategoryType[] | null = null;
  if (categoryParam) {
    const parts = categoryParam.split(",").map((c) => c.trim()).filter(Boolean);
    const valid = parts.filter((c) => VALID_CATEGORIES.has(c)) as CategoryType[];
    if (valid.length > 0) categories = valid;
  }

  let statusFilter: ItemStatus | null = null;
  if (statusParam && VALID_STATUSES.has(statusParam)) {
    statusFilter = statusParam as ItemStatus;
  }

  // Build count query — apply filters incrementally before awaiting
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let countQuery: any = supabase
    .from("saved_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (categories && categories.length === 1) {
    countQuery = countQuery.eq("category", categories[0]);
  } else if (categories && categories.length > 1) {
    countQuery = countQuery.in("category", categories);
  }
  if (statusFilter) countQuery = countQuery.eq("status", statusFilter);
  if (q) countQuery = countQuery.ilike("extracted_data::text", `%${q}%`);

  // Build data query — apply filters before order/range
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dataQuery: any = supabase
    .from("saved_items")
    .select("id, source_url, platform, category, extracted_data, action_taken, status, created_at, updated_at")
    .eq("user_id", user.id);

  if (categories && categories.length === 1) {
    dataQuery = dataQuery.eq("category", categories[0]);
  } else if (categories && categories.length > 1) {
    dataQuery = dataQuery.in("category", categories);
  }
  if (statusFilter) dataQuery = dataQuery.eq("status", statusFilter);
  if (q) dataQuery = dataQuery.ilike("extracted_data::text", `%${q}%`);

  dataQuery = dataQuery.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

  if (countResult.error || dataResult.error) {
    console.error("[GET /api/items] DB error:", countResult.error ?? dataResult.error);
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
  }

  const total = countResult.count ?? 0;
  const items = (dataResult.data ?? []).map((row) => toResponse(row as Record<string, unknown>));

  const response: SavedItemListResponse = {
    items,
    page,
    limit,
    total,
    has_more: offset + items.length < total,
  };

  return NextResponse.json(response);
}
