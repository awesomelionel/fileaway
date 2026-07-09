import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAuthActions } from "@convex-dev/auth/react";

export function FeedScreen() {
  const { signOut } = useAuthActions();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Signed in — feed coming soon</Text>
      <Pressable style={styles.button} onPress={() => signOut()}>
        <Text style={styles.buttonLabel}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  text: { fontSize: 16, textAlign: "center" },
  button: { height: 44, paddingHorizontal: 20, borderRadius: 8, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  buttonLabel: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
