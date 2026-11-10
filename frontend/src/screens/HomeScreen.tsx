import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getFarmerId } from "../auth/jwt";
import { fetchBalance } from "../api/balance";
import { fetchHistory } from "../api/history";
import { fetchMyPlots } from "../api/plots";
import { fetchProfile, Profile } from "../api/profile";
import {
  listPlots,
  countPending,
  setCache,
  getCache,
  mergeServerPlots,
  LocalPlot,
} from "../storage/localDb";
import { unreadCount, saveNotices, buildNotices } from "../notifications";
import { greetingForNow, firstName } from "../greeting";
import NotificationsScreen from "./NotificationsScreen";
import PlotDetailScreen from "./PlotDetailScreen";
import { colors, spacing, radius, shadow } from "../theme";

type Latest = Record<string, { date: string; ndvi: number }>;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [plots, setPlots] = useState<LocalPlot[]>([]);
  const [pending, setPending] = useState(0);
  const [balance, setBalance] = useState<number | null>(null);
  const [latest, setLatest] = useState<Latest>({});
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);
  const [showNotices, setShowNotices] = useState(false);
  const [openPlot, setOpenPlot] = useState<string | null>(null);
  const [name, setName] = useState<string>("");

  const load = useCallback(async () => {
    setPlots(await listPlots());
    setPending(await countPending());

    try {
      const id = await getFarmerId();
      if (!id) throw new Error("no id");

      await mergeServerPlots(await fetchMyPlots());
      setPlots(await listPlots());

      const b = await fetchBalance(id);
      const kg = Number(b.balance_kg_co2);
      setBalance(kg);
      await setCache("balance", kg);

      const hist = await fetchHistory(id);
      const map: Latest = {};
      for (const s of hist) {
        const key = s.plot_id.toLowerCase();
        if (!map[key] || s.scan_date > map[key].date) {
          map[key] = { date: s.scan_date, ndvi: s.ndvi_value };
        }
      }
      setLatest(map);
      await setCache("latest", map);
      await saveNotices(buildNotices(hist));
      setOffline(false);
    } catch {
      setBalance(await getCache<number>("balance"));
      setLatest((await getCache<Latest>("latest")) ?? {});
      setOffline(true);
    }

    try {
      const p = await fetchProfile();
      setName(p.full_name);
      await setCache("profile", p);
    } catch {
      const cached = await getCache<Profile>("profile");
      setName(cached?.full_name ?? "");
    }

    setUnread(await unreadCount());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (showNotices) {
    return (
      <NotificationsScreen
        onBack={() => {
          setShowNotices(false);
          load();
        }}
      />
    );
  }

  if (openPlot) {
    return (
      <PlotDetailScreen
        plotId={openPlot}
        onBack={() => {
          setOpenPlot(null);
          load();
        }}
      />
    );
  }

  const activePlots = plots.filter((p) => !p.archived);
  const totalTrees = activePlots.reduce((n, p) => n + p.trees, 0);
  const initial = (firstName(name) || "?").charAt(0).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting} numberOfLines={1}>
              {greetingForNow()}
              {name ? `, ${firstName(name)}` : ""}
            </Text>
          </View>
          <Pressable onPress={() => setShowNotices(true)} hitSlop={10} style={styles.bell}>
            <Ionicons name="notifications-outline" size={22} color={colors.primaryDark} />
            {unread > 0 && (
              <View style={styles.dot}>
                <Text style={styles.dotText}>{unread > 9 ? "9+" : unread}</Text>
              </View>
            )}
          </Pressable>
        </View>
        {offline && (
          <View style={styles.offline}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.accent} />
            <Text style={styles.offlineText}>Offline: showing saved data</Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Carbon credits earned</Text>
          <Text style={styles.heroValue}>{balance === null ? "--" : balance.toLocaleString()}</Text>
          <Text style={styles.heroUnit}>kg CO₂</Text>
        </View>

        <View style={styles.statsRow}>
          <Stat icon="map-outline" value={activePlots.length} label="Plots" />
          <Stat icon="leaf-outline" value={totalTrees} label="Trees" />
          <Stat icon="cloud-upload-outline" value={pending} label="To upload" />
        </View>

        <Text style={styles.section}>My plots</Text>

        {activePlots.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="map-outline" size={36} color={colors.muted} />
            <Text style={styles.emptyText}>No plots yet. Register one in the Plots tab.</Text>
          </View>
        )}

        {activePlots.map((p) => {
          const scan = latest[p.plot_id.toLowerCase()];
          return (
            <Pressable key={p.plot_id} style={styles.card} onPress={() => setOpenPlot(p.plot_id)}>
              <View style={styles.cardTop}>
                <Text style={styles.plotName}>Plot ...{p.plot_id.slice(-4)}</Text>
                <View style={[styles.pill, p.synced ? styles.pillOk : styles.pillWait]}>
                  <Text style={[styles.pillText, { color: p.synced ? colors.success : colors.accent }]}>
                    {p.synced ? "Uploaded" : "Waiting to upload"}
                  </Text>
                </View>
              </View>
              <Text style={styles.line}>
                {p.trees} trees in {p.batches} batch{p.batches === 1 ? "" : "es"} · radius {p.radius} m
              </Text>
              <Text style={styles.line}>
                {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
              </Text>
              <Text style={styles.ndvi}>
                {scan ? `Latest NDVI ${scan.ndvi.toFixed(2)} (${scan.date})` : "No satellite check yet"}
              </Text>
              <Text style={styles.tap}>Tap to view or add trees</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Stat({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: colors.white, fontSize: 18, fontWeight: "700" },
  greeting: { fontSize: 20, fontWeight: "700", color: colors.primaryDark },
  bell: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center", ...shadow,
  },
  dot: {
    position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 3,
  },
  dotText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  offline: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: "#F3E3D3", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, marginTop: spacing.sm,
  },
  offlineText: { color: colors.accent, fontWeight: "600" },
  hero: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center", ...shadow },
  heroLabel: { color: "#DCE9D5", fontWeight: "600" },
  heroValue: { color: colors.white, fontSize: 52, fontWeight: "800", marginTop: spacing.xs },
  heroUnit: { color: "#DCE9D5", fontSize: 16 },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  stat: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    alignItems: "center", ...shadow,
  },
  statValue: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 4 },
  statLabel: { color: colors.muted, fontSize: 12 },
  section: { fontSize: 18, fontWeight: "700", color: colors.primaryDark, marginTop: spacing.lg },
  empty: { alignItems: "center", marginTop: spacing.lg, gap: spacing.sm },
  emptyText: { color: colors.muted, textAlign: "center" },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md, ...shadow },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  plotName: { fontWeight: "700", color: colors.primaryDark, fontSize: 16 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pillOk: { backgroundColor: colors.primarySoft },
  pillWait: { backgroundColor: "#F3E3D3" },
  pillText: { fontSize: 12, fontWeight: "700" },
  line: { color: colors.text, marginTop: 6 },
  ndvi: { color: colors.muted, marginTop: 8 },
  tap: { color: colors.primary, marginTop: 6, fontWeight: "600", fontSize: 12 },
});