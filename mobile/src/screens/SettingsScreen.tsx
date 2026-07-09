import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import * as Application from "expo-application";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../backend";

const APP_URL = "https://fileaway.app";

export function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuthActions();
  const me = useQuery(api.users.me, {}) as { email: string | null; name: string | null } | null | undefined;
  const deleteAccount = useMutation(api.users.deleteAccount);

  const onSignOut = async () => {
    await signOut();
    router.back();
  };

  const onDelete = () =>
    Alert.alert(
      "Delete account?",
      "This permanently removes your account and every saved item. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount({});
              await signOut();
            } catch {
              Alert.alert("Deletion failed", "Please try again.");
            }
          },
        },
      ],
    );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.card}>
        <Text style={styles.email}>{me?.email ?? "…"}</Text>
        <Text style={styles.muted}>Signed in</Text>
      </View>

      <View style={styles.section}>
        <Pressable style={[styles.row, styles.rowDivider]} onPress={() => Linking.openURL(`${APP_URL}/privacy`)}>
          <Text style={styles.rowLabel}>Privacy Policy</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => Linking.openURL(`${APP_URL}/support`)}>
          <Text style={styles.rowLabel}>Support</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Pressable style={[styles.row, styles.rowDivider]} onPress={onSignOut}>
          <Text style={styles.rowLabel}>Sign out</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={onDelete}>
          <Text style={styles.destructiveLabel}>Delete account</Text>
        </Pressable>
      </View>

      <Text style={styles.footer}>
        fileaway {Application.nativeApplicationVersion} ({Application.nativeBuildVersion})
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d", paddingHorizontal: 16 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
  },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  backIcon: { fontSize: 28, color: "#fff", lineHeight: 28 },
  title: { fontSize: 18, fontWeight: "700", color: "#fff" },
  card: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  email: { fontSize: 16, fontWeight: "600", color: "#fff" },
  muted: { fontSize: 13, color: "#888", marginTop: 2 },
  section: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    marginBottom: 24,
    overflow: "hidden",
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  rowLabel: { fontSize: 15, color: "#fff" },
  destructiveLabel: { fontSize: 15, color: "#ff4d4d" },
  footer: { textAlign: "center", color: "#666", fontSize: 12, marginTop: "auto", marginBottom: 24 },
});
