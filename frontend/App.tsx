import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import LoginScreen from "./src/screens/LoginScreen";
import { getToken, clearToken } from "./src/storage/tokenStore";

export default function App() {
  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<string | undefined>();

  useEffect(() => {
    getToken().then((token) => {
      setLoggedIn(!!token);
      setChecking(false);
    });
  }, []);

  if (checking) {
    return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator /></View>;
  }

  if (!loggedIn) {
    return (
      <LoginScreen
        onLoginSuccess={(r) => {
          setRole(r);
          setLoggedIn(true);
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 20 }}>Logged in{role ? ` as ${role}` : ""}</Text>
      <Pressable
        onPress={async () => { await clearToken(); setLoggedIn(false); }}
        style={{ marginTop: 20 }}
      >
        <Text style={{ color: "#c62828" }}>Log out</Text>
      </Pressable>
    </View>
  );
}