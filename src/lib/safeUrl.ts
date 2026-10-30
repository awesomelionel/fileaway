/**
 * Scheme allowlist for URLs that came from scrapers or model output.
 *
 * React 18 will put a `javascript:` string straight into `<a href>`. The WHATWG
 * parser (browsers and `new URL`) strips leading C0 controls and ASCII
 * whitespace, and it removes tabs and newlines anywhere in the input, so
 * `java\tscript:` and ` JAVASCRIPT:` are still `javascript:`. Parsing and then
 * checking the protocol is what matches that behavior. Relative and
 * protocol-relative inputs are rejected because no base URL is supplied.
 */

const MAX_URL_LENGTH = 2048;
const MAX_MAPS_QUERY_LENGTH = 300;

/** Suffix after `google.` / `www.google.` / `maps.google.`: `com`, `de`, `co.uk`, `com.au`. */
const GOOGLE_SUFFIX =
  /^(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2}|org\.[a-z]{2}|net\.[a-z]{2}|ac\.[a-z]{2}|gov\.[a-z]{2}|edu\.[a-z]{2})$/;

const BLOCKED_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export type SafeUrlOptions = {
  /** Saved source links may be http. Model and thumbnail URLs stay https-only. */
  allowHttp?: boolean;
};

export type MapsHrefInput = {
  url?: unknown;
  query?: unknown;
  name?: unknown;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hostnameKey(hostname: string): string {
  return hostname.toLowerCase().replace(/\.+$/, "");
}

function parseHttpUrl(value: unknown): URL | null {
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > MAX_URL_LENGTH) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username !== "" || parsed.password !== "") return null;

  const host = hostnameKey(parsed.hostname);
  if (!host) return null;
  if (host !== parsed.hostname) {
    try {
      parsed.hostname = host;
    } catch {
      return null;
    }
  }
  if (!parsed.href.startsWith(`${parsed.protocol}//`)) return null;
  return parsed;
}

/**
 * Returns a canonical http(s) URL, or null.
 * `allowHttp` is for links the save pipeline already stored as `http:`.
 */
export function safeUrl(value: unknown, options?: SafeUrlOptions): string | null {
  const parsed = parseHttpUrl(value);
  if (!parsed) return null;
  if (parsed.protocol === "https:") return parsed.href;
  if (options?.allowHttp && parsed.protocol === "http:") return parsed.href;
  return null;
}

type MapsHostKind = "maps-host" | "maps-path" | "goo-maps" | "maps-app";

function mapsHostKind(host: string): MapsHostKind | null {
  if (host === "maps.app.goo.gl") return "maps-app";
  if (host === "goo.gl") return "goo-maps";

  if (host === "maps.google.com") return "maps-host";
  if (host.startsWith("maps.google.") && GOOGLE_SUFFIX.test(host.slice("maps.google.".length))) {
    return "maps-host";
  }

  if (host === "google.com" || host === "www.google.com") return "maps-path";
  if (host.startsWith("www.google.") && GOOGLE_SUFFIX.test(host.slice("www.google.".length))) {
    return "maps-path";
  }
  if (host.startsWith("google.") && GOOGLE_SUFFIX.test(host.slice("google.".length))) {
    return "maps-path";
  }

  return null;
}

function mapsPathAllowed(kind: MapsHostKind, pathname: string): boolean {
  if (kind === "maps-host" || kind === "maps-app") return true;
  const path = pathname.toLowerCase();
  return path === "/maps" || path.startsWith("/maps/");
}

function mapsText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, MAX_MAPS_QUERY_LENGTH);
}

function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Google Maps link, or a search URL built from `query` then `name`.
 * Lookalike hosts (`google.com.evil.com`) are not Google and fall through.
 */
export function safeMapsHref(input: MapsHrefInput): string | null {
  const parsed = parseHttpUrl(input.url);
  if (parsed) {
    const kind = mapsHostKind(hostnameKey(parsed.hostname));
    if (kind && mapsPathAllowed(kind, parsed.pathname)) {
      if (parsed.protocol === "http:") parsed.protocol = "https:";
      if (parsed.protocol === "https:" && parsed.href.startsWith("https://")) {
        return parsed.href;
      }
    }
  }

  const query = mapsText(input.query) ?? mapsText(input.name);
  if (!query) return null;
  return mapsSearchUrl(query);
}

function isUrlField(key: string): boolean {
  return /url$/i.test(key);
}

function isMapsUrlField(key: string): boolean {
  return key === "google_maps_url" || key === "googleMapsUrl";
}

function sanitizeNode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeNode(item));
  if (!isPlainObject(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (BLOCKED_OBJECT_KEYS.has(key)) continue;
    if (typeof child === "string" && isUrlField(key)) {
      const safe = isMapsUrlField(key)
        ? safeMapsHref({
            url: child,
            query: value.google_maps_query ?? value.googleMapsQuery,
            name: value.name,
          })
        : safeUrl(child);
      if (safe) out[key] = safe;
      continue;
    }
    out[key] = sanitizeNode(child);
  }
  return out;
}

/** Deep-copy extracted JSON, keeping only safe URL fields. Idempotent. */
export function sanitizeExtractedUrls<T>(data: T): T {
  return sanitizeNode(data) as T;
}
