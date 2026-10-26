import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getFarmerId } from "../auth/jwt";
import { fetchHistory } from "../api/history";
import {
  buildNotices, saveNotices, loadNotices, getSeen, markAllSeen, dismissNotices, Notice,
} from "../notifications";
import { colors, spacing, radius, shadow } from "../theme";

const KIND: Record<Notice["kind"], { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  good: { icon: "checkmark-circle", color: colors.success },
  warn: { icon: "time", color: colors.accent },
  bad: { icon: "warning", color: colors.error },
  info: { icon: "information-circle", color: colors.muted },
};

export default function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const [offline, setOffline] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setSeen(await getSeen());
        try {
          const id = await getFarmerId();
          if (!id) throw new Error("no id");
          await saveNotices(buildNotices(await fetchHistory(id)));
          setOffline(false);
        } catch {
          setOffline(true);
        }
        const visible = await loadNotices();
        setNotices(visible);
        await markAllSeen(visible);
      })();
    }, [])
  );

  async function remove(id: string) {
    await dismissNotices([id]);
    setNotices((prev) => prev.filter((n) => n.id !== id));
  }

  async function clearAll() {
    await dismissNotices(notices.map((n) => n.id));
    setNotices([]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <Pressable onPress={onBack} style={styles.back} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.primaryDark} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Notifications</Text>
          {notices.length > 0 && (
            <Pressable onPress={clearAll} hitSlop={10} style={{ marginRight: 56 }}>
              <Text style={styles.clear}>Clear all</Text>
            </Pressable>
          )}
        </View>
        {offline && <Text style={styles.offline}>Offline: showing saved notifications</Text>}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
        {notices.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={36} color={colors.muted} />
            <Text style={styles.emptyText}>Nothing here. Updates appear after your plots are checked from space.</Text>
          </View>
        )}
        {notices.map((n) => {
          const k = KIND[n.kind];
          const isNew = !seen.includes(n.id);
          return (
            <View key={n.id} style={[styles.card, isNew && styles.cardNew]}>
              <Ionicons name={k.icon} size={26} color={k.color} />
              <View style={{ flex: 1 }}>
                <View style={styles.row}>
                  <Text style={styles.cardTitle}>{n.title}</Text>
                  <Text style={styles.date}>{n.date}</Text>
                </View>
                <Text style={styles.body}>{n.body}</Text>
              </View>
              <Pressable onPress={() => remove(n.id)} hitSlop={10}>
                <Ionicons name="close" size={20} color={colors.muted} />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  backText: { color: colors.primaryDark, fontWeight: "600" },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "700", color: colors.primaryDark },
  clear: { color: colors.primary, fontWeight: "700" },
  offline: { color: colors.accent, marginTop: spacing.xs, fontWeight: "600" },
  empty: { alignItems: "center", marginTop: spacing.xl, gap: spacing.sm },
  emptyText: { color: colors.muted, textAlign: "center" },
  card: {
    flexDirection: "row", gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginTop: spacing.md, ...shadow,
  },
  cardNew: { borderWidth: 1.5, borderColor: colors.primary },
  row: { flexDirection: "row", justifyContent: "space-between" },
  cardTitle: { fontWeight: "700", color: colors.text },
  date: { color: colors.muted, fontSize: 12 },
  body: { color: colors.text, marginTop: 4 },
});