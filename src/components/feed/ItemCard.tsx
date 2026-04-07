"use client";

import { useState } from "react";
import Image from "next/image";
import type { SavedItemResponse, CategoryType } from "@/lib/api/types";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// ─── Category metadata ───────────────────────────────────────────────────────

const BUILT_IN_CATEGORY_META: Record<
  string,
  { label: string; color: string; border: string; bg: string; text: string }
> = {
  food: { label: "Food", color: "#f97316", border: "border-l-[#f97316]", bg: "bg-[#f9731610]", text: "text-[#f97316]" },
  recipe: { label: "Recipe", color: "#22c55e", border: "border-l-[#22c55e]", bg: "bg-[#22c55e10]", text: "text-[#22c55e]" },
  fitness: { label: "Fitness", color: "#3b82f6", border: "border-l-[#3b82f6]", bg: "bg-[#3b82f610]", text: "text-[#3b82f6]" },
  "how-to": { label: "How-To", color: "#a855f7", border: "border-l-[#a855f7]", bg: "bg-[#a855f710]", text: "text-[#a855f7]" },
  "video-analysis": { label: "Video", color: "#14b8a6", border: "border-l-[#14b8a6]", bg: "bg-[#14b8a610]", text: "text-[#14b8a6]" },
  other: { label: "Other", color: "#6b7280", border: "border-l-[#6b7280]", bg: "bg-[#6b728010]", text: "text-[#6b7280]" },
};

const FALLBACK_COLORS = ["#e11d48", "#d946ef", "#0ea5e9", "#84cc16", "#f59e0b", "#06b6d4"];

export function getCategoryMeta(
  slug: string,
  index?: number,
): { label: string; color: string; border: string; bg: string; text: string } {
  if (BUILT_IN_CATEGORY_META[slug]) return BUILT_IN_CATEGORY_META[slug];
  const color = FALLBACK_COLORS[(index ?? 0) % FALLBACK_COLORS.length];
  return {
    label: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " "),
    color,
    border: `border-l-[${color}]`,
    bg: `bg-[${color}10]`,
    text: `text-[${color}]`,
  };
}

export const CATEGORY_META = BUILT_IN_CATEGORY_META;

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  twitter: "X/Twitter",
  other: "Web",
};

