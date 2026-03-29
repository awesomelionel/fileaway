/**
 * Google Gemini API integration stub.
 *
 * Uses Gemini Flash for categorization and Gemini Pro for deep extraction.
 * Currently logs intent — wire up GoogleGenerativeAI with real prompts when ready.
 *
 * Models:
 *   - Flash (fast, cheap): gemini-1.5-flash — use for categorization
 *   - Pro (capable, expensive): gemini-1.5-pro — use for complex extraction
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

const FLASH_MODEL = "gemini-1.5-flash";
const PRO_MODEL = "gemini-1.5-pro";

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenerativeAI(apiKey);
}

export async function categorizeContent(scrapeResult: ScrapeResult): Promise<CategoryType> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  // TODO: Replace stub with real categorization prompt
  console.log("[gemini] Would call Gemini Flash to categorize content");
  console.log("[gemini] Content metadata:", JSON.stringify(scrapeResult.metadata, null, 2));

  // Stub — replace with:
  // const client = getClient();
  // const model = client.getGenerativeModel({ model: FLASH_MODEL });
  // const prompt = buildCategorizationPrompt(scrapeResult);
  // const result = await model.generateContent(prompt);
  // return parseCategory(result.response.text());

  return "other";
}

export async function extractStructuredData(
  scrapeResult: ScrapeResult,
  category: CategoryType
): Promise<ExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  // Use Pro model for complex categories, Flash for simple ones
  const useProModel = ["food", "recipe", "fitness"].includes(category);
  const modelName = useProModel ? PRO_MODEL : FLASH_MODEL;

  // TODO: Replace stub with real extraction prompt
  console.log(`[gemini] Would call Gemini ${useProModel ? "Pro" : "Flash"} to extract data`);
  console.log(`[gemini] Category: ${category}`);
  console.log(`[gemini] Model: ${modelName}`);

  // Stub — replace with:
  // const client = getClient();
  // const model = client.getGenerativeModel({ model: modelName });
  // const prompt = buildExtractionPrompt(scrapeResult, category);
  // const result = await model.generateContent(prompt);
  // return parseExtraction(result.response.text(), category);

  return {
    category,
    extractedData: { stub: true, note: "Gemini extraction not yet wired up" },
    actionTaken: getDefaultAction(category),
    confidence: 0,
  };
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

export { FLASH_MODEL, PRO_MODEL };
