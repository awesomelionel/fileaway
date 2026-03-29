/**
 * API layer types — exported for use by Frontend Engineer.
 *
 * These mirror the JSON shapes returned by:
 *   GET  /api/items
 *   GET  /api/items/:id
 *   PATCH /api/items/:id
 */

import type { PlatformType, CategoryType, ItemStatus } from "@/lib/supabase/types";

export type { PlatformType, CategoryType, ItemStatus };

/** A single saved item as returned by the API. */
export interface SavedItemResponse {
  id: string;
  source_url: string;
  platform: PlatformType;
  category: CategoryType;
  extracted_data: Record<string, unknown> | null;
  action_taken: string | null;
  status: ItemStatus;
  thumbnail_url: string | null;
  created_at: string;
  /** Set to the updated_at timestamp once the item reaches `done` status. */
  processed_at: string | null;
}

/** Paginated list response from GET /api/items. */
export interface SavedItemListResponse {
  items: SavedItemResponse[];
  page: number;
  limit: number;
  total: number;
  has_more: boolean;
}

/** Query parameters accepted by GET /api/items. */
export interface ListItemsParams {
  /** Comma-separated list of categories to filter by. */
  category?: string;
  /** Filter by item status. */
  status?: ItemStatus;
  /** Text search across extracted_data fields. */
  q?: string;
  /** Page number (1-based). Default: 1. */
  page?: number;
  /** Max items per page. Default: 20. */
  limit?: number;
}

/** Request body for PATCH /api/items/:id. */
export interface UpdateItemRequest {
  category?: CategoryType;
  action_taken?: string;
}

/** Error response shape. */
export interface ApiError {
  error: string;
}
