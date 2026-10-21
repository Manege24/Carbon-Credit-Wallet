import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { clearToken } from "../storage/tokenStore";
import { colors, spacing, radius, shadow } from "../theme";

type Props = { onLogout: () => void };

export default function AccountScreen({ onLogout }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 16, paddingHorizontal: spacing.lg }}>
      <Text style={styles.title}>Account</Text>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={32} color={colors.white} />
        </View>
        <Text style={styles.name}>Farmer account</Text>
        <Text style={styles.role}>Carbon Credit Wallet</Text>
      </View>

      <Pressable
        style={styles.logout}
        onPress={async () => {
          await clearToken();
          onLogout();
        }}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "700", color: colors.primaryDark, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center", ...shadow },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  name: { fontSize: 18, fontWeight: "700", color: colors.text },
  role: { color: colors.muted, marginTop: 2 },
  logout: {
    flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: colors.error, paddingVertical: 14, borderRadius: radius.md, marginTop: spacing.lg,
  },
  logoutText: { color: colors.error, fontSize: 16, fontWeight: "700" },
});