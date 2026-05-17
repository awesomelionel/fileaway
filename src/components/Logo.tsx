import Link from "next/link";

type Size = "sm" | "md" | "lg";
type Variant = "default" | "ink" | "subtle";

const SIZE_SCALE: Record<Size, { mark: number; stroke: number; text: string; gap: string }> = {
  sm: { mark: 14, stroke: 1.75, text: "text-xs", gap: "gap-1.5" },
  md: { mark: 18, stroke: 2, text: "text-sm", gap: "gap-2" },
  lg: { mark: 24, stroke: 2, text: "text-base", gap: "gap-2.5" },
};

/**
 * The fileaway mark — a square bracket with a filled dot inside.
 * Bracket = capture / boundary. Dot = the kept thing.
 */
function Mark({ size, variant }: { size: Size; variant: Variant }) {
  const { mark, stroke } = SIZE_SCALE[size];
  const color =
    variant === "ink"
      ? "var(--fa-primary)"
      : variant === "subtle"
      ? "var(--fa-mid)"
      : "var(--fa-accent)";
  return (
    <svg
      width={mark}
      height={mark}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ color, flexShrink: 0 }}
    >
      {/* Left bracket */}
      <path
        d="M8 4 H4 V20 H8"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      {/* Right bracket */}
      <path
        d="M16 4 H20 V20 H16"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      {/* Filled dot — the captured item */}
      <circle cx="12" cy="12" r="2.75" fill="currentColor" />
    </svg>
  );
}

export function LogoMark({
  size = "md",
  variant = "default",
}: {
  size?: Size;
  variant?: Variant;
}) {
  return <Mark size={size} variant={variant} />;
}

/**
 * Wordmark only (no bracket). Geist Bold. The "away" sits at fa-mid for two-tone weight.
 */
export function Wordmark({ size = "md" }: { size?: Size }) {
  const { text } = SIZE_SCALE[size];
  return (
    <span className={`font-bold tracking-tight text-fa-primary ${text}`}>
      file<span className="text-fa-mid">away</span>
    </span>
  );
}

export type LogoProps = {
  size?: Size;
  variant?: Variant;
  href?: string | null;
  className?: string;
};

/**
 * Full lockup: mark + wordmark. Pass `href={null}` to render unlinked.
 */
export function Logo({ size = "md", variant = "default", href = "/", className = "" }: LogoProps) {
  const { gap } = SIZE_SCALE[size];
  const content = (
    <>
      <LogoMark size={size} variant={variant} />
      <Wordmark size={size} />
    </>
  );
  const base = `inline-flex items-center ${gap} ${className}`;
  if (href === null) {
    return <span className={base}>{content}</span>;
  }
  return (
    <Link href={href} className={`${base} group`}>
      {content}
    </Link>
  );
}
