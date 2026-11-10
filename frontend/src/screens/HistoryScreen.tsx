import { useCallback, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getFarmerId } from "../auth/jwt";
import { fetchHistory, ScanItem } from "../api/history";
import { setCache, getCache, listPlots } from "../storage/localDb";
import { colors, spacing, radius, shadow } from "../theme";

type Group = { plotId: string; scans: ScanItem[]; archived: boolean };

const OUTCOME = {
  verified: { label: "Verified", color: colors.success, bg: colors.primarySoft },
  withheld: { label: "Withheld", color: colors.accent, bg: "#F3E3D3" },
  degraded: { label: "Degraded", color: colors.error, bg: "#F8E5DF" },
  pending: { label: "Pending", color: colors.muted, bg: "#ECE7DA" },
} as const;

async function buildGroups(items: ScanItem[]): Promise<Group[]> {
  const plots = await listPlots();
  const map = new Map<string, Group>();

  for (const p of plots) {
    map.set(p.plot_id.toLowerCase(), { plotId: p.plot_id, scans: [], archived: !!p.archived });
  }
  for (const s of items) {
    const key = s.plot_id.toLowerCase();
    if (!map.has(key)) map.set(key, { plotId: s.plot_id, scans: [], archived: false });
    map.get(key)!.scans.push(s);
  }

  return Array.from(map.values())
    .filter((g) => !(g.archived && g.scans.length === 0))
    .map((g) => ({ ...g, scans: g.scans.sort((a, b) => b.scan_date.localeCompare(a.scan_date)) }));
}

function barColor(v: number) {
  if (v >= 0.6) return colors.success;
  if (v >= 0.4) return colors.accent;
  return colors.error;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const id = await getFarmerId();
      if (!id) throw new Error("Not logged in. Log out and log in again.");
      const items = await fetchHistory(id);
      await setCache("history", items);
      setGroups(await buildGroups(items));
      setOffline(false);
    } catch (e: any) {
      const cached = await getCache<ScanItem[]>("history");
      if (cached) {
        setGroups(await buildGroups(cached));
        setOffline(true);
      } else {
        setGroups(await buildGroups([]));
        setError(
          e?.message === "Network request failed"
            ? "Cannot reach the server. Check your connection."
            : e?.message ?? "Something went wrong"
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <Text style={styles.title}>Satellite checks</Text>
        <Text style={styles.sub}>NDVI shows how green your trees look from space. Higher is healthier.</Text>
        {offline && (
          <View style={styles.offline}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.accent} />
            <Text style={styles.offlineText}>Offline: showing saved data</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
        {loading && groups.length === 0 && (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        )}

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && !error && groups.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="planet-outline" size={40} color={colors.muted} />
            <Text style={styles.emptyText}>No plots yet.</Text>
          </View>
        )}

        {groups.map((g) => (
          <View key={g.plotId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="location" size={18} color={colors.primary} />
              <Text style={styles.plot}>Plot ...{g.plotId.slice(-4)}</Text>
              {g.archived && <Text style={styles.archived}>Archived</Text>}
            </View>

            {g.scans.length === 0 && (
              <View style={styles.noScan}>
                <Ionicons name="time-outline" size={16} color={colors.muted} />
                <Text style={styles.noScanText}>
                  No satellite check yet. The first check happens in the next cycle.
                </Text>
              </View>
            )}

            {g.scans.map((s) => (
              <View key={s.scan_date} style={{ marginTop: spacing.sm }}>
                <View style={styles.row}>
                  <Text style={styles.date}>{s.scan_date}</Text>
                  <View style={styles.barBg}>
                    <View
                      style={[
                        styles.bar,
                        {
                          width: `${Math.max(0, Math.min(1, s.ndvi_value)) * 100}%`,
                          backgroundColor: barColor(s.ndvi_value),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.value}>{s.ndvi_value.toFixed(2)}</Text>
                </View>

                <View style={styles.tagRow}>
                  <View style={[styles.tag, { backgroundColor: OUTCOME[s.outcome].bg }]}>
                    <Text style={[styles.tagText, { color: OUTCOME[s.outcome].color }]}>
                      {OUTCOME[s.outcome].label}
                    </Text>
                  </View>
                  {s.tokens_issued_kg > 0 && (
                    <Text style={{ color: colors.success, fontSize: 12 }}>+{s.tokens_issued_kg} kg</Text>
                  )}
                  {s.outcome === "verified" && s.tokens_issued_kg === 0 && (
                    <Text style={{ color: colors.muted, fontSize: 12 }}>no credits issued</Text>
                  )}
                  {s.tokens_revoked_kg > 0 && (
                    <Text style={{ color: colors.error, fontSize: 12 }}>{s.tokens_revoked_kg} kg revoked</Text>
                  )}
                </View>
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
  title: { fontSize: 24, fontWeight: "700", color: colors.primaryDark },
  sub: { color: colors.muted, marginTop: spacing.xs },
  offline: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: "#F3E3D3", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, marginTop: spacing.sm,
  },
  offlineText: { color: colors.accent, fontWeight: "600" },
  empty: { alignItems: "center", marginTop: spacing.xl, gap: spacing.sm },
  emptyText: { color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md, ...shadow },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.xs },
  plot: { fontWeight: "700", color: colors.primaryDark },
  archived: { marginLeft: "auto", color: colors.muted, fontSize: 12, fontWeight: "600" },
  noScan: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.xs },
  noScanText: { color: colors.muted, flex: 1 },
  row: { flexDirection: "row", alignItems: "center" },
  date: { width: 92, color: colors.text },
  barBg: { flex: 1, height: 10, backgroundColor: colors.primarySoft, borderRadius: 5, marginHorizontal: 8 },
  bar: { height: 10, borderRadius: 5 },
  value: { width: 42, textAlign: "right", fontWeight: "700", color: colors.text },
  tagRow: { flexDirection: "row", gap: 8, marginTop: 4, alignItems: "center" },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  tagText: { fontSize: 12, fontWeight: "700" },
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