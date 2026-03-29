import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SavedItemResponse, UpdateItemRequest } from "@/lib/api/types";
import type { CategoryType, ItemStatus } from "@/lib/supabase/types";

const VALID_CATEGORIES = new Set<string>(["food", "fitness", "recipe", "how-to", "video-analysis", "other"]);

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

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/items/:id
 *
 * Returns full detail for one saved item belonging to the authenticated user.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("saved_items")
    .select("id, source_url, platform, category, extracted_data, action_taken, status, created_at, updated_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    console.error("[GET /api/items/:id] DB error:", error);
    return NextResponse.json({ error: "Failed to fetch item" }, { status: 500 });
  }

  return NextResponse.json(toResponse(data as Record<string, unknown>));
}

/**
 * PATCH /api/items/:id
 *
 * Allows the authenticated user to override `category` and/or `action_taken`.
 *
 * Body: { category?: CategoryType, action_taken?: string }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: UpdateItemRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { category, action_taken } = body;

  if (category === undefined && action_taken === undefined) {
    return NextResponse.json({ error: "At least one of category or action_taken is required" }, { status: 400 });
  }

  if (category !== undefined && !VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: `Invalid category: ${category}` }, { status: 400 });
  }

  if (action_taken !== undefined && typeof action_taken !== "string") {
    return NextResponse.json({ error: "action_taken must be a string" }, { status: 400 });
  }

  const updates: Partial<{ category: CategoryType; action_taken: string }> = {};
  if (category !== undefined) updates.category = category;
  if (action_taken !== undefined) updates.action_taken = action_taken;

  const { data, error } = await supabase
    .from("saved_items")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, source_url, platform, category, extracted_data, action_taken, status, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    console.error("[PATCH /api/items/:id] DB error:", error);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }

  return NextResponse.json(toResponse(data as Record<string, unknown>));
}
