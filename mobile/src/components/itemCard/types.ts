export type PlatformType = "tiktok" | "instagram" | "youtube" | "twitter" | "other";
export type ItemStatus = "pending" | "processing" | "done" | "failed";

/** A single saved item as returned by `api.items.list` (snake_case, matches `convex/items.ts` `toResponse`). */
export interface FeedItem {
  id: string;
  source_url: string;
  platform: PlatformType;
  category: string;
  extracted_data: Record<string, unknown> | null;
  action_taken: string | null;
  user_correction: string | null;
  status: ItemStatus;
  archived: boolean;
  thumbnail_url: string | null;
  created_at: string;
  processed_at: string | null;
}

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  food: { label: "Food", color: "#f97316" },
  recipe: { label: "Recipe", color: "#22c55e" },
  fitness: { label: "Fitness", color: "#ef4444" },
  "how-to": { label: "How-To", color: "#3b82f6" },
  "video-analysis": { label: "Video", color: "#a855f7" },
  travel: { label: "Travel", color: "#14b8a6" },
  other: { label: "Other", color: "#6b7280" },
};

export function getCategoryMeta(slug: string): { label: string; color: string } {
  return (
    CATEGORY_META[slug] ?? {
      label: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " "),
      color: "#6b7280",
    }
  );
}

export const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  twitter: "X/Twitter",
  other: "Web",
};

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

/** How-to steps may arrive as `steps` (string[]), or `shots` (object[]), or `key_points`. */
export function extractHowToSteps(data: Record<string, unknown>): string[] {
  const steps = data.steps as string[] | undefined;
  if (steps?.length) return steps;
  const shots = data.shots as Array<{ description?: string; detail?: string }> | undefined;
  if (shots?.length) {
    return shots.map((s) => [s.description, s.detail].filter(Boolean).join(" — "));
  }
  const keyPoints = data.key_points as string[] | undefined;
  return keyPoints ?? [];
}
