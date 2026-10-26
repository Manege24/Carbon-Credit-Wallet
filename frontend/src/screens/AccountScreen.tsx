import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { clearToken } from "../storage/tokenStore";
import { fetchProfile, Profile } from "../api/profile";
import { syncAll } from "../api/sync";
import { countPending, getCache, setCache, getLastSync, clearLocalData } from "../storage/localDb";
import { colors, spacing, radius, shadow } from "../theme";

type Props = { onLogout: () => void };

export default function AccountScreen({ onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPending(await countPending());
    setLastSync(await getLastSync());
    try {
      const p = await fetchProfile();
      setProfile(p);
      await setCache("profile", p);
    } catch {
      setProfile(await getCache<Profile>("profile"));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function syncNow() {
    setSyncing(true);
    setMsg(null);
    try {
      await syncAll();
      setMsg("Everything is up to date.");
    } catch {
      setMsg("Could not reach the server. Your data is safe on this phone.");
    } finally {
      setSyncing(false);
      await load();
    }
  }

  async function logout() {
    if ((await countPending()) > 0) {
      try { await syncAll(); } catch {}
    }
    const left = await countPending();
    const finish = async () => {
      await clearToken();
      await clearLocalData();
      onLogout();
    };
    if (left > 0) {
      Alert.alert(
        "Data not uploaded",
        `${left} record(s) have not been uploaded yet and will be lost if you log out. Log out anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Log out", style: "destructive", onPress: finish },
        ]
      );
    } else {
      await finish();
    }
  }

  const last = lastSync ? new Date(lastSync).toLocaleString() : "Never";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <Text style={styles.title}>Account</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={colors.white} />
          </View>
          <Text style={styles.name}>{profile?.full_name ?? "Farmer"}</Text>
          <Text style={styles.muted}>{profile?.phone_number ?? ""}</Text>
          <Text style={styles.muted}>{profile?.county ? `${profile.county} County` : ""}</Text>
        </View>

        <View style={[styles.card, { marginTop: spacing.md, alignItems: "stretch" }]}>
          <Text style={styles.section}>Data sync</Text>
          <Text style={styles.line}>Waiting to upload: {pending}</Text>
          <Text style={styles.line}>Last sync: {last}</Text>
          <Pressable style={[styles.button, syncing && { opacity: 0.6 }]} onPress={syncNow} disabled={syncing}>
            {syncing ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="sync" size={18} color={colors.white} />
                <Text style={styles.buttonText}>Sync now</Text>
              </>
            )}
          </Pressable>
          {msg && <Text style={styles.msg}>{msg}</Text>}
        </View>

        <Pressable style={styles.logout} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>

        <Text style={styles.version}>Carbon Credit Wallet v{Constants.expoConfig?.version ?? "1.0.0"}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "700", color: colors.primaryDark },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center", ...shadow },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  name: { fontSize: 18, fontWeight: "700", color: colors.text },
  muted: { color: colors.muted, marginTop: 2 },
  section: { fontSize: 16, fontWeight: "700", color: colors.primaryDark, marginBottom: spacing.sm },
  line: { color: colors.text, marginTop: 4 },
  button: {
    flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center",
    backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radius.md, marginTop: spacing.md,
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "700" },
  msg: { color: colors.muted, marginTop: spacing.sm },
  logout: {
    flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: colors.error, paddingVertical: 14, borderRadius: radius.md, marginTop: spacing.lg,
  },
  logoutText: { color: colors.error, fontSize: 16, fontWeight: "700" },
  version: { textAlign: "center", color: colors.muted, marginTop: spacing.lg },
});