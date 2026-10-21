import { View, Text, Pressable } from "react-native";
import { clearToken } from "../storage/tokenStore";

type Props = { onLogout: () => void };

export default function AccountScreen({ onLogout }: Props) {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Pressable
        onPress={async () => {
          await clearToken();
          onLogout();
        }}
      >
        <Text style={{ color: "#c62828", fontSize: 18 }}>Log out</Text>
      </Pressable>
    </View>
  );
}