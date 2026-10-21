import { useCallback, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getFarmerId } from "../auth/jwt";
import { fetchBalance } from "../api/balance";
import { colors, spacing, radius, shadow } from "../theme";

export default function BalanceScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const id = await getFarmerId();
      if (!id) throw new Error("Not logged in. Log out and log in again.");
      setData(await fetchBalance(id));
    } catch (e: any) {
      setData(null);
      setError(
        e?.message === "Network request failed"
          ? "Cannot reach the server. Check your connection."
          : e?.message ?? "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const kg = data ? Number(data.balance_kg_co2) : 0;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={styles.title}>My carbon balance</Text>
      <Text style={styles.subtitle}>Credits earned from verified, healthy trees.</Text>

      {loading && !data && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />}

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {data && (
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="leaf" size={22} color={colors.white} />
          </View>
          <Text style={styles.heroLabel}>Carbon credits earned</Text>
          <Text style={styles.heroValue}>{kg.toLocaleString()}</Text>
          <Text style={styles.heroUnit}>kg CO₂</Text>
        </View>
      )}

      {data && kg === 0 && (
        <View style={styles.hintBox}>
          <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
          <Text style={styles.hintText}>
            No credits yet. They appear after your trees pass satellite verification.
          </Text>
        </View>
      )}

      <Pressable style={[styles.button, loading && { opacity: 0.6 }]} onPress={load} disabled={loading}>
        <Ionicons name="refresh" size={18} color={colors.white} />
        <Text style={styles.buttonText}>Refresh</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: 64 },
  title: { fontSize: 24, fontWeight: "700", color: colors.primaryDark },
  subtitle: { color: colors.muted, marginTop: spacing.xs, marginBottom: spacing.lg },
  hero: {
    backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg,
    alignItems: "center", ...shadow,
  },
  heroIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  heroLabel: { color: "#DCE9D5", fontWeight: "600" },
  heroValue: { color: colors.white, fontSize: 56, fontWeight: "800", marginTop: spacing.xs },
  heroUnit: { color: "#DCE9D5", fontSize: 18 },
  hintBox: {
    flexDirection: "row", gap: 10, alignItems: "center", marginTop: spacing.md,
    backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  hintText: { flex: 1, color: colors.text },
  errorBox: {
    flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: "#F8E5DF",
    padding: 12, borderRadius: radius.sm,
  },
  errorText: { color: colors.error, flex: 1 },
  button: {
    flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center",
    backgroundColor: colors.primaryDark, paddingVertical: 14, borderRadius: radius.md, marginTop: spacing.lg,
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "700" },
});