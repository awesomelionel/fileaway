import posthog from "posthog-js";

export const EVENTS = {
  LINK_SAVE_SUBMITTED: "link_save_submitted",
  LINK_SAVE_SUCCEEDED: "link_save_succeeded",
  LINK_SAVE_FAILED: "link_save_failed",
  ITEM_VIEWED: "item_viewed",
  ITEM_ACTION_TAKEN: "item_action_taken",
  ITEM_CORRECTION_SUBMITTED: "item_correction_submitted",
  ITEM_RETRY_CLICKED: "item_retry_clicked",
  ITEM_ARCHIVED: "item_archived",
  ITEM_RESTORED: "item_restored",
  CATEGORY_TAB_CHANGED: "category_tab_changed",
  SEARCH_PERFORMED: "search_performed",
  VIEW_TOGGLED: "view_toggled",
  MAP_OPENED: "map_opened",
  MAP_PIN_CLICKED: "map_pin_clicked",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

type BaseProps = Record<string, unknown>;

export function track(event: EventName, props?: BaseProps) {
  if (typeof window === "undefined") return;
  if (!posthog.__loaded) return;
  posthog.capture(event, props);
}

export function urlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "invalid";
  }
}
