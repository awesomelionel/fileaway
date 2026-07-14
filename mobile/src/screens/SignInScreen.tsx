import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { Ionicons } from "@expo/vector-icons";
import { useAuthActions } from "@convex-dev/auth/react";
import { useOAuthSignIn } from "../useOAuthSignIn";
import { KnownSignInError, withSignInTimeout } from "../signInErrors";

function friendlySignInError(raw: string): string {
  if (raw.includes("InvalidSecret") || raw.includes("InvalidAccountId")) {
    return "Incorrect email or password. Please try again.";
  }
  if (raw.includes("TooManyFailedAttempts") || raw.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return "Something went wrong signing you in. Please try again.";
}

interface SignInScreenProps {
  pendingUrl?: string | null;
}

type AuthStep = "signIn" | "forgotPassword" | "resetPassword";

export function SignInScreen({ pendingUrl }: SignInScreenProps = {}) {
  const { signIn } = useAuthActions();
  const signInGoogle = useOAuthSignIn("google");
  const signInGitHub = useOAuthSignIn("github");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>("signIn");
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
      const msg = e instanceof KnownSignInError ? e.message : friendlySignInError(e instanceof Error ? e.message : String(e));
      Alert.alert(failMsg, msg);
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
      if (!cred.identityToken) throw new KnownSignInError("Apple returned no identity token");
      const fullName = [cred.fullName?.givenName, cred.fullName?.familyName]
        .filter(Boolean)
        .join(" ");
      await withSignInTimeout(signIn("apple-native", {
        identityToken: cred.identityToken,
        ...(fullName ? { fullName } : {}),
      }));
    }, "Apple sign-in failed");

  const onPassword = () =>
    run(async () => {
      const result = await withSignInTimeout(signIn("password", {
        email: email.trim().toLowerCase(),
        password,
        flow: "signIn",
      }));
      if (result.signingIn === false) {
        throw new KnownSignInError(
          "This account needs email verification. Check your inbox for a verification link, then sign in again.",
        );
      }
    }, "Sign-in failed");

  const requestPasswordReset = () =>
    run(async () => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        throw new KnownSignInError("Enter your email address first.");
      }
      await withSignInTimeout(signIn("password", {
        email: normalizedEmail,
        redirectTo: "fileaway://",
        flow: "reset",
      }));
      setAuthStep("resetPassword");
      setResetCode("");
      setNewPassword("");
      Alert.alert("Check your email", "Enter the 6-digit reset code we sent, then choose a new password.");
    }, "Reset email failed");

  const onResetPassword = () =>
    run(async () => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) throw new KnownSignInError("Enter your email address.");
      if (!/^\d{6}$/.test(resetCode)) throw new KnownSignInError("Enter the 6-digit reset code from your email.");
      if (newPassword.length < 8) throw new KnownSignInError("Use a password with at least 8 characters.");
      await withSignInTimeout(signIn("password", {
        email: normalizedEmail,
        code: resetCode.trim(),
        newPassword,
        flow: "reset-verification",
      }));
    }, "Password reset failed");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>fileaway</Text>
      <Text style={styles.subtitle}>Save it now. Use it later.</Text>
      {authStep === "signIn" && pendingUrl && (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingBannerText}>1 link waiting — sign in to save it</Text>
        </View>
      )}
      {authStep === "signIn" && (
        <>
          {appleAvailable && (
            <View pointerEvents={busy ? "none" : "auto"}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={8}
                style={styles.appleButton}
                onPress={onApple}
              />
            </View>
          )}
          <Pressable style={styles.oauthButton} disabled={busy} onPress={() => run(signInGoogle, "Google sign-in failed")}>
            <Text style={styles.oauthLabel}>Continue with Google</Text>
          </Pressable>
          <Pressable style={styles.oauthButton} disabled={busy} onPress={() => run(signInGitHub, "GitHub sign-in failed")}>
            <Text style={styles.oauthLabel}>Continue with GitHub</Text>
          </Pressable>
          <Text style={styles.divider}>or sign in with email</Text>
        </>
      )}
      {authStep === "forgotPassword" ? (
        <>
          <Text style={styles.screenTitle}>Reset password</Text>
          <Text style={styles.screenSubtitle}>{"Enter your email and we'll send you a short reset code."}</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Pressable
            style={[styles.primaryButton, busy && styles.disabled]}
            disabled={busy || !email.trim()}
            onPress={requestPasswordReset}
          >
            <Text style={styles.primaryLabel}>{busy ? "Sending…" : "Send reset code"}</Text>
          </Pressable>
          <Pressable
            style={styles.linkButton}
            disabled={busy}
            onPress={() => setAuthStep("signIn")}
          >
            <Text style={styles.linkLabel}>Back to sign in</Text>
          </Pressable>
        </>
      ) : authStep === "resetPassword" ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="6-digit reset code"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="number-pad"
            maxLength={6}
            value={resetCode}
            onChangeText={(value) => setResetCode(value.replace(/\D/g, "").slice(0, 6))}
          />
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="New password"
              autoCapitalize="none"
              secureTextEntry={!showNewPassword}
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <Pressable
              hitSlop={8}
              accessibilityLabel={showNewPassword ? "Hide new password" : "Show new password"}
              onPress={() => setShowNewPassword(!showNewPassword)}
            >
              <Ionicons name={showNewPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#888" />
            </Pressable>
          </View>
          <Pressable
            style={[styles.primaryButton, busy && styles.disabled]}
            disabled={busy || !email.trim() || !resetCode.trim() || !newPassword}
            onPress={onResetPassword}
          >
            <Text style={styles.primaryLabel}>{busy ? "Updating…" : "Update password"}</Text>
          </Pressable>
          <Pressable
            style={styles.linkButton}
            disabled={busy}
            onPress={() => setAuthStep("signIn")}
          >
            <Text style={styles.linkLabel}>Back to sign in</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              autoCapitalize="none"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable
              hitSlop={8}
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#888" />
            </Pressable>
          </View>
          <Pressable
            style={styles.forgotButton}
            disabled={busy}
            onPress={() => setAuthStep("forgotPassword")}
          >
            <Text style={styles.linkLabel}>Forgot password?</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, busy && styles.disabled]}
            disabled={busy || !email.trim() || !password}
            onPress={onPassword}
          >
            <Text style={styles.primaryLabel}>{busy ? "Signing in…" : "Sign in"}</Text>
          </Pressable>
        </>
      )}
      {authStep === "signIn" && (
        <Text style={styles.footnote}>
          New here? Use Apple, Google, or GitHub above to create your account.
        </Text>
      )}
      {authStep === "resetPassword" && (
        <Pressable
          style={styles.linkButton}
          disabled={busy}
          onPress={requestPasswordReset}
        >
          <Text style={styles.linkLabel}>Resend reset code</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: "700", textAlign: "center" },
  subtitle: { textAlign: "center", color: "#666", marginBottom: 16 },
  pendingBanner: {
    backgroundColor: "#EEF6FF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  pendingBannerText: { textAlign: "center", color: "#1B5EAA", fontSize: 14, fontWeight: "500" },
  appleButton: { height: 48, width: "100%" },
  oauthButton: { height: 48, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  oauthLabel: { fontSize: 16, fontWeight: "500" },
  divider: { textAlign: "center", color: "#999", marginVertical: 4 },
  screenTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  screenSubtitle: { textAlign: "center", color: "#666", fontSize: 14, lineHeight: 20 },
  input: { height: 48, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, paddingHorizontal: 12, fontSize: 16 },
  passwordContainer: { height: 48, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#ccc", borderRadius: 8, paddingHorizontal: 12 },
  passwordInput: { flex: 1, fontSize: 16 },
  forgotButton: { alignSelf: "flex-end", paddingVertical: 2 },
  linkButton: { alignItems: "center", paddingVertical: 2 },
  linkLabel: { color: "#111", fontSize: 14, fontWeight: "600" },
  primaryButton: { height: 48, borderRadius: 8, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  primaryLabel: { color: "#fff", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.5 },
  footnote: { textAlign: "center", color: "#888", fontSize: 13, marginTop: 8 },
});
