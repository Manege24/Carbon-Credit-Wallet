import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import AccountScreen from "./src/screens/AccountScreen";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import LoginScreen from "./src/screens/LoginScreen";
import PlotsScreen from "./src/screens/PlotsScreen";
import { getToken } from "./src/storage/tokenStore";

import HistoryScreen from "./src/screens/HistoryScreen";
import NetInfo from "@react-native-community/netinfo";
import { syncAll } from "./src/api/sync";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./src/theme";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import RegisterScreen from "./src/screens/RegisterScreen";
import HomeScreen from "./src/screens/HomeScreen";
import { getFarmerId } from "./src/auth/jwt";
import { ensureOwner } from "./src/storage/localDb";
import { onSessionExpired } from "./src/auth/session";
import { StatusBar } from "expo-status-bar";

const Tab = createBottomTabNavigator();
function Tabs({ onLogout }: { onLogout: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 58 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: "home-outline",
            Plots: "map-outline",
            History: "pulse-outline",
            Account: "person-outline",
          };
          return <Ionicons name={icons[route.name] ?? "ellipse-outline"} size={size} color={color} />;
        },
      })}
    > 
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Plots" component={PlotsScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Account">{() => <AccountScreen onLogout={onLogout} />}</Tab.Screen>
    </Tab.Navigator>
  );
}
function AppContent() {
  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    getToken().then((token) => {
      setLoggedIn(!!token);
      setChecking(false);
    });
  }, []);
  
  useEffect(() => {
    return onSessionExpired(() => {
      setNotice("Your session expired. Please log in again.");
      setLoggedIn(false);
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
    if (registering) {
      return (
        <RegisterScreen
          onBack={() => setRegistering(false)}
          onDone={() => {
            setNotice("Account created. Please log in.");
            setRegistering(false);
          }}
        />
      );
    }
    return (
      <LoginScreen
        notice={notice}
        onRegister={() => { setNotice(null); setRegistering(true); }}
        onLoginSuccess={async () => {
          const id = await getFarmerId();
          if (id) await ensureOwner(id);
          setLoggedIn(true);
        }}
      />
    );
  }

  

    return (
    <NavigationContainer>
        <Tabs onLogout={() => setLoggedIn(false)} />
    </NavigationContainer>   
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppContent />
    </SafeAreaProvider>
  );

}