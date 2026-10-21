import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import AccountScreen from "./src/screens/AccountScreen";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import LoginScreen from "./src/screens/LoginScreen";
import PlotsScreen from "./src/screens/PlotsScreen";
import { getToken } from "./src/storage/tokenStore";
import BalanceScreen from "./src/screens/BalanceScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import NetInfo from "@react-native-community/netinfo";
import { syncAll } from "./src/api/sync";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./src/theme";

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
  useEffect(() => {
    if (!loggedIn) return;
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) syncAll().catch(() => {});
    });
    const timer = setInterval(() => {
      syncAll().catch(() => {});
    }, 15000);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [loggedIn]);

  if (checking) {
    return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator /></View>;
  }

  if (!loggedIn) {
    return <LoginScreen onLoginSuccess={() => setLoggedIn(true)} />;
  }

  

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 64, paddingBottom: 8, paddingTop: 6 },
          tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
          tabBarIcon: ({ color, size }) => {
            const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
              Plots: "map-outline",
              Balance: "wallet-outline",
              History: "pulse-outline",
              Account: "person-outline",
            };
            return <Ionicons name={icons[route.name] ?? "ellipse-outline"} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Plots" component={PlotsScreen} />
        <Tab.Screen name="Balance" component={BalanceScreen} />
        <Tab.Screen name="History" component={HistoryScreen} />
        <Tab.Screen name="Account">
          {() => <AccountScreen onLogout={() => setLoggedIn(false)} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}