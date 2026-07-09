import { useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../backend";
import { ItemCard, type FeedItem } from "../components/ItemCard";
import { SaveSearchInput } from "../components/SaveSearchInput";

interface CategoryTab {
  slug: string;
  label: string;
}

export function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");

  const items = useQuery(api.items.list, { view: "feed", q: q || undefined }) as
    | FeedItem[]
    | undefined;
  const categories = useQuery(api.adminCategories.listCategories, {}) as
    | CategoryTab[]
    | undefined;

  const visible = useMemo(
    () => (items ?? []).filter((i) => tab === "all" || i.category === tab),
    [items, tab],
  );

  const tabs: CategoryTab[] = [{ slug: "all", label: "All" }, ...(categories ?? [])];

  const countFor = (slug: string) =>
    slug === "all"
      ? (items ?? []).length
      : (items ?? []).filter((i) => i.category === slug).length;

  const handleGearPress = () => router.push("/settings");

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>fileaway</Text>
          <Pressable onPress={handleGearPress} hitSlop={12} style={styles.gearButton}>
            <Text style={styles.gearIcon}>⚙︎</Text>
          </Pressable>
        </View>

        <SaveSearchInput onSearch={setQ} />

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}
          contentContainerStyle={styles.tabsContent}
          data={tabs}
          keyExtractor={(t) => t.slug}
          renderItem={({ item: t }) => (
            <Pressable
              onPress={() => setTab(t.slug)}
              style={[styles.pill, tab === t.slug && styles.pillActive]}
            >
              <Text style={tab === t.slug ? styles.pillActiveLabel : styles.pillLabel}>
                {t.label} {countFor(t.slug) > 0 ? countFor(t.slug) : ""}
              </Text>
            </Pressable>
          )}
        />

        <FlatList
          data={visible}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <ItemCard item={item} />}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            items === undefined ? (
              <Text style={styles.muted}>Loading…</Text>
            ) : (
              <Text style={styles.muted}>
                Nothing saved yet. Share a link to fileaway to get started.
              </Text>
            )
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#0d0d0d" },
  container: { flex: 1, backgroundColor: "#0d0d0d" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  brand: { fontSize: 20, fontWeight: "700", color: "#fff" },
  gearButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  gearIcon: { fontSize: 18, color: "#999" },
  tabs: { flexGrow: 0, marginBottom: 8 },
  tabsContent: { paddingHorizontal: 16, gap: 8 },
  pill: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  pillActive: { backgroundColor: "#fff", borderColor: "#fff" },
  pillLabel: { fontSize: 13, color: "#ccc", fontWeight: "500" },
  pillActiveLabel: { fontSize: 13, color: "#111", fontWeight: "600" },
  listContent: { paddingBottom: 24, flexGrow: 1 },
  muted: { color: "#888", textAlign: "center", marginTop: 40, paddingHorizontal: 24, fontSize: 14 },
});
