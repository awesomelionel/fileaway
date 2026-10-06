export type FailureStage = "scrape" | "categorize" | "extract" | "save";

const FALLBACK = "Could not extract content from this link.";

const STAGE_MESSAGES: Record<FailureStage, string> = {
  scrape:
    "Could not load this post. It may be private, deleted, or temporarily unavailable.",
  categorize: "Could not classify this post. Try again in a moment.",
  extract: "Could not pull details from this post. Try again in a moment.",
  save: "Could not finish saving this post. Try again in a moment.",
};

const UNAVAILABLE = "Processing is temporarily unavailable. Try again later.";
const BUSY = "The analysis service is busy right now. Try again in a few minutes.";
const SOURCE_UNREACHABLE = "Could not reach the source. Check the link and try again.";
const ANALYSIS_UNREACHABLE =
  "Could not reach the analysis service. Try again in a moment.";

const MAX_REASON_LENGTH = 240;

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "";
}

function looksLikeConfigOrSecret(message: string): boolean {
  return (
    message.includes("not configured") ||
    message.includes("api_key") ||
    message.includes("api key") ||
    message.includes("api_token") ||
    message.includes("api token") ||
    message.includes("bearer") ||
    message.includes("authorization") ||
    message.includes("gemini_api") ||
    message.includes("apify_api") ||
    message.includes("x_bearer") ||
    /sk-[a-z0-9]/i.test(message)
  );
}

function looksLikeRateLimit(message: string): boolean {
  return (
    message.includes("429") ||
    message.includes("resource_exhausted") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  );
}

function looksLikeNetwork(message: string): boolean {
  return (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("enotfound") ||
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("socket hang up") ||
    message.includes("getaddrinfo")
  );
}

/** Maps a pipeline error to a short message that is safe to show in the UI. */
export function userFacingFailureReason(err: unknown, stage: FailureStage): string {
  const message = errorText(err).toLowerCase();

  if (looksLikeConfigOrSecret(message)) return UNAVAILABLE;
  if (looksLikeRateLimit(message)) return BUSY;
  if (looksLikeNetwork(message)) {
    return stage === "scrape" ? SOURCE_UNREACHABLE : ANALYSIS_UNREACHABLE;
  }

  return STAGE_MESSAGES[stage] ?? FALLBACK;
}

/**
 * Last-line check before persisting. Drops anything that looks like a secret,
 * stack, or raw provider payload and always returns a short user-safe string.
 */
export function sanitizeFailureReason(reason: string | undefined): string {
  const cleaned = (reason ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const lower = cleaned.toLowerCase();
  const unsafe =
    !cleaned ||
    cleaned.length > MAX_REASON_LENGTH ||
    looksLikeConfigOrSecret(lower) ||
    lower.includes("stack") ||
    /\bat\s+\S+\s+\(/.test(cleaned) ||
    lower.includes("error:") ||
    lower.includes("exception");

  if (unsafe) return FALLBACK;
  return cleaned;
}
