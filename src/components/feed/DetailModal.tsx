"use client";

import type { SavedItemResponse } from "@/lib/api/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// ─── Per-category detail renderers ───────────────────────────────────────────

function FoodDetail({ data }: { data: Record<string, unknown> }) {
  const name = data.name as string | undefined;
  const address = data.address as string | undefined;
  const cuisine = data.cuisine as string | undefined;
  const whyVisit = data.why_visit as string | undefined;
  const priceRange = data.price_range as string | undefined;
  const hours = data.hours as string | undefined;
  const phone = data.phone as string | undefined;

  return (
    <div className="space-y-3">
      {name && <p className="font-semibold text-fa-primary text-base leading-tight">{name}</p>}
      <div className="flex flex-wrap gap-2">
        {cuisine && <span className="text-xs text-fa-dim bg-fa-chip px-2 py-0.5 rounded">{cuisine}</span>}
        {priceRange && <span className="text-xs text-[#f97316] font-mono bg-fa-chip px-2 py-0.5 rounded">{priceRange}</span>}
      </div>
      {address && (
        <p className="text-sm text-fa-secondary-alt flex items-start gap-1.5">
          <span className="mt-0.5 flex-shrink-0">📍</span>
          <span>{address}</span>
        </p>
      )}
      {whyVisit && (
        <p className="text-sm text-fa-soft leading-relaxed border-l-2 border-[#f97316]/30 pl-3 italic">{whyVisit}</p>
      )}
      {hours && (
        <p className="text-xs text-fa-dim">
          <span className="font-medium text-fa-subtle">Hours: </span>{hours}
        </p>
      )}
      {phone && (
        <p className="text-xs text-fa-dim">
          <span className="font-medium text-fa-subtle">Phone: </span>{phone}
        </p>
      )}
    </div>
  );
}

