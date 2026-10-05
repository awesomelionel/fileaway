import { isLikelyUrl, normalizeUrl } from "./inputMode";

/** Platforms the save pipeline can actually scrape. YouTube is recognized only to reject it. */
export type ScrapablePlatform = "tiktok" | "instagram" | "twitter";

export type SavePlatform = ScrapablePlatform | "youtube" | "other";

export const SAVE_URL_MESSAGES = {
  invalid: "Enter a valid link.",
  youtube:
    "YouTube links aren't supported yet. Save a TikTok, Instagram, or X post.",
  unsupported:
    "That link isn't supported yet. Save a TikTok, Instagram, or X post.",
} as const;

const MAX_URL_LENGTH = 2048;

export type SaveUrlResult =
  | { ok: true; url: string; platform: ScrapablePlatform }
  | { ok: false; message: string; platform: SavePlatform | null };

function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/** Hostname match only, so lookalikes like nottiktok.com or evil.com/tiktok.com are not accepted. */
export function platformFromHostname(hostname: string): SavePlatform {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return "other";
  if (hostMatches(host, "tiktok.com")) return "tiktok";
  if (hostMatches(host, "instagram.com")) return "instagram";
  if (hostMatches(host, "youtube.com") || hostMatches(host, "youtu.be")) return "youtube";
  if (hostMatches(host, "twitter.com") || hostMatches(host, "x.com")) return "twitter";
  return "other";
}

/**
 * Shared save-url gate used by the client and `items.save`.
 * Reuses `isLikelyUrl` / `normalizeUrl`, then keeps only http(s) TikTok, Instagram, and X/Twitter links.
 * The returned `url` is the canonical `URL.href` (scheme and host normalized) so dedupe is stable.
 */
export function prepareSaveUrl(value: string): SaveUrlResult {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH || !isLikelyUrl(trimmed)) {
    return { ok: false, message: SAVE_URL_MESSAGES.invalid, platform: null };
  }

  let parsed: URL;
  try {
    parsed = new URL(normalizeUrl(trimmed));
  } catch {
    return { ok: false, message: SAVE_URL_MESSAGES.invalid, platform: null };
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    !parsed.hostname ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
    return { ok: false, message: SAVE_URL_MESSAGES.invalid, platform: null };
  }

  const platform = platformFromHostname(parsed.hostname);
  if (platform === "youtube") {
    return { ok: false, message: SAVE_URL_MESSAGES.youtube, platform };
  }
  if (platform === "tiktok" || platform === "instagram" || platform === "twitter") {
    return { ok: true, url: parsed.href, platform };
  }
  return { ok: false, message: SAVE_URL_MESSAGES.unsupported, platform: "other" };
}

/** Newest-first matches: the first row that is not `archived: true` is reused. Missing `archived` counts as active. */
export function reusableSavedItem<T>(matches: readonly T[]): T | null {
  return (
    matches.find((item) => {
      if (typeof item !== "object" || item === null || !("archived" in item)) return true;
      return (item as { archived?: boolean }).archived !== true;
    }) ?? null
  );
}

/** User-facing copy when a new save is over the per-user limit. `retryAfterMs` comes from the rate limiter. */
export function formatSaveRateLimit(retryAfterMs: number): string {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  if (seconds < 60) {
    return `You're saving links too quickly. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `You're saving links too quickly. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/**
 * Prefer ConvexError `data` (a string message from `items.save`).
 * Plain server Errors arrive wrapped as `[CONVEX M(...)] Uncaught Error: ...`.
 */
export function messageFromSaveError(err: unknown): string {
  if (typeof err === "object" && err !== null && "data" in err) {
    const data = (err as { data?: unknown }).data;
    if (typeof data === "string" && data.trim()) return data;
    if (
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof (data as { message: unknown }).message === "string"
    ) {
      const message = (data as { message: string }).message.trim();
      if (message) return message;
    }
  }
  if (err instanceof Error) {
    const match = err.message.match(/Uncaught (?:ConvexError|Error):\s*([^\n]+)/);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return "Couldn't save that link. Try again.";
}
