import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { Text } from "@/theme";
import Svg, { Path, Circle } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { http } from "../../api/client";
import { ApiEndpoints } from "../../api/endpoints";
import { useAsyncData } from "../../hooks/useAsyncData";
import { TabBar } from "../../components";
import { storage, StorageKeys } from "../../services/storage";
import type { DriverProfile as DriverProfileType } from "../../types";
import type { RootStackScreenProps } from "../../navigation";
import MobileStatusBar from "../../components/ui/StatusBar";

type Props = RootStackScreenProps<"DriverProfile">;

const BuildingIcon = () => (
  <Svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#1C2B46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 21h18" />
    <Path d="M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
    <Path d="M15 9h4v12" />
  </Svg>
);

const BellIcon = () => (
  <Svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#1C2B46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <Path d="M10.3 21a2 2 0 0 0 3.4 0" />
  </Svg>
);

const SettingsIcon = () => (
  <Svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#1C2B46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="3.2" />
    <Path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.51 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" />
  </Svg>
);

const ChevronRight = () => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9AA6BC" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 5l7 7-7 7" />
  </Svg>
);

const DriverProfile = ({ navigation }: Props) => {
  const { driver, signOut, refreshDriver } = useAuth();
  const [notificationsOn, setNotificationsOn] = useState(true);

  useEffect(() => {
    storage.get<boolean>(StorageKeys.notificationsOn).then((val) => {
      if (val !== null) setNotificationsOn(val);
    });
  }, []);

  const toggleNotifications = () => {
    const next = !notificationsOn;
    setNotificationsOn(next);
    storage.set(StorageKeys.notificationsOn, next);
  };

  const fetchProfile = () => http.get<{ driver: DriverProfileType }>(ApiEndpoints.driver.profile);
  const { data, loading } = useAsyncData<{ driver: DriverProfileType }>(fetchProfile);

  const profile = data?.driver;
  const fullName = profile?.fullName ?? driver?.fullName ?? "Driver";
  const valetId = profile?.valetId ?? driver?.valetId ?? "";
  const propertyName = profile?.propertyName ?? driver?.propertyName ?? "";
  const initials = profile?.initials ?? driver?.initials ?? "??";
  const avatarColor = profile?.avatarColor ?? driver?.avatarColor;
  const todayOrders = profile?.todayOrders ?? 0;
  const avgMin = profile?.avgReturnMin ?? 0;
  const isOnShift = profile?.status === "on_shift" || driver?.status === "on_shift";
  const shiftStarted = profile?.shiftStartedAt ?? driver?.shiftStartedAt;

  const formatShiftDuration = () => {
    if (!shiftStarted) return "";
    const diff = Date.now() - new Date(shiftStarted).getTime();
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const startedTime = new Date(shiftStarted).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return `\u25CF On shift since ${startedTime} \u00B7 ${hours} h ${mins} m`;
  };

  const handleSignOut = async () => {
    try {
      await http.patch(ApiEndpoints.driver.shift, { onShift: false }).catch(() => {});
    } finally {
      await signOut();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.flex}>
        <MobileStatusBar />

        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
          <View style={styles.profileHeader}>
            <View style={[styles.avatar, avatarColor ? { backgroundColor: avatarColor } : undefined]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.name}>{fullName}</Text>
            <Text style={styles.subtitle}>{valetId} · {propertyName}</Text>
            {isOnShift && shiftStarted && (
              <View style={styles.shiftBadge}>
                <Text style={styles.shiftBadgeText}>{formatShiftDuration()}</Text>
              </View>
            )}
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              {loading ? <ActivityIndicator size="small" color="#F4531F" /> : <Text style={styles.statValue}>{todayOrders}</Text>}
              <Text style={styles.statLabel}>Orders</Text>
            </View>
            <View style={styles.statCard}>
              {loading ? <ActivityIndicator size="small" color="#F4531F" /> : <Text style={[styles.statValue, { color: "#0C9D61" }]}>{avgMin}:00</Text>}
              <Text style={styles.statLabel}>Avg return</Text>
            </View>
            <View style={styles.statCard}>
              {loading ? <ActivityIndicator size="small" color="#F4531F" /> : <Text style={[styles.statValue, { color: "#6C7A93" }]}>—</Text>}
              <Text style={styles.statLabel}>Incidents</Text>
            </View>
          </View>

          <View style={styles.settingsMenu}>
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => {
                refreshDriver();
                navigation.navigate("DriverSelectLocation");
              }}
            >
              <View style={styles.menuItemLeft}>
                <BuildingIcon />
                <Text style={styles.menuItemText}>Switch location</Text>
              </View>
              <ChevronRight />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={toggleNotifications}
            >
              <View style={styles.menuItemLeft}>
                <BellIcon />
                <Text style={styles.menuItemText}>Notification sounds</Text>
              </View>
              <View style={[styles.toggle, { backgroundColor: notificationsOn ? "#0C9D61" : "#D1D5DB" }]}>
                <View style={[styles.toggleKnob, notificationsOn ? { alignSelf: "flex-end" } : { alignSelf: "flex-start", marginLeft: 3 }]} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} activeOpacity={0.7}>
              <View style={styles.menuItemLeft}>
                <SettingsIcon />
                <Text style={styles.menuItemText}>Language · English</Text>
              </View>
              <ChevronRight />
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={styles.bottomSection}>
          <TouchableOpacity activeOpacity={0.8} onPress={handleSignOut}>
            <View style={styles.endShiftButton}>
              <Text style={styles.endShiftButtonText}>End shift & sign out</Text>
            </View>
          </TouchableOpacity>
        </View>

        <TabBar activeScreen="Profile" navigation={navigation} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F9" },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 14 },
  profileHeader: { alignItems: "center", paddingVertical: 12, paddingBottom: 4 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: "#1C2B46", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontSize: 26, fontWeight: "800" },
  name: { fontSize: 20, fontWeight: "800", marginTop: 12, color: "#1C2B46" },
  subtitle: { fontSize: 12.5, fontWeight: "600", color: "#6C7A93", marginTop: 2 },
  shiftBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, backgroundColor: "#E7F7EF", marginTop: 10 },
  shiftBadgeText: { fontSize: 11.5, fontWeight: "800", color: "#0C9D61" },
  statsGrid: { flexDirection: "row", gap: 10, marginTop: 20 },
  statCard: { flex: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7EAF0", borderRadius: 16, paddingVertical: 13, paddingHorizontal: 14, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "800", color: "#1C2B46" },
  statLabel: { fontSize: 10.5, fontWeight: "600", color: "#6C7A93", marginTop: 2 },
  settingsMenu: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7EAF0", borderRadius: 18, marginTop: 16, overflow: "hidden" },
  menuItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 15, paddingLeft: 18, paddingRight: 18, borderBottomWidth: 1, borderBottomColor: "#F1F3F6" },
  menuItemLeft: { flexDirection: "row", gap: 12, alignItems: "center" },
  menuItemText: { fontSize: 14, fontWeight: "700", color: "#1C2B46" },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: "#0C9D61", alignItems: "flex-end", justifyContent: "center", paddingRight: 3 },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#FFFFFF" },
  bottomSection: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 10 },
  endShiftButton: { backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#F3C9C9", borderRadius: 99, padding: 16, alignItems: "center" },
  endShiftButtonText: { color: "#E23D3D", fontSize: 15.5, fontWeight: "800" },
});

export default DriverProfile;
