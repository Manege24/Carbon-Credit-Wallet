import { useState } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { login } from "../api/auth";
import { saveToken, saveRefreshToken} from "../storage/tokenStore";
import { colors, spacing, radius, shadow } from "../theme";

type Props = { onLoginSuccess: (role?: string) => void; onRegister: () => void; notice?: string | null };

export default function LoginScreen({ onLoginSuccess, onRegister, notice }: Props) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      const result = await login(phone.trim(), password);
      await saveToken(result.access_token);
      if (result.refresh_token) await saveRefreshToken(result.refresh_token);
      onLoginSuccess(result.role);
    } catch (e: any) {
      if (e?.message === "Network request failed") {
        setError("Cannot reach the server. Check your connection.");
      } else {
        setError(e?.message ?? "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || !phone || !password;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <Ionicons name="leaf" size={40} color={colors.white} />
        </View>
        <Text style={styles.title}>Carbon Credit Wallet</Text>
        <Text style={styles.subtitle}>Grow trees. Earn carbon credits.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Phone number</Text>
          <View style={styles.inputRow}>
            <Ionicons name="call-outline" size={20} color={colors.muted} />
            <TextInput
              style={styles.input}
              placeholder="0712345678"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.muted} />
            <TextInput
              style={styles.input}
              placeholder="Your password"
              placeholderTextColor={colors.muted}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={22}
                color={colors.muted}
              />
            </Pressable>
          </View>

          {notice && (
            <View style={[styles.errorBox, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
              <Text style={[styles.errorText, { color: colors.success }]}>{notice}</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            style={[styles.button, disabled && { opacity: 0.5 }]}
            onPress={handleLogin}
            disabled={disabled}
          >
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Log in</Text>}
          </Pressable>
          <Pressable onPress={onRegister} style={{ marginTop: spacing.md, alignItems: "center" }}>
            <Text style={{ color: colors.primary, fontWeight: "600" }}>New farmer? Create an account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  logo: {
    alignSelf: "center", width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    ...shadow,
  },
  title: { fontSize: 26, fontWeight: "700", color: colors.primaryDark, textAlign: "center", marginTop: spacing.md },
  subtitle: { color: colors.muted, textAlign: "center", marginTop: spacing.xs, marginBottom: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, ...shadow },
  label: { color: colors.text, fontWeight: "600", marginBottom: spacing.sm, marginTop: spacing.sm },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, backgroundColor: colors.white,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: colors.text },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.md,
    backgroundColor: "#F8E5DF", padding: 12, borderRadius: radius.sm,
  },
  errorText: { color: colors.error, flex: 1 },
  button: {
    backgroundColor: colors.primary, paddingVertical: 15, borderRadius: radius.md,
    alignItems: "center", marginTop: spacing.lg,
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "700" },
});