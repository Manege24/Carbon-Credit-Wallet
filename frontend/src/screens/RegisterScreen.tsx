import { useState } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { registerFarmer } from "../api/auth";
import { getDeviceId } from "../storage/deviceId";
import { colors, spacing, radius, shadow } from "../theme";

type Props = { onDone: () => void; onBack: () => void };

export default function RegisterScreen({ onDone, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [county, setCounty] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!name.trim() || !phone.trim() || !county.trim()) {
      setError("Please fill in all the fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const device_id = await getDeviceId();
      await registerFarmer({
        full_name: name.trim(),
        phone_number: phone.trim(),
        county: county.trim(),
        device_id,
        password,
      });
      onDone();
    } catch (e: any) {
      setError(
        e?.message === "Network request failed"
          ? "Cannot reach the server. Check your connection."
          : e?.message ?? "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <Pressable onPress={onBack} style={styles.back} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.primaryDark} />
          <Text style={styles.backText}>Back to login</Text>
        </Pressable>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Register as a farmer to start earning carbon credits.</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Jane Wanjiku"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="0712345678"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>County</Text>
          <TextInput
            style={styles.input}
            value={county}
            onChangeText={setCounty}
            placeholder="Nairobi"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.rowInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!show}
              autoCapitalize="none"
              placeholder="At least 6 characters"
              placeholderTextColor={colors.muted}
            />
            <Pressable onPress={() => setShow((v) => !v)} hitSlop={10}>
              <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={22} color={colors.muted} />
            </Pressable>
          </View>

          <Text style={styles.label}>Confirm password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.rowInput}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!show}
              autoCapitalize="none"
              placeholder="Repeat password"
              placeholderTextColor={colors.muted}
            />
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable style={[styles.button, loading && { opacity: 0.5 }]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Create account</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  backText: { color: colors.primaryDark, fontWeight: "600" },
  title: { fontSize: 26, fontWeight: "700", color: colors.primaryDark },
  subtitle: { color: colors.muted, marginTop: spacing.xs },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, ...shadow },
  label: { color: colors.text, fontWeight: "600", marginTop: spacing.md, marginBottom: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: 14, fontSize: 16, backgroundColor: colors.white, color: colors.text,
  },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, backgroundColor: colors.white,
  },
  rowInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: colors.text },
  errorBox: {
    flexDirection: "row", gap: 8, alignItems: "center", marginTop: spacing.md,
    backgroundColor: "#F8E5DF", padding: 12, borderRadius: radius.sm,
  },
  errorText: { color: colors.error, flex: 1 },
  button: {
    backgroundColor: colors.primary, paddingVertical: 15, borderRadius: radius.md,
    alignItems: "center", marginTop: spacing.lg,
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "700" },
});