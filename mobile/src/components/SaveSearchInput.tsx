import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation } from "convex/react";
import { api } from "../backend";
import { isLikelyUrl, normalizeUrl } from "../../../src/lib/inputMode";
import { useToast } from "./Toast";

const SEARCH_DEBOUNCE_MS = 350;

type Status = "idle" | "loading" | "success" | "error";

interface SaveSearchInputProps {
  onSearch: (value: string) => void;
}

/**
 * Unified paste-to-save / search input. Mirrors the web `UrlInput`: a URL-shaped
 * value saves via `api.items.save`, anything else narrows the feed via `onSearch`
 * (debounced 350ms as the user types).
 */
export function SaveSearchInput({ onSearch }: SaveSearchInputProps) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const saveItem = useMutation(api.items.save);
  const { showToast } = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const urlMode = isLikelyUrl(value);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (next: string) => {
    setValue(next);
    if (status !== "idle") setStatus("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (isLikelyUrl(next)) return;
    debounceRef.current = setTimeout(() => onSearch(next), SEARCH_DEBOUNCE_MS);
  };

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (!isLikelyUrl(trimmed)) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      onSearch(trimmed);
      return;
    }

    const cleaned = normalizeUrl(trimmed);
    setStatus("loading");
    try {
      await saveItem({ url: cleaned });
      setStatus("success");
      setValue("");
      onSearch("");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (err) {
      setStatus("error");
      showToast(err instanceof Error ? err.message : "Failed to save — try again");
      setTimeout(() => setStatus("idle"), 2000);
    }
  };

  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={handleChange}
        onSubmitEditing={handleSubmit}
        placeholder="Paste a link or search saved items…"
        placeholderTextColor="#9a9a9a"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        editable={status !== "loading"}
        returnKeyType="go"
      />
      <Pressable
        style={[
          styles.button,
          status === "error" && styles.buttonError,
          status === "success" && styles.buttonSuccess,
        ]}
        onPress={handleSubmit}
        disabled={status === "loading" || !value.trim()}
      >
        <Text
          style={[
            styles.buttonLabel,
            (status === "error" || status === "success") && styles.buttonLabelLight,
          ]}
        >
          {status === "loading"
            ? "Saving…"
            : status === "success"
              ? "✓ Saved"
              : status === "error"
                ? "Error"
                : urlMode
                  ? "Save"
                  : "Search"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#fff",
    backgroundColor: "#1a1a1a",
  },
  button: {
    height: 44,
    minWidth: 72,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonError: { backgroundColor: "#3a1414" },
  buttonSuccess: { backgroundColor: "#12331c" },
  buttonLabel: { fontSize: 14, fontWeight: "600", color: "#111" },
  buttonLabelLight: { color: "#fff" },
});
