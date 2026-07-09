import { Linking } from "react-native";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FeedItem } from "./types";

/** Button label per the card/action contract table (matches web `ItemCard.tsx` exactly). */
export function actionLabel(category: string, data: Record<string, unknown>): string {
  if (category === "food") return "Open in Maps ↗";
  if (category === "recipe") return "Copy ingredients";
  if (category === "fitness") return "Save to routine";
  if (category === "how-to") return "View guide ↗";
  if (category === "travel") {
    const itinerary = (data.itinerary as Array<{ google_maps_url?: string }> | undefined) ?? [];
    if (itinerary.some((s) => s.google_maps_url)) return "Open in Maps ↗";
  }
  return "Copy summary";
}

/** Runs the category-specific action, toasting on both success (where relevant) and failure. */
export async function runAction(
  item: FeedItem,
  openGuide: () => void,
  toast: (m: string) => void,
): Promise<void> {
  const d = (item.extracted_data ?? {}) as Record<string, any>;
  try {
    switch (item.category) {
      case "food":
        await Linking.openURL(
          "https://maps.google.com/?q=" + encodeURIComponent(`${d.name ?? ""} ${d.address ?? ""}`.trim()),
        );
        return;
      case "recipe":
        await Clipboard.setStringAsync(
          `${d.dish_name ?? "Recipe"}\n\n${(d.ingredients ?? []).join("\n")}`,
        );
        toast("Ingredients copied");
        return;
      case "fitness": {
        const raw = await AsyncStorage.getItem("fileaway-routine");
        const routine = raw ? JSON.parse(raw) : [];
        await AsyncStorage.setItem(
          "fileaway-routine",
          JSON.stringify([...routine, ...(d.exercises ?? [])]),
        );
        toast("Saved to routine");
        return;
      }
      case "how-to":
        openGuide();
        return;
      case "travel": {
        const stop = (d.itinerary ?? []).find((s: any) => s.google_maps_url);
        if (stop) {
          await Linking.openURL(stop.google_maps_url);
          return;
        }
        break; // falls through to copy-summary
      }
    }
    await Clipboard.setStringAsync([d.title, d.summary].filter(Boolean).join("\n\n"));
    toast("Summary copied");
  } catch {
    toast("Action failed — try again");
  }
}
