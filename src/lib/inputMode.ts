export function isLikelyUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(trimmed);
}

export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function extractShareUrl(input: {
  webUrl?: string | null;
  text?: string | null;
}): string | null {
  if (input.webUrl && isLikelyUrl(input.webUrl.trim())) {
    return normalizeUrl(input.webUrl.trim());
  }
  const text = input.text?.trim();
  if (!text) return null;
  if (isLikelyUrl(text)) return normalizeUrl(text);
  const token = text.split(/\s+/).find((t) => isLikelyUrl(t));
  return token ? normalizeUrl(token) : null;
}