function RecipeDetail({ data }: { data: Record<string, unknown> }) {
  const dishName = data.dish_name as string | undefined;
  const ingredients = data.ingredients as string[] | undefined;
  const steps = data.steps as string[] | undefined;
  const prepTime = data.prep_time_minutes as number | undefined;
  const cookTime = data.cook_time_minutes as number | undefined;
  const servings = data.servings as number | undefined;

  return (
    <div className="space-y-4">
      {dishName && <p className="font-semibold text-fa-primary text-base leading-tight">{dishName}</p>}
      <div className="flex gap-4 text-xs text-fa-secondary-alt">
        {prepTime !== undefined && <span>Prep {prepTime}m</span>}
        {cookTime !== undefined && cookTime > 0 && <span>Cook {cookTime}m</span>}
        {servings !== undefined && <span>Serves {servings}</span>}
      </div>
      {ingredients && ingredients.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle mb-2">Ingredients</p>
          <ul className="space-y-1">
            {ingredients.map((ing, i) => (
              <li key={i} className="text-sm text-fa-soft flex items-start gap-2">
                <span className="text-[#22c55e] mt-0.5 flex-shrink-0">·</span>
                {ing}
              </li>
            ))}
          </ul>
        </div>
      )}
      {steps && steps.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle mb-2">Steps</p>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#22c55e20] border border-[#22c55e40] text-[#22c55e] text-[10px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-fa-secondary leading-relaxed pt-0.5">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FitnessDetail({ data }: { data: Record<string, unknown> }) {
  const workoutName = data.workout_name as string | undefined;
  const exercises = data.exercises as Array<{ name: string; sets: number; reps: number | string }> | undefined;
  const muscleGroups = data.muscle_groups as string[] | undefined;
  const duration = data.duration_minutes as number | undefined;
  const difficulty = data.difficulty as string | undefined;
  const notes = data.notes as string | undefined;

  return (
    <div className="space-y-4">
      {workoutName && <p className="font-semibold text-fa-primary text-base leading-tight">{workoutName}</p>}
      <div className="flex gap-3 flex-wrap">
        {duration !== undefined && <span className="text-xs text-[#3b82f6] bg-[#3b82f610] px-2 py-0.5 rounded font-mono">{duration}m</span>}
        {difficulty && <span className="text-xs text-fa-dim bg-fa-chip px-2 py-0.5 rounded">{difficulty}</span>}
      </div>
      {muscleGroups && muscleGroups.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {muscleGroups.map((g) => (
            <span key={g} className="text-xs text-[#3b82f6]/70 bg-[#3b82f608] border border-[#3b82f620] px-2 py-0.5 rounded">{g}</span>
          ))}
        </div>
      )}
      {exercises && exercises.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle mb-2">Exercises</p>
          <div className="space-y-1.5">
            {exercises.map((ex, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-fa-separator last:border-0">
                <span className="text-fa-mid">{ex.name}</span>
                <span className="text-[#3b82f6] font-mono text-xs">
                  {ex.sets > 1 ? `${ex.sets}×` : ""}{ex.reps}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {notes && <p className="text-xs text-fa-soft leading-relaxed italic border-l-2 border-[#3b82f6]/30 pl-3">{notes}</p>}
    </div>
  );
}

function HowToDetail({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string | undefined;
  const summary = data.summary as string | undefined;
  const steps = data.steps as string[] | undefined;

  return (
    <div className="space-y-4">
      {title && <p className="font-semibold text-fa-primary text-base leading-tight">{title}</p>}
      {summary && <p className="text-sm text-fa-dim leading-relaxed">{summary}</p>}
      {steps && steps.length > 0 && (
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#a855f720] border border-[#a855f740] text-[#a855f7] text-[11px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <p className="text-sm text-fa-secondary leading-relaxed pt-0.5">{step}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Shot {
  timestamp: string;
  description: string;
  detail: string;
}

function VideoAnalysisDetail({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string | undefined;
  const summary = data.summary as string | undefined;
  const shots = data.shots as Shot[] | undefined;
  const takeaways = data.takeaways as string[] | undefined;
  const keyPoints = data.key_points as string[] | undefined;

  // If no shots, fall back to summary + key_points display
  if (!shots || shots.length === 0) {
    return (
      <div className="space-y-3">
        {title && <p className="font-semibold text-fa-primary text-base leading-tight">{title}</p>}
        {summary && <p className="text-sm text-fa-soft leading-relaxed">{summary}</p>}
        {keyPoints && keyPoints.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle">Key Points</p>
            {keyPoints.map((pt, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-[#14b8a6] flex-shrink-0 mt-0.5">→</span>
                <span className="text-fa-dim">{pt}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {title && <p className="font-semibold text-fa-primary text-base leading-tight">{title}</p>}
      {summary && <p className="text-sm text-fa-soft leading-relaxed">{summary}</p>}

      {/* Storyboard */}
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle mb-3">Shot Breakdown</p>
        <div className="space-y-3">
          {shots.map((shot, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 font-mono text-[10px] text-[#14b8a6] bg-[#14b8a610] border border-[#14b8a630] px-1.5 py-0.5 rounded mt-0.5 whitespace-nowrap">
                {shot.timestamp}
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-fa-primary leading-snug">{shot.description}</p>
                <p className="text-xs text-fa-soft leading-relaxed">{shot.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Takeaways */}
      {takeaways && takeaways.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle mb-2">Takeaways</p>
          <ul className="space-y-1.5">
            {takeaways.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-[#14b8a6] flex-shrink-0 mt-0.5">✓</span>
                <span className="text-fa-dim leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function OtherDetail({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string | undefined;
  const summary = data.summary as string | undefined;
  const topics = data.topics as string[] | undefined;

  return (
    <div className="space-y-3">
      {title && <p className="font-semibold text-fa-primary text-base leading-tight">{title}</p>}
      {summary && <p className="text-sm text-fa-soft leading-relaxed">{summary}</p>}
      {topics && topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topics.map((t) => (
            <span key={t} className="text-xs text-fa-subtle bg-fa-chip px-2 py-0.5 rounded">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailContent({ item }: { item: SavedItemResponse }) {
  const data = item.extracted_data ?? {};
  switch (item.category) {
    case "food": return <FoodDetail data={data} />;
    case "recipe": return <RecipeDetail data={data} />;
    case "fitness": return <FitnessDetail data={data} />;
    case "how-to": return <HowToDetail data={data} />;
    case "video-analysis": return <VideoAnalysisDetail data={data} />;
    case "other": return <OtherDetail data={data} />;
    default: return <OtherDetail data={data} />;
  }
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  food: "Food",
  recipe: "Recipe",
  fitness: "Fitness",
  "how-to": "How-To Guide",
  "video-analysis": "Video Analysis",
  other: "Saved Item",
};

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  twitter: "X/Twitter",
  other: "Web",
};

interface DetailModalProps {
  item: SavedItemResponse;
  categories: { slug: string; label: string }[];
}

export function DetailModal({ item, categories }: DetailModalProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState(item.category);
  const [reprocessing, setReprocessing] = useState(false);
  const reprocessWithCategory = useMutation(api.items.reprocessWithCategory);

  const close = useCallback(() => router.back(), [router]);

  const handleReprocess = async () => {
    if (selectedCategory === item.category) return;
    setReprocessing(true);
    try {
      await reprocessWithCategory({ id: item.id as Id<"savedItems">, category: selectedCategory });
      close();
<<<<<<< HEAD
=======
    } catch (err) {
      console.error("Failed to reprocess item:", err);
>>>>>>> feature/recategorize-modal-only
    } finally {
      setReprocessing(false);
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [close]);

  const categoryLabel = CATEGORY_LABELS[item.category] ?? item.category;
  const platformLabel = PLATFORM_LABELS[item.platform] ?? item.platform;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 pt-16 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-full max-w-xl bg-fa-surface border border-fa-line rounded-xl shadow-2xl mb-8">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-fa-separator">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-fa-subtle">
                {categoryLabel}
              </span>
              <span className="text-fa-faint text-[10px]">·</span>
              <span className="text-[10px] text-fa-faint">{platformLabel}</span>
            </div>
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-fa-subtle hover:text-fa-muted transition-colors font-mono truncate block max-w-xs"
            >
              {item.source_url}
            </a>
          </div>
          <button
            onClick={close}
            className="text-fa-subtle hover:text-fa-dim text-lg leading-none mt-0.5 ml-4 flex-shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Thumbnail */}
        {item.thumbnail_url && (
          <img
            src={item.thumbnail_url}
            alt=""
            referrerPolicy="no-referrer"
            className="w-full h-48 object-cover"
            loading="lazy"
          />
        )}

        {/* Body */}
        <div className="p-5">
          <DetailContent item={item} />
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 space-y-3">
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-fa-subtle hover:text-fa-muted transition-colors"
          >
            View original source ↗
          </a>

          {item.status === "done" && categories.length > 0 && (
            <div className="flex items-center gap-2 pt-3 border-t border-fa-separator">
              <span className="text-[11px] text-fa-faint flex-shrink-0">Wrong category?</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-[11px] text-fa-subtle bg-fa-input border border-fa-line rounded px-2 py-0.5 outline-none focus:border-fa-ring flex-1 min-w-0"
              >
                {categories.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>{cat.label}</option>
                ))}
              </select>
              <button
                onClick={handleReprocess}
                disabled={selectedCategory === item.category || reprocessing}
                className="text-[11px] text-fa-subtle bg-fa-input border border-fa-line rounded px-2.5 py-0.5 hover:text-fa-primary hover:border-fa-ring transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                {reprocessing ? "Queuing…" : "Re-process ↺"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