// ─── Helper components ────────────────────────────────────────────────────────

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${className}`}
    >
      {children}
    </span>
  );
}

function RelativeTime({ iso }: { iso: string }) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const label =
    days > 0 ? `${days}d ago` : hours > 0 ? `${hours}h ago` : mins > 0 ? `${mins}m ago` : "just now";
  return <span className="text-[11px] text-fa-subtle">{label}</span>;
}

function ThumbnailBanner({
  thumbnailUrl,
  sourceUrl,
}: {
  thumbnailUrl: string;
  sourceUrl: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full overflow-hidden relative h-40"
      onClick={(e) => e.stopPropagation()}
    >
      <Image
        src={thumbnailUrl}
        alt=""
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="object-cover transition-opacity duration-200 hover:opacity-85"
        unoptimized
      />
    </a>
  );
}

// ─── Category-specific card bodies ───────────────────────────────────────────

function FoodBody({ data }: { data: Record<string, unknown> }) {
  const name = data.name as string | undefined;
  const address = data.address as string | undefined;
  const cuisine = data.cuisine as string | undefined;
  const whyVisit = data.why_visit as string | undefined;
  const priceRange = data.price_range as string | undefined;

  return (
    <div className="space-y-2">
      {name && <p className="font-semibold text-fa-primary leading-tight">{name}</p>}
      <div className="flex flex-wrap gap-2">
        {cuisine && (
          <span className="text-xs text-fa-dim bg-fa-chip px-2 py-0.5 rounded">{cuisine}</span>
        )}
        {priceRange && (
          <span className="text-xs text-[#f97316] font-mono bg-fa-chip px-2 py-0.5 rounded">
            {priceRange}
          </span>
        )}
      </div>
      {address && (
        <p className="text-xs text-fa-secondary-alt flex items-start gap-1">
          <span className="mt-0.5">📍</span>
          <span>{address}</span>
        </p>
      )}
      {whyVisit && (
        <p className="text-xs text-fa-soft leading-relaxed border-l-2 border-[#f97316]/30 pl-2 italic">
          {whyVisit}
        </p>
      )}
    </div>
  );
}

function RecipeBody({ data }: { data: Record<string, unknown> }) {
  const dishName = data.dish_name as string | undefined;
  const ingredients = data.ingredients as string[] | undefined;
  const prepTime = data.prep_time_minutes as number | undefined;
  const cookTime = data.cook_time_minutes as number | undefined;
  const servings = data.servings as number | undefined;

  return (
    <div className="space-y-2">
      {dishName && <p className="font-semibold text-fa-primary leading-tight">{dishName}</p>}
      <div className="flex gap-3 text-[11px] text-fa-secondary-alt">
        {prepTime !== undefined && <span>Prep {prepTime}m</span>}
        {cookTime !== undefined && cookTime > 0 && <span>Cook {cookTime}m</span>}
        {servings !== undefined && <span>Serves {servings}</span>}
      </div>
      {ingredients && ingredients.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle mb-1">
            Ingredients
          </p>
          <ul className="space-y-0.5">
            {ingredients.slice(0, 5).map((ing, i) => (
              <li key={i} className="text-xs text-fa-soft flex items-start gap-1.5">
                <span className="text-[#22c55e] mt-0.5 flex-shrink-0">·</span>
                {ing}
              </li>
            ))}
            {ingredients.length > 5 && (
              <li className="text-[11px] text-fa-subtle">+{ingredients.length - 5} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function FitnessBody({ data }: { data: Record<string, unknown> }) {
  const workoutName = data.workout_name as string | undefined;
  const exercises = data.exercises as Array<{
    name: string;
    sets: number;
    reps: number | string;
  }> | undefined;
  const muscleGroups = data.muscle_groups as string[] | undefined;
  const duration = data.duration_minutes as number | undefined;
  const difficulty = data.difficulty as string | undefined;

  return (
    <div className="space-y-2">
      {workoutName && <p className="font-semibold text-fa-primary leading-tight">{workoutName}</p>}
      <div className="flex gap-3 flex-wrap">
        {duration && (
          <span className="text-xs text-[#3b82f6] bg-[#3b82f610] px-2 py-0.5 rounded font-mono">
            {duration}m
          </span>
        )}
        {difficulty && (
          <span className="text-xs text-fa-dim bg-fa-chip px-2 py-0.5 rounded">{difficulty}</span>
        )}
      </div>
      {muscleGroups && muscleGroups.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {muscleGroups.map((g) => (
            <span key={g} className="text-[10px] text-[#3b82f6]/70 bg-[#3b82f608] border border-[#3b82f620] px-1.5 py-0.5 rounded">
              {g}
            </span>
          ))}
        </div>
      )}
      {exercises && exercises.length > 0 && (
        <div className="space-y-1">
          {exercises.slice(0, 4).map((ex, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-fa-mid">{ex.name}</span>
              <span className="text-[#3b82f6] font-mono text-[11px]">
                {ex.sets > 1 ? `${ex.sets}×` : ""}{ex.reps}
              </span>
            </div>
          ))}
          {exercises.length > 4 && (
            <p className="text-[11px] text-fa-subtle">+{exercises.length - 4} more exercises</p>
          )}
        </div>
      )}
    </div>
  );
}

function HowToBody({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string | undefined;
  const summary = data.summary as string | undefined;
  const steps = data.steps as string[] | undefined;

  return (
    <div className="space-y-2">
      {title && <p className="font-semibold text-fa-primary leading-tight">{title}</p>}
      {summary && <p className="text-xs text-fa-dim leading-relaxed">{summary}</p>}
      {steps && steps.length > 0 && (
        <div className="space-y-1">
          {steps.slice(0, 4).map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="text-[10px] text-[#a855f7] font-mono font-bold flex-shrink-0 mt-0.5 w-4">
                {i + 1}.
              </span>
              <span className="text-fa-soft leading-relaxed">{step}</span>
            </div>
          ))}
          {steps.length > 4 && (
            <p className="text-[11px] text-fa-subtle pl-6">+{steps.length - 4} more steps</p>
          )}
        </div>
      )}
    </div>
  );
}

function VideoBody({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string | undefined;
  const summary = data.summary as string | undefined;
  const keyPoints = data.key_points as string[] | undefined;

  return (
    <div className="space-y-2">
      {title && <p className="font-semibold text-fa-primary leading-tight text-sm">{title}</p>}
      {summary && (
        <p className="text-xs text-fa-soft leading-relaxed line-clamp-3">{summary}</p>
      )}
      {keyPoints && keyPoints.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle">Key Points</p>
          {keyPoints.slice(0, 3).map((pt, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs">
              <span className="text-[#14b8a6] flex-shrink-0 mt-0.5">→</span>
              <span className="text-fa-dim">{pt}</span>
            </div>
          ))}
          {keyPoints.length > 3 && (
            <p className="text-[11px] text-fa-subtle pl-4">+{keyPoints.length - 3} more</p>
          )}
        </div>
      )}
    </div>
  );
}

function OtherBody({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string | undefined;
  const summary = data.summary as string | undefined;

  return (
    <div className="space-y-2">
      {title && <p className="font-semibold text-fa-primary leading-tight">{title}</p>}
      {summary && (
        <p className="text-xs text-fa-soft leading-relaxed">{summary}</p>
      )}
    </div>
  );
}

function GenericBody({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined);
  return (
    <div className="space-y-2">
      {entries.slice(0, 8).map(([key, value]) => {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        if (Array.isArray(value)) {
          return (
            <div key={key}>
              <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle mb-1">{label}</p>
              <ul className="space-y-0.5">
                {(value as unknown[]).slice(0, 5).map((item, i) => (
                  <li key={i} className="text-xs text-fa-soft flex items-start gap-1.5">
                    <span className="text-fa-faint mt-0.5 flex-shrink-0">·</span>
                    {typeof item === "object" ? JSON.stringify(item) : String(item)}
                  </li>
                ))}
                {value.length > 5 && <li className="text-[11px] text-fa-subtle">+{value.length - 5} more</li>}
              </ul>
            </div>
          );
        }
        if (typeof value === "object") return null;
        return (
          <div key={key}>
            <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle">{label}</p>
            <p className="text-xs text-fa-soft leading-relaxed">{String(value)}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Pending / Failed states ──────────────────────────────────────────────────

function PendingBody({ url }: { url: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-fa-icon-muted">Queued for processing…</p>
      <p className="text-[11px] text-fa-faint font-mono truncate">{url}</p>
      <div className="flex gap-1.5 items-center">
        <div className="h-1.5 w-1.5 rounded-full bg-[#f59e0b] animate-pulse" />
        <span className="text-[11px] text-[#f59e0b]">Waiting in queue</span>
      </div>
    </div>
  );
}

function ProcessingBody({ url }: { url: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-fa-muted">AI is analyzing this link…</p>
      <p className="text-[11px] text-fa-faint font-mono truncate">{url}</p>
      <div className="flex gap-1.5 items-center">
        <svg
          className="h-3 w-3 animate-spin text-[#6366f1]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-[11px] text-[#6366f1]">Processing now</span>
      </div>
    </div>
  );
}

function FailedBody({
  url,
  onRetry,
}: {
  url: string;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-[#ef4444]">Could not extract content</p>
      <p className="text-[11px] text-fa-faint font-mono truncate">{url}</p>
      <button
        onClick={onRetry}
        className="text-xs px-3 py-1.5 rounded bg-[#ef444415] text-[#ef4444] border border-[#ef444430] font-medium hover:bg-[#ef444425] transition-colors min-h-[44px] sm:min-h-0"
      >
        Retry
      </button>
    </div>
  );
}

// ─── Action buttons ───────────────────────────────────────────────────────────

interface ActionResult {
  success: boolean;
  label: string;
}

function useAction() {
  const [result, setResult] = useState<ActionResult | null>(null);

  const fire = (fn: () => void, label: string) => {
    fn();
    setResult({ success: true, label });
    setTimeout(() => setResult(null), 2000);
  };

  return { result, fire };
}

function ActionButton({
  item,
  category,
  onCardClick,
}: {
  item: SavedItemResponse;
  category: CategoryType;
  onCardClick?: (id: string) => void;
}) {
  const { result, fire } = useAction();

  const copyText = (text: string) =>
    navigator.clipboard.writeText(text).catch(() => {});

  if (result) {
    return (
      <button
        disabled
        className="text-xs px-3 py-1.5 rounded bg-[#1a2b1a] text-[#22c55e] border border-[#22c55e30] font-medium min-h-[44px] sm:min-h-0"
      >
        ✓ {result.label}
      </button>
    );
  }

  if (category === "food") {
    const address = (item.extracted_data?.address as string | undefined) ?? "";
    const name = (item.extracted_data?.name as string | undefined) ?? "";
    const query = encodeURIComponent(`${name} ${address}`.trim());
    return (
      <a
        href={`https://maps.google.com/?q=${query}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex text-xs px-3 py-1.5 rounded bg-[#f9731615] text-[#f97316] border border-[#f9731630] font-medium hover:bg-[#f9731625] transition-colors min-h-[44px] sm:min-h-0"
      >
        Open in Maps ↗
      </a>
    );
  }

  if (category === "recipe") {
    const ingredients = item.extracted_data?.ingredients as string[] | undefined;
    const text = ingredients
      ? `${item.extracted_data?.dish_name ?? "Recipe"}\n\n${ingredients.join("\n")}`
      : "";
    return (
      <button
        onClick={() => fire(() => copyText(text), "Copied!")}
        className="text-xs px-3 py-1.5 rounded bg-[#22c55e15] text-[#22c55e] border border-[#22c55e30] font-medium hover:bg-[#22c55e25] transition-colors min-h-[44px] sm:min-h-0"
      >
        Copy ingredients
      </button>
    );
  }

  if (category === "fitness") {
    const exercises = item.extracted_data?.exercises as Array<{
      name: string;
      sets: number;
      reps: number | string;
    }> | undefined;
    return (
      <button
        onClick={() =>
          fire(() => {
            if (!exercises) return;
            const existing = JSON.parse(
              localStorage.getItem("fileaway-routine") ?? "[]",
            ) as Array<unknown>;
            localStorage.setItem(
              "fileaway-routine",
              JSON.stringify([...existing, ...exercises]),
            );
          }, "Saved to routine!")
        }
        className="text-xs px-3 py-1.5 rounded bg-[#3b82f615] text-[#3b82f6] border border-[#3b82f630] font-medium hover:bg-[#3b82f625] transition-colors min-h-[44px] sm:min-h-0"
      >
        Save to routine
      </button>
    );
  }

  if (category === "how-to") {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onCardClick?.(item.id); }}
        className="text-xs px-3 py-1.5 rounded bg-[#a855f715] text-[#a855f7] border border-[#a855f730] font-medium hover:bg-[#a855f725] transition-colors min-h-[44px] sm:min-h-0"
      >
        View guide ↗
      </button>
    );
  }

  if (category === "video-analysis") {
    const summary = item.extracted_data?.summary as string | undefined;
    const title = item.extracted_data?.title as string | undefined;
    const text = [title, summary].filter(Boolean).join("\n\n");
    return (
      <button
        onClick={() => fire(() => copyText(text), "Copied!")}
        className="text-xs px-3 py-1.5 rounded bg-[#14b8a615] text-[#14b8a6] border border-[#14b8a630] font-medium hover:bg-[#14b8a625] transition-colors min-h-[44px] sm:min-h-0"
      >
        Copy summary
      </button>
    );
  }

  // other
  const summary = item.extracted_data?.summary as string | undefined;
  const title = item.extracted_data?.title as string | undefined;
  const text = [title, summary].filter(Boolean).join("\n\n");
  return (
    <button
      onClick={() => fire(() => copyText(text), "Copied!")}
      className="text-xs px-3 py-1.5 rounded bg-[#6b728015] text-[#9ca3af] border border-[#6b728030] font-medium hover:bg-[#6b728025] transition-colors min-h-[44px] sm:min-h-0"
    >
      Copy summary
    </button>
  );
}

