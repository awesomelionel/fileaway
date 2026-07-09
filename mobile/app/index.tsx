import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { ActivityIndicator, View } from "react-native";
import { SignInScreen } from "../src/screens/SignInScreen";
import { FeedScreen } from "../src/screens/FeedScreen";

export default function Index() {
  return (
    <>
      <AuthLoading>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      </AuthLoading>
      <Unauthenticated>
        <SignInScreen />
      </Unauthenticated>
      <Authenticated>
        <FeedScreen />
      </Authenticated>
    </>
  );
}
