import { Stack } from "expo-router";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import * as SecureStore from "expo-secure-store";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ToastProvider } from "../src/components/Toast";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

const secureStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ConvexAuthProvider client={convex} storage={secureStorage}>
        <ToastProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </ToastProvider>
      </ConvexAuthProvider>
    </SafeAreaProvider>
  );
}
