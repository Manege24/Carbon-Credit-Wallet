import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, ScrollView } from "react-native";
import * as Location from "expo-location";
import { createPlot } from "../api/plots";
import BatchForm from "./BatchForm";
import * as Crypto from "expo-crypto";
import { savePlotLocally } from "../storage/localDb";
import { syncAll } from "../api/sync";

export default function PlotsScreen() {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radius, setRadius] = useState("50");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [plotId, setPlotId] = useState<string | null>(null);

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
    const r = Number(radius);
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
    } catch (e: any) {
      setIsError(true);
      setMessage(e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Register a plot</Text>

      <Pressable style={styles.secondary} onPress={getLocation} disabled={busy}>
        <Text style={styles.secondaryText}>Use my current location</Text>
      </Pressable>

      <Text style={styles.coords}>
        {lat === null ? "No location yet" : `Lat ${lat.toFixed(6)}, Lng ${lng!.toFixed(6)}`}
      </Text>

      <Text style={styles.label}>Plot radius (metres)</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={radius} onChangeText={setRadius} />

      <Pressable
        style={[styles.button, (busy || lat === null || !radius) && { opacity: 0.5 }]}
        onPress={save}
        disabled={busy || lat === null || !radius}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save plot</Text>}
      </Pressable>

      {message && <Text style={isError ? styles.error : styles.ok}>{message}</Text>}
      {plotId && <BatchForm plotId={plotId} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 20 },
  label: { marginTop: 16, marginBottom: 6, fontWeight: "600" },
  coords: { marginTop: 12, color: "#444" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: "#2e7d32", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 24 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondary: { borderWidth: 1, borderColor: "#2e7d32", padding: 14, borderRadius: 8, alignItems: "center" },
  secondaryText: { color: "#2e7d32", fontSize: 16, fontWeight: "600" },
  error: { color: "#c62828", marginTop: 16 },
  ok: { color: "#2e7d32", marginTop: 16 },
});