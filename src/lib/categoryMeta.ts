import type { CSSProperties } from "react";

/**
 * Category color for cards, chips, filters, and the dashboard.
 *
 * Built-ins point at the `--fa-cat-*` tokens in globals.css, so light and dark
 * mode stay on the existing palette. Custom categories cannot use runtime
 * Tailwind class names (`border-l-[${color}]` is never emitted). Callers set
 * `--cat-accent` on the element and use the static `.cat-accent-*` classes.
 */

export type CategoryMeta = {
  label: string;
  builtIn: boolean;
  /** Text, border, and fill in light mode. A CSS variable for built-ins. */
  color: string;
  /** Chip / tinted background in light mode. */
  background: string;
  /** Text, border, and fill in dark mode. */
  colorDark: string;
  /** Chip / tinted background in dark mode. */
  backgroundDark: string;
};

export type CategoryMetaOptions = {
  /** Palette slot used when `color` is missing. Omitted → stable hash of the slug. */
  index?: number;
  /** Admin-configured color. Invalid values fall back to the palette. */
  color?: string | null;
};

type Rgb = { r: number; g: number; b: number };

const BUILT_IN_CATEGORY_META: Record<string, { label: string; color: string; background: string }> = {
  food: { label: "Food", color: "var(--fa-cat-food)", background: "var(--fa-cat-food-soft)" },
  recipe: { label: "Recipe", color: "var(--fa-cat-recipe)", background: "var(--fa-cat-recipe-soft)" },
  fitness: { label: "Fitness", color: "var(--fa-cat-fitness)", background: "var(--fa-cat-fitness-soft)" },
  "how-to": { label: "How-To", color: "var(--fa-cat-howto)", background: "var(--fa-cat-howto-soft)" },
  "video-analysis": { label: "Video", color: "var(--fa-cat-video)", background: "var(--fa-cat-video-soft)" },
  travel: { label: "Travel", color: "var(--fa-cat-travel)", background: "var(--fa-cat-travel-soft)" },
  other: { label: "Other", color: "var(--fa-cat-other)", background: "var(--fa-cat-other-soft)" },
};

/** Distinct hues for admin-added categories. Mid-dark so they read on paper; dark mode lightens them. */
export const CUSTOM_CATEGORY_PALETTE = [
  "#a83253",
  "#7c3a8b",
  "#2c6e9f",
  "#5c7a1c",
  "#a96b1a",
  "#1b6b6b",
] as const;

export const BUILT_IN_CATEGORY_SLUGS = Object.keys(BUILT_IN_CATEGORY_META);

const BUILT_IN_SLUGS = new Set(BUILT_IN_CATEGORY_SLUGS);
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const INK: Rgb = { r: 0x14, g: 0x11, b: 0x0c };
const WHITE: Rgb = { r: 255, g: 255, b: 255 };

export const CATEGORY_META: Record<string, CategoryMeta> = Object.fromEntries(
  Object.entries(BUILT_IN_CATEGORY_META).map(([slug, meta]) => [slug, builtInMeta(meta)]),
);

function builtInMeta(meta: { label: string; color: string; background: string }): CategoryMeta {
  return {
    label: meta.label,
    builtIn: true,
    color: meta.color,
    background: meta.background,
    colorDark: meta.color,
    backgroundDark: meta.background,
  };
}

/** Accept #rgb, #rgba, #rrggbb, and #rrggbbaa. Anything else is rejected so it cannot be injected into CSS. */
export function normalizeCategoryColor(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!HEX_COLOR.test(value)) return null;
  let body = value.slice(1).toLowerCase();
  if (body.length <= 4) {
    body = body
      .slice(0, 3)
      .split("")
      .map((channel) => channel + channel)
      .join("");
  } else {
    body = body.slice(0, 6);
  }
  return `#${body}`;
}

