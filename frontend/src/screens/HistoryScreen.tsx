import { useCallback, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getFarmerId } from "../auth/jwt";
import { fetchHistory, ScanItem } from "../api/history";

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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Satellite checks</Text>
      <Text style={styles.sub}>NDVI measures how green your trees look from space. Higher is healthier.</Text>

      {loading && <ActivityIndicator style={{ marginTop: 20 }} />}
      {error && <Text style={styles.error}>{error}</Text>}
      {!loading && !error && groups.length === 0 && (
        <Text style={styles.empty}>No satellite checks yet.</Text>
      )}

      {groups.map((g) => (
        <View key={g.plotId} style={styles.card}>
          <Text style={styles.plot}>Plot ...{g.plotId.slice(-4)}</Text>
          {g.scans.map((s) => (
            <View key={s.scan_date} style={styles.row}>
              <Text style={styles.date}>{s.scan_date}</Text>
              <View style={styles.barBg}>
                <View style={[styles.bar, { width: `${Math.max(0, Math.min(1, s.ndvi_value)) * 100}%` }]} />
              </View>
              <Text style={styles.value}>{s.ndvi_value.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      ))}

      <Pressable style={styles.button} onPress={load} disabled={loading}>
        <Text style={styles.buttonText}>Refresh</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: "700" },
  sub: { color: "#555", marginTop: 6, marginBottom: 12 },
  empty: { color: "#555", marginTop: 20 },
  card: { backgroundColor: "#f1f8e9", borderRadius: 12, padding: 16, marginTop: 16 },
  plot: { fontWeight: "700", marginBottom: 8, color: "#1b5e20" },
  row: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  date: { width: 90, color: "#333" },
  barBg: { flex: 1, height: 10, backgroundColor: "#dcedc8", borderRadius: 5, marginHorizontal: 8 },
  bar: { height: 10, backgroundColor: "#2e7d32", borderRadius: 5 },
  value: { width: 40, textAlign: "right", fontWeight: "600" },
  error: { color: "#c62828", marginTop: 16 },
  button: { backgroundColor: "#2e7d32", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 24 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});