// ─── Correction modal ─────────────────────────────────────────────────────────

function CorrectionModal({
  item,
  categories,
  onClose,
}: {
  item: SavedItemResponse;
  categories?: { slug: string; label: string }[];
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>(
    item.category
  );
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const saveCorrection = useMutation(api.items.saveCorrection);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setStatus("saving");
    try {
      await saveCorrection({
        id: item.id as Id<"savedItems">,
        note: note.trim(),
        correctedCategory:
          selectedCategory !== item.category ? selectedCategory : undefined,
      });
      setStatus("done");
      setTimeout(onClose, 1200);
    } catch (err: unknown) {
      setStatus("idle");
      setErrorMsg(err instanceof Error ? err.message : "Failed to save. Please try again.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 pt-16 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-fa-surface border border-fa-line rounded-xl shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-fa-separator">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#ef4444] mb-1">
              Report correction
            </p>
            <h2 className="text-sm font-semibold text-fa-primary">
              What&apos;s wrong with this?
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-fa-subtle hover:text-fa-dim text-lg leading-none mt-0.5 ml-4 flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {status === "done" ? (
          <div className="p-5 text-center">
            <p className="text-[#22c55e] text-sm font-medium">
              ✓ Thanks! We&apos;ll learn from this.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Category correction */}
            <div>
              <label className="block text-[11px] font-medium text-fa-subtle uppercase tracking-wider mb-1.5">
                Correct category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) =>
                  setSelectedCategory(e.target.value as CategoryType)
                }
                className="w-full bg-fa-input border border-fa-line rounded-lg px-3 py-2 text-sm text-fa-primary outline-none focus:border-fa-ring"
              >
                {(categories ?? []).map((cat) => (
                  <option key={cat.slug} value={cat.slug} className="bg-fa-muted-bg">
                    {cat.label}{cat.slug === item.category ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Note */}
            <div>
              <label className="block text-[11px] font-medium text-fa-subtle uppercase tracking-wider mb-1.5">
                What&apos;s wrong? <span className="text-[#ef4444]">*</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => { setNote(e.target.value); setErrorMsg(""); }}
                placeholder="e.g. This is a recipe, not a fitness video. Ingredients are listed in the caption."
                rows={3}
                maxLength={400}
                className="w-full bg-fa-input border border-fa-line rounded-lg px-3 py-2 text-sm text-fa-primary placeholder-fa-placeholder outline-none focus:border-fa-ring resize-none"
              />
              <p className="text-[10px] text-fa-faint text-right mt-0.5">
                {note.length}/400
              </p>
            </div>

            {errorMsg && (
              <p className="text-xs text-[#ef4444]">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={!note.trim() || status === "saving"}
              className="w-full py-2 rounded-lg text-sm font-medium bg-[#ef444415] text-[#ef4444] border border-[#ef444430] hover:bg-[#ef444425] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === "saving" ? "Saving…" : "Submit correction"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Main ItemCard component ──────────────────────────────────────────────────

interface ItemCardProps {
  item: SavedItemResponse;
  categories?: { slug: string; label: string }[];
  onCardClick?: (id: string) => void;
}

export function ItemCard({ item, categories, onCardClick }: ItemCardProps) {
  const [showCorrection, setShowCorrection] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const retryItem = useMutation(api.items.retryItem);
  const setArchived = useMutation(api.items.setArchived);

  const meta = getCategoryMeta(item.category);

  const handleRetry = async () => {
    try {
      await retryItem({ id: item.id as Id<"savedItems"> });
    } catch (err: unknown) {
      console.error("[ItemCard] retryItem failed:", err);
    }
  };

  const handleArchiveToggle = async () => {
    setArchiving(true);
    try {
      await setArchived({
        id: item.id as Id<"savedItems">,
        archived: !item.archived,
      });
    } catch (err: unknown) {
      console.error("[ItemCard] setArchived failed:", err);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <>
      <div
        className={`relative bg-fa-surface border border-fa-line border-l-4 ${meta.border} rounded-lg overflow-hidden transition-all duration-200 hover:border-fa-strong hover:shadow-lg hover:shadow-fa-card flex flex-col ${onCardClick && item.status === "done" ? "cursor-pointer" : ""}`}
        onClick={() => {
          if (onCardClick && item.status === "done") onCardClick(item.id);
        }}
      >
        {/* Header */}
        <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${meta.bg} ${meta.text}`}>{meta.label}</Badge>
            <Badge className="bg-fa-muted-bg text-fa-subtle">
              {PLATFORM_LABELS[item.platform] ?? item.platform}
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {item.status === "pending" && (
              <span className="text-[10px] text-[#f59e0b] bg-[#f59e0b12] px-1.5 py-0.5 rounded">
                Queued
              </span>
            )}
            {item.status === "processing" && (
              <span className="text-[10px] text-[#6366f1] bg-[#6366f112] px-1.5 py-0.5 rounded animate-pulse">
                Processing
              </span>
            )}
            {item.status === "failed" && (
              <span className="text-[10px] text-[#ef4444] bg-[#ef444412] px-1.5 py-0.5 rounded">
                Failed
              </span>
            )}
            <RelativeTime iso={item.created_at} />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleArchiveToggle(); }}
              disabled={archiving}
              className="text-[10px] text-fa-subtle hover:text-fa-mid disabled:opacity-40 px-1.5 py-0.5 rounded border border-transparent hover:border-fa-line transition-colors"
              title={item.archived ? "Move back to feed" : "Archive"}
            >
              {item.archived ? "Restore" : "Archive"}
            </button>
          </div>
        </div>

        {/* Thumbnail */}
        {item.status === "done" && item.thumbnail_url && (
          <ThumbnailBanner
            thumbnailUrl={item.thumbnail_url}
            sourceUrl={item.source_url}
          />
        )}

        {/* Body */}
        <div className="px-4 py-2 flex-1">
          {item.status === "pending" && <PendingBody url={item.source_url} />}
          {item.status === "processing" && <ProcessingBody url={item.source_url} />}
          {item.status === "failed" && <FailedBody url={item.source_url} onRetry={handleRetry} />}
          {item.status === "done" && item.extracted_data && (
            <>
              {item.category === "food" ? <FoodBody data={item.extracted_data} />
              : item.category === "recipe" ? <RecipeBody data={item.extracted_data} />
              : item.category === "fitness" ? <FitnessBody data={item.extracted_data} />
              : item.category === "how-to" ? <HowToBody data={item.extracted_data} />
              : item.category === "video-analysis" ? <VideoBody data={item.extracted_data} />
              : item.category === "other" ? <OtherBody data={item.extracted_data} />
              : <GenericBody data={item.extracted_data} />}
            </>
          )}
        </div>

        {/* Footer */}
        {item.status === "done" && (
          <div className="px-4 py-3 border-t border-fa-separator flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <ActionButton item={item} category={item.category} onCardClick={onCardClick} />
                <button
                  onClick={(e) => { e.stopPropagation(); setShowCorrection(true); }}
                  className="text-[11px] text-fa-faint hover:text-[#ef4444] transition-colors px-1"
                  title="Report a correction"
                >
                  ✗
                </button>
              </div>


            </div>

            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-fa-subtle hover:text-fa-muted transition-colors flex items-center gap-1 w-fit"
              onClick={(e) => e.stopPropagation()}
            >
              <span>↗</span>
              <span>View Original</span>
            </a>
          </div>
        )}
      </div>

      {showCorrection && (
        <CorrectionModal item={item} categories={categories} onClose={() => setShowCorrection(false)} />
      )}
    </>
  );
}
