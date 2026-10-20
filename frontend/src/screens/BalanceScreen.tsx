import { useCallback, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getFarmerId } from "../auth/jwt";
import { fetchBalance } from "../api/balance";

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
          ? "Cannot reach the server. Check Wi-Fi and backend."
          : e?.message ?? "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // reloads every time the farmer opens this tab
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>My carbon balance</Text>

      {loading && <ActivityIndicator style={{ marginTop: 20 }} />}
      {error && <Text style={styles.error}>{error}</Text>}
        {data && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Carbon credits earned</Text>
          <Text style={styles.cardValue}>{Number(data.balance_kg_co2).toLocaleString()}</Text>
          <Text style={styles.cardUnit}>kg CO₂</Text>
          {Number(data.balance_kg_co2) === 0 && (
            <Text style={styles.hint}>
              No credits yet. Credits appear after your trees pass satellite verification.
            </Text>
          )}
        </View>
      )}

      <Pressable style={styles.button} onPress={load} disabled={loading}>
        <Text style={styles.buttonText}>Refresh</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 20 },
  raw: { fontFamily: "monospace", marginTop: 16, color: "#222" },
  card: { backgroundColor: "#e8f5e9", borderRadius: 12, padding: 24, alignItems: "center", marginTop: 8 },
  cardLabel: { fontSize: 16, color: "#2e7d32", fontWeight: "600" },
  cardValue: { fontSize: 48, fontWeight: "700", color: "#1b5e20", marginTop: 8 },
  cardUnit: { fontSize: 18, color: "#2e7d32" },
  hint: { marginTop: 16, color: "#555", textAlign: "center" },
  error: { color: "#c62828", marginTop: 16 },
  button: { backgroundColor: "#2e7d32", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 24 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});