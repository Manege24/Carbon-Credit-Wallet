import { useCallback, useState } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Crypto from "expo-crypto";
import BatchForm from "./BatchForm";
import { savePlotLocally, countPending } from "../storage/localDb";
import { syncAll } from "../api/sync";
import { colors, spacing, radius, shadow } from "../theme";

export default function PlotsScreen() {
  const insets = useSafeAreaInsets();
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radiusText, setRadiusText] = useState("50");
  const [plotId, setPlotId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [pending, setPending] = useState(0);

    useFocusEffect(
    useCallback(() => {
      const refresh = () => countPending().then(setPending).catch(() => {});
      refresh();
      const timer = setInterval(refresh, 5000);
      return () => clearInterval(timer);
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

  async function save() {
    if (lat === null || lng === null) return;
    const r = Number(radiusText);
    if (!(r > 0 && r <= 2000)) {
      setIsError(true);
      setMessage("Radius must be more than 0 and at most 2000 metres.");
      return;
    }
    setBusy(true);
    setMessage(null);
    setPlotId(null);
    try {
      const id = Crypto.randomUUID();
      await savePlotLocally({ plot_id: id, lat, lng, radius: r });
      setPlotId(id);
      setIsError(false);
      try {
        await syncAll();
        setMessage("Plot saved and uploaded. Now add your trees below.");
      } catch {
        setMessage("Plot saved on your phone. It will upload when you are online. Add your trees below.");
      }
      setPending(await countPending());
    } catch (e: any) {
      setIsError(true);
      setMessage(e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const canSave = !busy && lat !== null && !!radiusText;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <Text style={styles.title}>Register a plot</Text>
        <Text style={styles.sub}>Stand in your plot and capture its location.</Text>
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
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={radiusText}
            onChangeText={setRadiusText}
          />

          <Pressable style={[styles.button, !canSave && { opacity: 0.5 }]} onPress={save} disabled={!canSave}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Save plot</Text>}
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

        {plotId && <BatchForm plotId={plotId} onSaved={() => countPending().then(setPending)} />}
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