function parseHex(hex: string): Rgb {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function formatHex({ r, g, b }: Rgb): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const linear = (channel: number) => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function mixToward(hex: string, target: Rgb, amount: number): string {
  const source = parseHex(hex);
  const mix = (from: number, to: number) => Math.round(from + (to - from) * amount);
  return formatHex({
    r: mix(source.r, target.r),
    g: mix(source.g, target.g),
    b: mix(source.b, target.b),
  });
}

/** Keep a configured hue, but pull extremes back so text stays visible on paper or near-black. */
function readableOnLight(hex: string): string {
  return relativeLuminance(hex) > 0.55 ? mixToward(hex, INK, 0.45) : hex;
}

function readableOnDark(hex: string): string {
  return relativeLuminance(hex) < 0.28 ? mixToward(hex, WHITE, 0.5) : hex;
}

function hashSlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function paletteColor(slug: string, index?: number): string {
  const slot =
    typeof index === "number" && Number.isInteger(index) && index >= 0
      ? index
      : hashSlug(slug);
  return CUSTOM_CATEGORY_PALETTE[slot % CUSTOM_CATEGORY_PALETTE.length];
}

function labelFromSlug(slug: string): string {
  if (!slug) return "Other";
  return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");
}

function customMeta(slug: string, options: CategoryMetaOptions): CategoryMeta {
  const configured = normalizeCategoryColor(options.color);
  const base = configured ?? paletteColor(slug, options.index);
  const color = readableOnLight(base);
  const colorDark = readableOnDark(base);
  return {
    label: labelFromSlug(slug),
    builtIn: false,
    color,
    colorDark,
    background: `color-mix(in srgb, ${color} 18%, transparent)`,
    backgroundDark: `color-mix(in srgb, ${colorDark} 32%, transparent)`,
  };
}

export function getCategoryMeta(
  slug: string,
  indexOrOptions?: number | CategoryMetaOptions,
): CategoryMeta {
  const options: CategoryMetaOptions =
    typeof indexOrOptions === "number" ? { index: indexOrOptions } : (indexOrOptions ?? {});
  const key = slug.trim().toLowerCase();
  const builtIn = BUILT_IN_CATEGORY_META[key];
  if (builtIn) return builtInMeta(builtIn);
  return customMeta(key, options);
}

export type CategoryAccentStyle = CSSProperties & {
  "--cat-accent": string;
  "--cat-accent-soft": string;
  "--cat-accent-dark"?: string;
  "--cat-accent-soft-dark"?: string;
};

/** CSS variables consumed by `.cat-accent-*` in globals.css. */
export function categoryAccentStyle(meta: CategoryMeta): CategoryAccentStyle {
  return {
    "--cat-accent": meta.color,
    "--cat-accent-soft": meta.background,
    ...(meta.builtIn
      ? {}
      : {
          "--cat-accent-dark": meta.colorDark,
          "--cat-accent-soft-dark": meta.backgroundDark,
        }),
  };
}

/**
 * Dashboard category rows. Prefer the saved catalog (includes travel and custom
 * categories at zero). Otherwise show built-ins plus any slugs that have counts.
 */
export function dashboardCategorySlugs(
  byCategory: Record<string, number>,
  rows?: { slug: string }[] | null,
): string[] {
  const extras = (seen: Set<string>) =>
    Object.keys(byCategory)
      .filter((slug) => slug && !seen.has(slug))
      .sort();

  if (rows && rows.length > 0) {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const row of rows) {
      const slug = row.slug?.trim();
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      ordered.push(slug);
    }
    const missingBuiltIns = BUILT_IN_CATEGORY_SLUGS.filter((slug) => !seen.has(slug));
    for (const slug of missingBuiltIns) seen.add(slug);
    return [...ordered, ...missingBuiltIns, ...extras(seen)];
  }

  return [...BUILT_IN_CATEGORY_SLUGS, ...extras(BUILT_IN_SLUGS)];
}
