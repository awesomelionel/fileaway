import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuthActions } from "@convex-dev/auth/react";
import { useOAuthSignIn } from "../useOAuthSignIn";

export function SignInScreen() {
  const { signIn } = useAuthActions();
  const signInGoogle = useOAuthSignIn("google");
  const signInGitHub = useOAuthSignIn("github");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const run = async (fn: () => Promise<unknown>, failMsg: string) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert(failMsg, e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const onApple = () =>
    run(async () => {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!cred.identityToken) throw new Error("Apple returned no identity token");
      const fullName = [cred.fullName?.givenName, cred.fullName?.familyName]
        .filter(Boolean)
        .join(" ");
      await signIn("apple-native", {
        identityToken: cred.identityToken,
        ...(fullName ? { fullName } : {}),
      });
    }, "Apple sign-in failed");

  const onPassword = () =>
    run(
      () => signIn("password", { email: email.trim().toLowerCase(), password, flow: "signIn" }),
      "Sign-in failed",
    );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>fileaway</Text>
      <Text style={styles.subtitle}>Save it now. Use it later.</Text>
      {appleAvailable && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={8}
          style={styles.appleButton}
          onPress={onApple}
        />
      )}
      <Pressable style={styles.oauthButton} disabled={busy} onPress={() => run(signInGoogle, "Google sign-in failed")}>
        <Text style={styles.oauthLabel}>Continue with Google</Text>
      </Pressable>
      <Pressable style={styles.oauthButton} disabled={busy} onPress={() => run(signInGitHub, "GitHub sign-in failed")}>
        <Text style={styles.oauthLabel}>Continue with GitHub</Text>
      </Pressable>
      <Text style={styles.divider}>or sign in with email</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable
        style={[styles.primaryButton, busy && styles.disabled]}
        disabled={busy || !email.trim() || !password}
        onPress={onPassword}
      >
        <Text style={styles.primaryLabel}>{busy ? "Signing in…" : "Sign in"}</Text>
      </Pressable>
      <Text style={styles.footnote}>
        New here? Use Apple, Google, or GitHub above to create your account.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: "700", textAlign: "center" },
  subtitle: { textAlign: "center", color: "#666", marginBottom: 16 },
  appleButton: { height: 48, width: "100%" },
  oauthButton: { height: 48, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  oauthLabel: { fontSize: 16, fontWeight: "500" },
  divider: { textAlign: "center", color: "#999", marginVertical: 4 },
  input: { height: 48, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, paddingHorizontal: 12, fontSize: 16 },
  primaryButton: { height: 48, borderRadius: 8, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  primaryLabel: { color: "#fff", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.5 },
  footnote: { textAlign: "center", color: "#888", fontSize: 13, marginTop: 8 },
});
