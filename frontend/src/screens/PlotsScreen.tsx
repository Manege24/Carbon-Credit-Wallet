import { useCallback, useState } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Crypto from "expo-crypto";
import { savePlotLocally, saveBatchLocally, countPending } from "../storage/localDb";
import { syncAll } from "../api/sync";
import { colors, spacing, radius, shadow } from "../theme";

export default function PlotsScreen() {
  const insets = useSafeAreaInsets();
  const today = new Date().toISOString().slice(0, 10);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radiusText, setRadiusText] = useState("50");
  const [count, setCount] = useState("");
  const [species, setSpecies] = useState("");
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [pending, setPending] = useState(0);

  function resetForm() {
    setLat(null);
    setLng(null);
    setRadiusText("50");
    setCount("");
    setSpecies("");
    setDate(new Date().toISOString().slice(0, 10));
  }

  useFocusEffect(
    useCallback(() => {
      const refresh = () => countPending().then(setPending).catch(() => {});
      refresh();
      const timer = setInterval(refresh, 5000);
      return () => {
        clearInterval(timer);
        resetForm();
        setMessage(null);
        setIsError(false);
      };
    }, [])
  );

  async function getLocation() {
    setMessage(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setIsError(true);
      setMessage("Location permission denied. Allow it in phone settings.");
      return;
    }
    setBusy(true);
    try {
      const pos = await Location.getCurrentPositionAsync({});
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
    } catch {
      setIsError(true);
      setMessage("Could not get GPS position. Try outdoors.");
    } finally {
      setBusy(false);
    }
  }

  function fail(text: string) {
    setIsError(true);
    setMessage(text);
  }

  async function save() {
    if (lat === null || lng === null) return fail("Capture your location first.");
    const r = Number(radiusText);
    if (!(r > 0 && r <= 2000)) return fail("Radius must be more than 0 and at most 2000 metres.");
    const n = Number(count);
    if (!Number.isInteger(n) || n <= 0) return fail("Tree count must be a whole number above 0.");
    if (!species.trim()) return fail("Enter the tree species.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Date must look like 2026-10-14.");

    setBusy(true);
    setMessage(null);
    try {
      const id = Crypto.randomUUID();
      await savePlotLocally({ plot_id: id, lat, lng, radius: r });
      await saveBatchLocally({ plot_id: id, tree_count: n, species_type: species.trim(), date_planted: date });
      setIsError(false);
      try {
        await syncAll();
        setMessage("Plot and trees saved and uploaded.");
      } catch {
        setMessage("Saved on your phone. It will upload when you are online.");
      }
      resetForm();
      setPending(await countPending());
    } catch (e: any) {
      fail(e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <Text style={styles.title}>Register a plot</Text>
        <Text style={styles.sub}>Stand in your plot, capture its location and record the trees.</Text>
        {pending > 0 && (
          <View style={styles.badge}>
            <Ionicons name="cloud-upload-outline" size={16} color={colors.accent} />
            <Text style={styles.badgeText}>{pending} waiting to upload</Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.step}>1. Location</Text>
          <Pressable style={styles.secondary} onPress={getLocation} disabled={busy}>
            <Ionicons name="locate" size={20} color={colors.primary} />
            <Text style={styles.secondaryText}>Use my current location</Text>
          </Pressable>
          <View style={styles.coordsRow}>
            <Ionicons name="location-outline" size={18} color={colors.muted} />
            <Text style={styles.coords}>
              {lat === null ? "No location yet" : `${lat.toFixed(6)}, ${lng!.toFixed(6)}`}
            </Text>
          </View>

          <Text style={styles.label}>Plot radius (metres)</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={radiusText} onChangeText={setRadiusText} />

          <Text style={[styles.step, { marginTop: spacing.lg }]}>2. Trees</Text>
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
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Save plot and trees</Text>}
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "700", color: colors.primaryDark },
  sub: { color: colors.muted, marginTop: spacing.xs },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: "#F3E3D3", paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, marginTop: spacing.sm,
  },
  badgeText: { color: colors.accent, fontWeight: "600" },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, ...shadow },
  step: { fontSize: 16, fontWeight: "700", color: colors.primaryDark, marginBottom: spacing.sm },
  secondary: {
    flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: colors.primary, paddingVertical: 14, borderRadius: radius.md,
  },
  secondaryText: { color: colors.primary, fontSize: 16, fontWeight: "700" },
  coordsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md },
  coords: { color: colors.text },
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