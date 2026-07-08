import { Text, View } from "react-native";
import { api } from "../src/backend";

console.log("typeof api", typeof api);

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>fileaway</Text>
    </View>
  );
}
