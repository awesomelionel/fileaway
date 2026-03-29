export type PlatformType = "tiktok" | "instagram" | "youtube" | "twitter" | "other";
export type CategoryType = "food" | "fitness" | "recipe" | "how-to" | "video-analysis" | "other";
export type ItemStatus = "pending" | "processing" | "done" | "failed";

export interface SavedItem {
  id: string;
  user_id: string;
  source_url: string;
  platform: PlatformType;
  category: CategoryType;
  raw_content: Record<string, unknown> | null;
  extracted_data: Record<string, unknown> | null;
  action_taken: string | null;
  user_correction: string | null;
  status: ItemStatus;
  created_at: string;
  updated_at: string;
}

export type NewSavedItem = Pick<SavedItem, "user_id" | "source_url"> &
  Partial<Omit<SavedItem, "id" | "user_id" | "source_url" | "created_at" | "updated_at">>;

/** Supabase Database shape used by integration tests. */
export interface Database {
  public: {
    Tables: {
      saved_items: {
        Row: SavedItem;
        Insert: NewSavedItem;
        Update: Partial<Omit<SavedItem, "id" | "created_at">>;
      };
    };
  };
}
