import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { saveBatchLocally } from "../storage/localDb";
import { syncAll } from "../api/sync";

type Props = { plotId: string };

export default function BatchForm({ plotId }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [count, setCount] = useState("");
  const [species, setSpecies] = useState("");
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function save() {
    const n = Number(count);
    if (!Number.isInteger(n) || n <= 0) {
      setIsError(true);
      setMessage("Tree count must be a whole number above 0.");
      return;
    }
    if (!species.trim()) {
      setIsError(true);
      setMessage("Enter the tree species.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setIsError(true);
      setMessage("Date must look like 2026-10-14.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await saveBatchLocally({ plot_id: plotId, tree_count: n, species_type: species.trim(), date_planted: date });
      setIsError(false);
      try {
        await syncAll();
        setMessage("Tree batch saved and uploaded.");
      } catch {
        setMessage("Tree batch saved on your phone. It will upload when you are online.");
      }
      setCount("");
      setSpecies("");
    } catch (e: any) {
      setIsError(true);
      setMessage(
        e?.message === "Network request failed"
          ? "Cannot reach the server. Check Wi-Fi and backend."
          : e?.message ?? "Something went wrong"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Add trees to this plot</Text>

      <Text style={styles.label}>Number of trees</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={count} onChangeText={setCount} />

      <Text style={styles.label}>Species</Text>
      <TextInput style={styles.input} value={species} onChangeText={setSpecies} />

      <Text style={styles.label}>Date planted (YYYY-MM-DD)</Text>
      <TextInput style={styles.input} value={date} onChangeText={setDate} autoCapitalize="none" />

      <Pressable style={[styles.button, busy && { opacity: 0.5 }]} onPress={save} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save trees</Text>}
      </Pressable>

      {message && <Text style={isError ? styles.error : styles.ok}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 32, paddingTop: 20, borderTopWidth: 1, borderTopColor: "#ddd" },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  label: { marginTop: 12, marginBottom: 6, fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: "#2e7d32", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 20 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#c62828", marginTop: 16 },
  ok: { color: "#2e7d32", marginTop: 16 },
});