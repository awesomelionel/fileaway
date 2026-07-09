import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface HowToGuideModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  summary?: string;
  steps: string[];
}

/** Full-screen step-by-step guide: one step per screen, with Back/Next navigation. */
export function HowToGuideModal({ visible, onClose, title, summary, steps }: HowToGuideModalProps) {
  const [index, setIndex] = useState(0);
  const [wasVisible, setWasVisible] = useState(visible);
  const insets = useSafeAreaInsets();

  // Reset to the first step whenever the modal transitions from hidden to visible.
  // Adjusting state during render (rather than in an effect) avoids an extra render pass.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setIndex(0);
  }

  const total = steps.length;
  const current = steps[index];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>
            {title ?? "Guide"}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
            <Text style={styles.closeLabel}>✕</Text>
          </Pressable>
        </View>

        {summary && index === 0 && (
          <Text style={styles.summary} numberOfLines={4}>
            {summary}
          </Text>
        )}

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {total > 0 ? (
            <Text style={styles.stepText}>{current}</Text>
          ) : (
            <Text style={styles.muted}>No steps were extracted for this guide.</Text>
          )}
        </ScrollView>

        {total > 0 && (
          <View style={styles.footer}>
            <Text style={styles.stepLabel}>
              Step {index + 1} of {total}
            </Text>
            <View style={styles.navRow}>
              <Pressable
                style={[styles.navButton, index === 0 && styles.navButtonDisabled]}
                disabled={index === 0}
                onPress={() => setIndex((i) => Math.max(0, i - 1))}
              >
                <Text style={styles.navLabel}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.navButton, styles.navButtonPrimary, index === total - 1 && styles.navButtonDisabled]}
                disabled={index === total - 1}
                onPress={() => setIndex((i) => Math.min(total - 1, i + 1))}
              >
                <Text style={[styles.navLabel, styles.navLabelPrimary]}>Next</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d", paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  title: { flex: 1, fontSize: 20, fontWeight: "700", color: "#fff" },
  closeButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  closeLabel: { fontSize: 18, color: "#999" },
  summary: { fontSize: 14, color: "#aaa", marginTop: 10, lineHeight: 20 },
  body: { flex: 1, marginTop: 20 },
  bodyContent: { paddingBottom: 20 },
  stepText: { fontSize: 19, color: "#f2f2f2", lineHeight: 28 },
  muted: { fontSize: 14, color: "#888" },
  footer: { gap: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#333" },
  stepLabel: { fontSize: 12, color: "#888", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  navRow: { flexDirection: "row", gap: 10 },
  navButton: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3a3a3a",
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonPrimary: { backgroundColor: "#fff", borderColor: "#fff" },
  navButtonDisabled: { opacity: 0.35 },
  navLabel: { fontSize: 15, fontWeight: "600", color: "#fff" },
  navLabelPrimary: { color: "#111" },
});
