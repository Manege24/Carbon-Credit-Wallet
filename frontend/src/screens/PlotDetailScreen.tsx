import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import BatchForm from "./BatchForm";
import { LocalPlot, listBatches, listPlots, getCache } from "../storage/localDb";
import { fetchHistory, ScanItem } from "../api/history";
import { getFarmerId } from "../auth/jwt";
import { colors, spacing, radius, shadow } from "../theme";

const OUTCOME = {
  verified: { label: "Verified", color: colors.success, bg: colors.primarySoft },
  withheld: { label: "Withheld", color: colors.accent, bg: "#F3E3D3" },
  degraded: { label: "Degraded", color: colors.error, bg: "#F8E5DF" },
  pending: { label: "Pending", color: colors.muted, bg: "#ECE7DA" },
} as const;

function barColor(v: number) {
  if (v >= 0.6) return colors.success;
  if (v >= 0.4) return colors.accent;
  return colors.error;
}

type Props = { plotId: string; onBack: () => void };

export default function PlotDetailScreen({ plotId, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [plot, setPlot] = useState<LocalPlot | null>(null);
  const [batches, setBatches] = useState<Awaited<ReturnType<typeof listBatches>>>([]);
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    const all = await listPlots();
    setPlot(all.find((p) => p.plot_id.toLowerCase() === plotId.toLowerCase()) ?? null);
    setBatches(await listBatches(plotId));

    let items: ScanItem[] = [];
    try {
      const id = await getFarmerId();
      if (!id) throw new Error("no id");
      items = await fetchHistory(id);
    } catch {
      items = (await getCache<ScanItem[]>("history")) ?? [];
    }
    setScans(
      items
        .filter((s) => s.plot_id.toLowerCase() === plotId.toLowerCase())
        .sort((a, b) => b.scan_date.localeCompare(a.scan_date))
    );
  }, [plotId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totalTrees = batches.reduce((n, b) => n + b.tree_count, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <Pressable onPress={onBack} style={styles.back} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.primaryDark} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Plot ...{plotId.slice(-4)}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
        {plot && (
          <View style={styles.card}>
            <Text style={styles.line}>{totalTrees} trees in {batches.length} batch{batches.length === 1 ? "" : "es"}</Text>
            <Text style={styles.muted}>Radius {plot.radius} m · {plot.lat.toFixed(5)}, {plot.lng.toFixed(5)}</Text>
            <View style={[styles.pill, plot.synced ? styles.pillOk : styles.pillWait]}>
              <Text style={{ color: plot.synced ? colors.success : colors.accent, fontWeight: "700", fontSize: 12 }}>
                {plot.synced ? "Uploaded" : "Waiting to upload"}
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.section}>Tree batches</Text>
        {batches.length === 0 && <Text style={styles.muted}>No trees recorded yet.</Text>}
        {batches.map((b) => (
          <View key={b.id} style={styles.batch}>
            <Text style={styles.line}>{b.tree_count} × {b.species_type}</Text>
            <Text style={styles.muted}>
              Planted {b.date_planted}{b.synced ? "" : " · waiting to upload"}
            </Text>
          </View>
        ))}

        <Pressable style={styles.addBtn} onPress={() => setShowForm((v) => !v)}>
          <Ionicons name={showForm ? "close" : "add"} size={20} color={colors.primary} />
          <Text style={styles.addText}>{showForm ? "Close form" : "Add more trees"}</Text>
        </Pressable>
        {showForm && <BatchForm plotId={plotId} onSaved={load} />}

        <Text style={styles.section}>Satellite history</Text>
        {scans.length === 0 && <Text style={styles.muted}>No satellite check yet.</Text>}
        {scans.map((s) => (
          <View key={s.scan_date} style={{ marginTop: spacing.sm }}>
            <View style={styles.row}>
              <Text style={styles.date}>{s.scan_date}</Text>
              <View style={styles.barBg}>
                <View style={[styles.bar, {
                  width: `${Math.max(0, Math.min(1, s.ndvi_value)) * 100}%`,
                  backgroundColor: barColor(s.ndvi_value),
                }]} />
              </View>
              <Text style={styles.value}>{s.ndvi_value.toFixed(2)}</Text>
            </View>
            <View style={styles.tagRow}>
              <View style={[styles.tag, { backgroundColor: OUTCOME[s.outcome].bg }]}>
                <Text style={[styles.tagText, { color: OUTCOME[s.outcome].color }]}>{OUTCOME[s.outcome].label}</Text>
              </View>
              {s.tokens_issued_kg > 0 && <Text style={{ color: colors.success, fontSize: 12 }}>+{s.tokens_issued_kg} kg</Text>}
              {s.tokens_revoked_kg > 0 && <Text style={{ color: colors.error, fontSize: 12 }}>{s.tokens_revoked_kg} kg revoked</Text>}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  backText: { color: colors.primaryDark, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "700", color: colors.primaryDark },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, ...shadow },
  line: { color: colors.text, fontWeight: "600" },
  muted: { color: colors.muted, marginTop: 4 },
  pill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginTop: spacing.sm },
  pillOk: { backgroundColor: colors.primarySoft },
  pillWait: { backgroundColor: "#F3E3D3" },
  section: { fontSize: 18, fontWeight: "700", color: colors.primaryDark, marginTop: spacing.lg, marginBottom: spacing.xs },
  batch: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm, ...shadow },
  addBtn: {
    flexDirection: "row", gap: 6, justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: colors.primary, paddingVertical: 12, borderRadius: radius.md, marginTop: spacing.md,
  },
  addText: { color: colors.primary, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center" },
  date: { width: 92, color: colors.text },
  barBg: { flex: 1, height: 10, backgroundColor: colors.primarySoft, borderRadius: 5, marginHorizontal: 8 },
  bar: { height: 10, borderRadius: 5 },
  value: { width: 42, textAlign: "right", fontWeight: "700", color: colors.text },
  tagRow: { flexDirection: "row", gap: 8, marginTop: 4, alignItems: "center" },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  tagText: { fontSize: 12, fontWeight: "700" },
});