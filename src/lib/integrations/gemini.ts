/**
 * Google Gemini API integration.
 *
 * Uses Gemini Flash for categorization (cheap, fast) and Gemini Pro for
 * deep structured extraction (capable, more expensive).
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { CategoryType } from "@/lib/supabase/types";
import type { ScrapeResult } from "./apify";

export interface ExtractionResult {
  category: CategoryType;
  extractedData: Record<string, unknown>;
  actionTaken: string;
  confidence: number;
}

const FLASH_MODEL = "gemini-1.5-flash-latest";
const PRO_MODEL = "gemini-1.5-pro-latest";

const VALID_CATEGORIES: CategoryType[] = [
  "food",
  "fitness",
  "recipe",
  "how-to",
  "video-analysis",
  "other",
];

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenerativeAI(apiKey);
}

// ─── Categorization ──────────────────────────────────────────────────────────

function buildCategorizationPrompt(scrape: ScrapeResult): string {
  const parts: string[] = [
    "You are classifying a saved social media post. Respond with ONLY one of these exact category labels — no explanation:",
    "food | recipe | fitness | how-to | video-analysis | other",
    "",
    "Guidelines:",
    "- food: restaurants, food spots, dishes to try, cafe/bar recommendations",
    "- recipe: cooking instructions, ingredients lists, baking steps",
    "- fitness: workouts, exercise routines, gym tips, sports drills",
    "- how-to: tutorials, life hacks, DIY projects, step-by-step guides (non-recipe)",
    "- video-analysis: general video content where full analysis is needed",
    "- other: everything else",
    "",
    "Post content:",
  ];

  if (scrape.title) parts.push(`Title: ${scrape.title}`);
  if (scrape.description && scrape.description !== scrape.title) {
    parts.push(`Description: ${scrape.description}`);
  }
  if (scrape.hashtags?.length) {
    parts.push(`Hashtags: ${scrape.hashtags.join(", ")}`);
  }
  parts.push(`Platform: ${scrape.platform}`);

  return parts.join("\n");
}

export async function categorizeContent(scrapeResult: ScrapeResult): Promise<CategoryType> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: FLASH_MODEL });

  const prompt = buildCategorizationPrompt(scrapeResult);
  console.log("[gemini/categorize] Sending categorization prompt");

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim().toLowerCase();

  const matched = VALID_CATEGORIES.find((c) => raw.includes(c));
  if (matched) return matched;

  console.warn(`[gemini/categorize] Unexpected response "${raw}", defaulting to "other"`);
  return "other";
}

// ─── Structured Extraction ───────────────────────────────────────────────────

function buildExtractionPrompt(scrape: ScrapeResult, category: CategoryType): string {
  const contentBlock = [
    `Platform: ${scrape.platform}`,
    scrape.title ? `Title: ${scrape.title}` : null,
    scrape.description && scrape.description !== scrape.title
      ? `Description: ${scrape.description}`
      : null,
    scrape.authorHandle ? `Author: @${scrape.authorHandle}` : null,
    scrape.hashtags?.length ? `Hashtags: ${scrape.hashtags.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const schemas: Record<CategoryType, string> = {
    food: `Return JSON:
{
  "name": "<restaurant or food item name>",
  "address": "<full address if mentioned, else null>",
  "cuisine": "<cuisine type>",
  "why_visit": "<one-sentence reason to visit>",
  "price_range": "<$ | $$ | $$$ | null>",
  "dishes_mentioned": ["<dish1>", "<dish2>"]
}`,
    recipe: `Return JSON:
{
  "dish_name": "<name of the dish>",
  "ingredients": ["<ingredient with quantity>"],
  "steps": ["<step 1>", "<step 2>"],
  "prep_time_minutes": <number or null>,
  "cook_time_minutes": <number or null>,
  "servings": <number or null>
}`,
    fitness: `Return JSON:
{
  "workout_name": "<name or description>",
  "exercises": [{"name": "<exercise>", "sets": <number or null>, "reps": <number or null>}],
  "muscle_groups": ["<muscle group>"],
  "duration_minutes": <number or null>,
  "difficulty": "<beginner | intermediate | advanced | null>"
}`,
    "how-to": `Return JSON:
{
  "topic": "<what this guide is about>",
  "steps": ["<step 1>", "<step 2>"],
  "tools_needed": ["<tool or material>"],
  "difficulty": "<easy | medium | hard | null>",
  "time_required": "<estimated time or null>"
}`,
    "video-analysis": `Return JSON:
{
  "summary": "<2-3 sentence summary of the video content>",
  "key_points": ["<key point 1>", "<key point 2>"],
  "topics": ["<topic>"],
  "sentiment": "<positive | neutral | negative>"
}`,
    other: `Return JSON:
{
  "summary": "<brief description of the content>",
  "topics": ["<topic>"]
}`,
  };

  return [
    `You are extracting structured data from a saved social media post. Category: ${category}`,
    "",
    schemas[category],
    "",
    "Post content:",
    contentBlock,
    "",
    "Return ONLY valid JSON, no markdown, no explanation.",
  ].join("\n");
}

function getDefaultAction(category: CategoryType): string {
  const actions: Record<CategoryType, string> = {
    food: "Save to Google Maps",
    recipe: "Export ingredient list",
    fitness: "Add to my routine",
    "how-to": "Save as guide",
    "video-analysis": "Save transcript",
    other: "Save for later",
  };
  return actions[category];
}

export async function extractStructuredData(
  scrapeResult: ScrapeResult,
  category: CategoryType
): Promise<ExtractionResult> {
  const useProModel = ["food", "recipe", "fitness"].includes(category);
  const modelName = useProModel ? PRO_MODEL : FLASH_MODEL;

  const client = getClient();
  const model = client.getGenerativeModel({ model: modelName });

  const prompt = buildExtractionPrompt(scrapeResult, category);
  console.log(`[gemini/extract] Model: ${modelName}, Category: ${category}`);

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();

  let extractedData: Record<string, unknown>;
  try {
    // Strip markdown code fences if present
    const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    extractedData = JSON.parse(jsonStr);
  } catch (err) {
    console.error("[gemini/extract] Failed to parse JSON response:", raw);
    extractedData = { raw_response: raw, parse_error: true };
  }

  return {
    category,
    extractedData,
    actionTaken: getDefaultAction(category),
    confidence: 0.8,
  };
}

export { FLASH_MODEL, PRO_MODEL };
