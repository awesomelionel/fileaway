import { useEffect, useRef, useState } from "react";
import { useShareIntentContext } from "expo-share-intent";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "./backend";
import { extractShareUrl } from "../../src/lib/inputMode";

export function useShareSave(showToast: (msg: string) => void) {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const { isAuthenticated } = useConvexAuth();
  const save = useMutation(api.items.save);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const saving = useRef(false);

  // Capture the intent immediately, even when signed out.
  useEffect(() => {
    if (!hasShareIntent) return;
    const url = extractShareUrl({ webUrl: shareIntent.webUrl, text: shareIntent.text });
    resetShareIntent();
    if (!url) {
      showToast("That link could not be read");
      return;
    }
    setPendingUrl(url);
  }, [hasShareIntent]);

  // Save as soon as we're authenticated (immediately, or right after login).
  useEffect(() => {
    if (!pendingUrl || !isAuthenticated || saving.current) return;
    saving.current = true;
    save({ url: pendingUrl })
      .then(() => showToast("Saved — processing…"))
      .catch(() => showToast("Save failed — pull to refresh and try again"))
      .finally(() => {
        saving.current = false;
        setPendingUrl(null);
      });
  }, [pendingUrl, isAuthenticated]);

  return { pendingUrl };
}
