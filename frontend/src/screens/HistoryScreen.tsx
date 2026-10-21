import { useCallback, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getFarmerId } from "../auth/jwt";
import { fetchHistory, ScanItem } from "../api/history";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, shadow } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Group = { plotId: string; scans: ScanItem[] };

function groupByPlot(items: ScanItem[]): Group[] {
  const map = new Map<string, ScanItem[]>();
  for (const it of items) {
    if (!map.has(it.plot_id)) map.set(it.plot_id, []);
    map.get(it.plot_id)!.push(it);
  }
  return Array.from(map.entries()).map(([plotId, scans]) => ({
    plotId,
    scans: scans.sort((a, b) => b.scan_date.localeCompare(a.scan_date)),
  }));
}

export default function HistoryScreen() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const id = await getFarmerId();
      if (!id) throw new Error("Not logged in. Log out and log in again.");
      setGroups(groupByPlot(await fetchHistory(id)));
    } catch (e: any) {
      setGroups([]);
      setError(
        e?.message === "Network request failed"
          ? "Cannot reach the server. Check Wi-Fi and backend."
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

  function barColor(v: number) {
    if (v >= 0.6) return colors.success;
    if (v >= 0.4) return colors.accent;
    return colors.error;
  }
  const insets = useSafeAreaInsets();
  return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <Text style={styles.title}>Satellite checks</Text>
        <Text style={styles.sub}>NDVI shows how green your trees look from space. Higher is healthier.</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>

      {loading && groups.length === 0 && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />}

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && groups.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="planet-outline" size={40} color={colors.muted} />
          <Text style={styles.emptyText}>No satellite checks yet.</Text>
        </View>
      )}

      {groups.map((g) => (
        <View key={g.plotId} style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="location" size={18} color={colors.primary} />
            <Text style={styles.plot}>Plot ...{g.plotId.slice(-4)}</Text>
          </View>
          {g.scans.map((s) => (
            <View key={s.scan_date} style={styles.row}>
              <Text style={styles.date}>{s.scan_date}</Text>
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.bar,
                    { width: `${Math.max(0, Math.min(1, s.ndvi_value)) * 100}%`, backgroundColor: barColor(s.ndvi_value) },
                  ]}
                />
              </View>
              <Text style={styles.value}>{s.ndvi_value.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      ))}

      <Pressable style={[styles.button, loading && { opacity: 0.6 }]} onPress={load} disabled={loading}>
        <Ionicons name="refresh" size={18} color={colors.white} />
        <Text style={styles.buttonText}>Refresh</Text>
      </Pressable>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: 72, paddingBottom: spacing.xl },
  title: { fontSize: 24, fontWeight: "700", color: colors.primaryDark },
  sub: { color: colors.muted, marginTop: spacing.xs, marginBottom: spacing.md },
  empty: { alignItems: "center", marginTop: spacing.xl, gap: spacing.sm },
  emptyText: { color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md, ...shadow },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.xs },
  plot: { fontWeight: "700", color: colors.primaryDark },
  row: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
  date: { width: 92, color: colors.text },
  barBg: { flex: 1, height: 10, backgroundColor: colors.primarySoft, borderRadius: 5, marginHorizontal: 8 },
  bar: { height: 10, borderRadius: 5 },
  value: { width: 42, textAlign: "right", fontWeight: "700", color: colors.text },
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