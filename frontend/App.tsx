import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import LoginScreen from "./src/screens/LoginScreen";
import PlotsScreen from "./src/screens/PlotsScreen";
import { getToken, clearToken } from "./src/storage/tokenStore";

const Tab = createBottomTabNavigator();

export default function App() {
  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

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
    return <LoginScreen onLoginSuccess={() => setLoggedIn(true)} />;
  }

  function AccountScreen() {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Pressable onPress={async () => { await clearToken(); setLoggedIn(false); }}>
          <Text style={{ color: "#c62828", fontSize: 18 }}>Log out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerShown: false }}>
        <Tab.Screen name="Plots" component={PlotsScreen} />
        <Tab.Screen name="Account" component={AccountScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}