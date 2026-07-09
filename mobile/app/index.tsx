import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { ActivityIndicator, View } from "react-native";
import { SignInScreen } from "../src/screens/SignInScreen";
import { FeedScreen } from "../src/screens/FeedScreen";
import { useShareSave } from "../src/useShareSave";
import { useToast } from "../src/components/Toast";

export default function Index() {
  const { showToast } = useToast();
  const { pendingUrl } = useShareSave(showToast);

  return (
    <>
      <AuthLoading>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      </AuthLoading>
      <Unauthenticated>
        <SignInScreen pendingUrl={pendingUrl} />
      </Unauthenticated>
      <Authenticated>
        <FeedScreen />
      </Authenticated>
    </>
  );
}
