import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { SettingsScreen } from "../src/screens/SettingsScreen";

export default function Settings() {
  return (
    <>
      <AuthLoading>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      </AuthLoading>
      <Unauthenticated>
        <Redirect href="/" />
      </Unauthenticated>
      <Authenticated>
        <SettingsScreen />
      </Authenticated>
    </>
  );
}
