import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { saveBatchLocally } from "../storage/localDb";
import { syncAll } from "../api/sync";
import { colors, spacing, radius, shadow } from "../theme";

type Props = { plotId: string; onSaved?: () => void; onDone?: () => void };

export default function BatchForm({ plotId, onSaved, onDone }: Props) {
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
      onSaved?.();
      setTimeout(() => onDone?.(), 2500);
    } catch (e: any) {
      setIsError(true);
      setMessage(e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="leaf" size={20} color={colors.primary} />
        <Text style={styles.title}>Add trees to this plot</Text>
      </View>

      <Text style={styles.label}>Number of trees</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={count} onChangeText={setCount} />

      <Text style={styles.label}>Species</Text>
      <TextInput
        style={styles.input}
        value={species}
        onChangeText={setSpecies}
        placeholder="e.g. Grevillea robusta"
        placeholderTextColor={colors.muted}
      />

      <Text style={styles.label}>Date planted (YYYY-MM-DD)</Text>
      <TextInput style={styles.input} value={date} onChangeText={setDate} autoCapitalize="none" />

      <Pressable style={[styles.button, busy && { opacity: 0.5 }]} onPress={save} disabled={busy}>
        {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Save trees</Text>}
      </Pressable>

      {message && (
        <View style={[styles.msgBox, isError ? styles.msgError : styles.msgOk]}>
          <Ionicons
            name={isError ? "alert-circle-outline" : "checkmark-circle-outline"}
            size={18}
            color={isError ? colors.error : colors.success}
          />
          <Text style={{ flex: 1, color: isError ? colors.error : colors.success }}>{message}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md, ...shadow },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 18, fontWeight: "700", color: colors.primaryDark },
  label: { marginTop: spacing.md, marginBottom: spacing.sm, fontWeight: "600", color: colors.text },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: 14, fontSize: 16, backgroundColor: colors.white, color: colors.text,
  },
  button: {
    backgroundColor: colors.primary, paddingVertical: 15, borderRadius: radius.md,
    alignItems: "center", marginTop: spacing.lg,
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "700" },
  msgBox: { flexDirection: "row", gap: 8, alignItems: "center", padding: 12, borderRadius: radius.sm, marginTop: spacing.md },
  msgError: { backgroundColor: "#F8E5DF" },
  msgOk: { backgroundColor: colors.primarySoft },
});