"use client";

import { useState } from "react";
import type { SavedItemResponse, CategoryType } from "@/lib/api/types";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// ─── Category metadata ───────────────────────────────────────────────────────

export const CATEGORY_META: Record<
  CategoryType,
  { label: string; color: string; border: string; bg: string; text: string }
> = {
  food: {
    label: "Food",
    color: "#f97316",
    border: "border-l-[#f97316]",
    bg: "bg-[#f9731610]",
    text: "text-[#f97316]",
  },
  recipe: {
    label: "Recipe",
    color: "#22c55e",
    border: "border-l-[#22c55e]",
    bg: "bg-[#22c55e10]",
    text: "text-[#22c55e]",
  },
  fitness: {
    label: "Fitness",
    color: "#3b82f6",
    border: "border-l-[#3b82f6]",
    bg: "bg-[#3b82f610]",
    text: "text-[#3b82f6]",
  },
  "how-to": {
    label: "How-To",
    color: "#a855f7",
    border: "border-l-[#a855f7]",
    bg: "bg-[#a855f710]",
    text: "text-[#a855f7]",
  },
  "video-analysis": {
    label: "Video",
    color: "#14b8a6",
    border: "border-l-[#14b8a6]",
    bg: "bg-[#14b8a610]",
    text: "text-[#14b8a6]",
  },
  other: {
    label: "Other",
    color: "#6b7280",
    border: "border-l-[#6b7280]",
    bg: "bg-[#6b728010]",
    text: "text-[#6b7280]",
  },
};

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
  return <span className="text-[11px] text-[#555]">{label}</span>;
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
      className="block w-full overflow-hidden"
    >
      <img
        src={thumbnailUrl}
        alt=""
        onError={() => setFailed(true)}
        className="w-full h-40 object-cover transition-opacity duration-200 hover:opacity-85"
        loading="lazy"
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
      {name && <p className="font-semibold text-[#e8e8e8] leading-tight">{name}</p>}
      <div className="flex flex-wrap gap-2">
        {cuisine && (
          <span className="text-xs text-[#999] bg-[#1f1f1f] px-2 py-0.5 rounded">{cuisine}</span>
        )}
        {priceRange && (
          <span className="text-xs text-[#f97316] font-mono bg-[#1f1f1f] px-2 py-0.5 rounded">
            {priceRange}
          </span>
        )}
      </div>
      {address && (
        <p className="text-xs text-[#777] flex items-start gap-1">
          <span className="mt-0.5">📍</span>
          <span>{address}</span>
        </p>
      )}
      {whyVisit && (
        <p className="text-xs text-[#aaa] leading-relaxed border-l-2 border-[#f97316]/30 pl-2 italic">
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
      {dishName && <p className="font-semibold text-[#e8e8e8] leading-tight">{dishName}</p>}
      <div className="flex gap-3 text-[11px] text-[#777]">
        {prepTime !== undefined && <span>Prep {prepTime}m</span>}
        {cookTime !== undefined && cookTime > 0 && <span>Cook {cookTime}m</span>}
        {servings !== undefined && <span>Serves {servings}</span>}
      </div>
      {ingredients && ingredients.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-[#555] mb-1">
            Ingredients
          </p>
          <ul className="space-y-0.5">
            {ingredients.slice(0, 5).map((ing, i) => (
              <li key={i} className="text-xs text-[#aaa] flex items-start gap-1.5">
                <span className="text-[#22c55e] mt-0.5 flex-shrink-0">·</span>
                {ing}
              </li>
            ))}
            {ingredients.length > 5 && (
              <li className="text-[11px] text-[#555]">+{ingredients.length - 5} more</li>
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
      {workoutName && <p className="font-semibold text-[#e8e8e8] leading-tight">{workoutName}</p>}
      <div className="flex gap-3 flex-wrap">
        {duration && (
          <span className="text-xs text-[#3b82f6] bg-[#3b82f610] px-2 py-0.5 rounded font-mono">
            {duration}m
          </span>
        )}
        {difficulty && (
          <span className="text-xs text-[#999] bg-[#1f1f1f] px-2 py-0.5 rounded">{difficulty}</span>
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
              <span className="text-[#bbb]">{ex.name}</span>
              <span className="text-[#3b82f6] font-mono text-[11px]">
                {ex.sets > 1 ? `${ex.sets}×` : ""}{ex.reps}
              </span>
            </div>
          ))}
          {exercises.length > 4 && (
            <p className="text-[11px] text-[#555]">+{exercises.length - 4} more exercises</p>
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
      {title && <p className="font-semibold text-[#e8e8e8] leading-tight">{title}</p>}
      {summary && <p className="text-xs text-[#999] leading-relaxed">{summary}</p>}
      {steps && steps.length > 0 && (
        <div className="space-y-1">
          {steps.slice(0, 4).map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="text-[10px] text-[#a855f7] font-mono font-bold flex-shrink-0 mt-0.5 w-4">
                {i + 1}.
              </span>
              <span className="text-[#aaa] leading-relaxed">{step}</span>
            </div>
          ))}
          {steps.length > 4 && (
            <p className="text-[11px] text-[#555] pl-6">+{steps.length - 4} more steps</p>
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
      {title && <p className="font-semibold text-[#e8e8e8] leading-tight text-sm">{title}</p>}
      {summary && (
        <p className="text-xs text-[#aaa] leading-relaxed line-clamp-3">{summary}</p>
      )}
      {keyPoints && keyPoints.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[#555]">Key Points</p>
          {keyPoints.slice(0, 3).map((pt, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs">
              <span className="text-[#14b8a6] flex-shrink-0 mt-0.5">→</span>
              <span className="text-[#999]">{pt}</span>
            </div>
          ))}
          {keyPoints.length > 3 && (
            <p className="text-[11px] text-[#555] pl-4">+{keyPoints.length - 3} more</p>
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
      {title && <p className="font-semibold text-[#e8e8e8] leading-tight">{title}</p>}
      {summary && (
        <p className="text-xs text-[#aaa] leading-relaxed">{summary}</p>
      )}
    </div>
  );
}

// ─── Pending / Failed states ──────────────────────────────────────────────────

function PendingBody({ url }: { url: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-[#666]">Queued for processing…</p>
      <p className="text-[11px] text-[#444] font-mono truncate">{url}</p>
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
      <p className="text-xs text-[#888]">AI is analyzing this link…</p>
      <p className="text-[11px] text-[#444] font-mono truncate">{url}</p>
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
      <p className="text-[11px] text-[#444] font-mono truncate">{url}</p>
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
  onGuideOpen,
}: {
  item: SavedItemResponse;
  category: CategoryType;
  onGuideOpen?: (item: SavedItemResponse) => void;
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
        onClick={() => onGuideOpen?.(item)}
        className="text-xs px-3 py-1.5 rounded bg-[#a855f715] text-[#a855f7] border border-[#a855f730] font-medium hover:bg-[#a855f725] transition-colors min-h-[44px] sm:min-h-0"
      >
        View guide
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

// ─── Guide modal ──────────────────────────────────────────────────────────────

function GuideModal({
  item,
  onClose,
}: {
  item: SavedItemResponse;
  onClose: () => void;
}) {
  const title = item.extracted_data?.title as string | undefined;
  const summary = item.extracted_data?.summary as string | undefined;
  const steps = item.extracted_data?.steps as string[] | undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 pt-16 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl bg-[#141418] border border-[#2a2a2a] rounded-xl shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-[#1f1f1f]">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#a855f7] mb-1">
              Step-by-step guide
            </p>
            <h2 className="text-base font-semibold text-[#e8e8e8] leading-tight">
              {title ?? "Guide"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#555] hover:text-[#999] text-lg leading-none mt-0.5 ml-4 flex-shrink-0"
          >
            ✕
          </button>
        </div>
        {summary && (
          <div className="px-5 pt-4 pb-0">
            <p className="text-xs text-[#888] leading-relaxed">{summary}</p>
          </div>
        )}
        {steps && steps.length > 0 && (
          <div className="p-5 space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#a855f720] border border-[#a855f740] text-[#a855f7] text-[11px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-sm text-[#ccc] leading-relaxed pt-0.5">{step}</p>
              </div>
            ))}
          </div>
        )}
        <div className="p-5 pt-0">
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#555] hover:text-[#888] transition-colors"
          >
            View original source ↗
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Correction modal ─────────────────────────────────────────────────────────

function CorrectionModal({
  item,
  onClose,
}: {
  item: SavedItemResponse;
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
      <div className="w-full max-w-md bg-[#141418] border border-[#2a2a2a] rounded-xl shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-[#1f1f1f]">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#ef4444] mb-1">
              Report correction
            </p>
            <h2 className="text-sm font-semibold text-[#e8e8e8]">
              What&apos;s wrong with this?
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#555] hover:text-[#999] text-lg leading-none mt-0.5 ml-4 flex-shrink-0"
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
              <label className="block text-[11px] font-medium text-[#555] uppercase tracking-wider mb-1.5">
                Correct category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) =>
                  setSelectedCategory(e.target.value as CategoryType)
                }
                className="w-full bg-[#1a1a1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#e8e8e8] outline-none focus:border-[#3a3a4a]"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-[#1a1a1a]">
                    {CATEGORY_META[cat].label}
                    {cat === item.category ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Note */}
            <div>
              <label className="block text-[11px] font-medium text-[#555] uppercase tracking-wider mb-1.5">
                What&apos;s wrong? <span className="text-[#ef4444]">*</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => { setNote(e.target.value); setErrorMsg(""); }}
                placeholder="e.g. This is a recipe, not a fitness video. Ingredients are listed in the caption."
                rows={3}
                maxLength={400}
                className="w-full bg-[#1a1a1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#e8e8e8] placeholder-[#3a3a3a] outline-none focus:border-[#3a3a4a] resize-none"
              />
              <p className="text-[10px] text-[#444] text-right mt-0.5">
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
}

const CATEGORIES: CategoryType[] = [
  "food",
  "recipe",
  "fitness",
  "how-to",
  "video-analysis",
  "other",
];

export function ItemCard({ item }: ItemCardProps) {
  const [guideItem, setGuideItem] = useState<SavedItemResponse | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const updateCategory = useMutation(api.items.updateCategory);
  const retryItem = useMutation(api.items.retryItem);

  const meta = CATEGORY_META[item.category];

  const handleCategoryChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCat = e.target.value as CategoryType;
    if (newCat === item.category) return;
    setOverriding(true);
    try {
      await updateCategory({ id: item.id as Id<"savedItems">, category: newCat });
    } finally {
      setOverriding(false);
    }
  };

  const handleRetry = async () => {
    try {
      await retryItem({ id: item.id as Id<"savedItems"> });
    } catch (err: unknown) {
      console.error("[ItemCard] retryItem failed:", err);
    }
  };

  return (
    <>
      <div
        className={`relative bg-[#141418] border border-[#222] border-l-4 ${meta.border} rounded-lg overflow-hidden transition-all duration-200 hover:border-[#333] hover:shadow-lg hover:shadow-black/30 flex flex-col`}
      >
        {/* Header */}
        <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${meta.bg} ${meta.text}`}>{meta.label}</Badge>
            <Badge className="bg-[#1a1a1a] text-[#555]">
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
              {item.category === "food" && <FoodBody data={item.extracted_data} />}
              {item.category === "recipe" && <RecipeBody data={item.extracted_data} />}
              {item.category === "fitness" && <FitnessBody data={item.extracted_data} />}
              {item.category === "how-to" && <HowToBody data={item.extracted_data} />}
              {item.category === "video-analysis" && <VideoBody data={item.extracted_data} />}
              {item.category === "other" && <OtherBody data={item.extracted_data} />}
            </>
          )}
        </div>

        {/* Footer */}
        {item.status === "done" && (
          <div className="px-4 py-3 border-t border-[#1c1c1c] flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ActionButton item={item} category={item.category} onGuideOpen={setGuideItem} />
                <button
                  onClick={() => setShowCorrection(true)}
                  className="text-[11px] text-[#444] hover:text-[#ef4444] transition-colors px-1"
                  title="Report a correction"
                >
                  ✗
                </button>
              </div>

              {/* Category override */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#444]">↺</span>
                <select
                  value={item.category}
                  onChange={handleCategoryChange}
                  disabled={overriding}
                  className="text-[11px] text-[#555] bg-transparent border-none outline-none cursor-pointer hover:text-[#888] transition-colors appearance-none"
                  aria-label="Override category"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="bg-[#1a1a1a] text-[#ccc]">
                      {CATEGORY_META[cat].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[#555] hover:text-[#888] transition-colors flex items-center gap-1 w-fit"
            >
              <span>↗</span>
              <span>View Original</span>
            </a>
          </div>
        )}
      </div>

      {/* Guide modal */}
      {guideItem && (
        <GuideModal item={guideItem} onClose={() => setGuideItem(null)} />
      )}
      {showCorrection && (
        <CorrectionModal item={item} onClose={() => setShowCorrection(false)} />
      )}
    </>
  );
}
