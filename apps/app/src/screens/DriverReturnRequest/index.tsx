import React, { useCallback, useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Text } from "@/theme";
import Svg, { Path, Circle } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { http } from "../../api/client";
import { ApiEndpoints } from "../../api/endpoints";
import { useAsyncData } from "../../hooks/useAsyncData";
import type { QueueItem } from "../../types";
import type { RootStackScreenProps } from "../../navigation";
import MobileStatusBar from "../../components/ui/StatusBar";
import { toast } from "../../utils/toast";

type Props = RootStackScreenProps<"DriverReturnRequest">;

const CarIcon = ({ size = 27 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 11l1.2-4A2 2 0 0 1 6.1 5h11.8a2 2 0 0 1 1.9 2l1.2 4" />
    <Path d="M3 11h18v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Z" />
    <Circle cx="7.5" cy="17.5" r="1.6" />
    <Circle cx="16.5" cy="17.5" r="1.6" />
  </Svg>
);

const PASS_TIMEOUT = 15;

const DriverReturnRequest = ({ navigation }: Props) => {
  const { driver } = useAuth();
  const fetchQueue = useCallback(
    () => http.get<{ queue: QueueItem[] }>(ApiEndpoints.driver.queue),
    [],
  );
  const { data, loading, reload } = useAsyncData<{ queue: QueueItem[] }>(fetchQueue);
  const { data: profileData } = useAsyncData<{ driver: { fullName: string; initials: string; status: string } }>(
    () => http.get(ApiEndpoints.driver.profile),
  );
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;
    const onEvent = () => reload();
    socket.on("valet.order.return.requested", onEvent);
    socket.on("valet.order.completed", onEvent);
    socket.on("valet.order.created", onEvent);
    return () => {
      socket.off("valet.order.return.requested", onEvent);
      socket.off("valet.order.completed", onEvent);
      socket.off("valet.order.created", onEvent);
    };
  }, [socket, reload]);

  useEffect(() => {
    if (socket) return;
    const t = setInterval(() => reload(), 15000);
    return () => clearInterval(t);
  }, [socket, reload]);

  const returnRequests = (data?.queue ?? []).filter((i) => i.status === "returning" && !i.isMine);
  const current = returnRequests[0];
  const rotationIndex = current ? (data?.queue ?? []).filter((i) => i.status === "returning").indexOf(current) ?? 0 : 0;
  const totalReturning = (data?.queue ?? []).filter((i) => i.status === "returning").length;
  const profile = profileData?.driver;

  const [passTimer, setPassTimer] = useState(PASS_TIMEOUT);

  useEffect(() => {
    if (!current) return;
    setPassTimer(PASS_TIMEOUT);
    const interval = setInterval(() => {
      setPassTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [current?.id, navigation]);

  useEffect(() => {
    if (passTimer === 0 && current) {
      navigation.goBack();
    }
  }, [passTimer, current, navigation]);

  const handleAccept = async () => {
    if (!current) return;
    try {
      await http.patch<{ ok: boolean }>(
        ApiEndpoints.driver.orderStatus(current.id),
        { status: "retrieving" },
      );
      reload();
      navigation.navigate("DriverPickupRequests");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to accept";
      toast.error("Error", message);
    }
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatEta = (eta: string) => {
    const diff = new Date(eta).getTime() - Date.now();
    const mins = Math.max(0, Math.ceil(diff / 60000));
    return mins <= 0 ? "Now" : `${mins} min`;
  };

  const initials = profile?.initials ?? driver?.initials ?? "??";
  const fullName = profile?.fullName ?? driver?.fullName ?? "Driver";
  const isOnShift = profile?.status === "on_shift" || driver?.status === "on_shift";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.flex}>
        <MobileStatusBar />

        <View style={styles.backgroundContent}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View>
              <Text style={styles.driverName}>{fullName}</Text>
              <Text style={styles.driverStatus}>{isOnShift ? "\u25CF On shift" : "Off duty"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.overlay} />

        <View style={styles.bottomSheet}>
          {loading ? (
            <ActivityIndicator size="large" color="#F4531F" style={{ paddingVertical: 40 }} />
          ) : !current ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No return requests</Text>
              <Text style={styles.emptySubtitle}>New requests will appear here</Text>
              <TouchableOpacity style={styles.closeButton} activeOpacity={0.8} onPress={() => navigation.goBack()}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.sheetHeader}>
                <View style={styles.requestBadge}>
                  <Text style={styles.requestBadgeText}>{"\u25CF"} New return request</Text>
                </View>
                <Text style={styles.rotationText}>Your turn {"\u00B7"} rotation {rotationIndex + 1} of {totalReturning}</Text>
              </View>

              <View style={styles.carSection}>
                <View style={styles.carIconTile}>
                  <CarIcon size={27} />
                </View>
                <View>
                  <Text style={styles.carPlate}>{current.plate}</Text>
                  <Text style={styles.carDesc}>{current.car}</Text>
                </View>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>PARKED AT</Text>
                  <Text style={styles.infoValue}>Zone {current.zone ?? "?"} {"\u00B7"} {current.slot ?? "?"}</Text>
                </View>
                {current.guestEta && (
                  <View style={styles.infoCardAmber}>
                    <Text style={styles.infoLabelAmber}>GUEST ARRIVES IN</Text>
                    <Text style={styles.infoValueAmber}>
                      {formatEta(current.guestEta)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.passButton}
                  activeOpacity={0.7}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={styles.passButtonText}>Pass {"\u00B7"} {formatCountdown(passTimer)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.acceptButton}
                  activeOpacity={0.8}
                  onPress={handleAccept}
                >
                  <Text style={styles.acceptButtonText}>Accept {"\u2014"} get the car</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F9" },
  flex: { flex: 1 },
  backgroundContent: { paddingHorizontal: 22, paddingTop: 20 },
  headerLeft: { flexDirection: "row", gap: 11, alignItems: "center" },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#1C2B46", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  driverName: { fontSize: 15, fontWeight: "800", color: "#1C2B46" },
  driverStatus: { fontSize: 11.5, fontWeight: "700", color: "#0C9D61", marginTop: 1 },
  overlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(16,22,35,0.55)" },
  bottomSheet: { position: "absolute", left: 16, right: 16, bottom: 16, backgroundColor: "#FFFFFF", borderRadius: 30, padding: 26, paddingLeft: 24, paddingRight: 24, shadowColor: "#101623", shadowOpacity: 0.4, shadowOffset: { width: 0, height: -20 }, shadowRadius: 60, elevation: 12 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  requestBadge: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, backgroundColor: "#FEEFE8" },
  requestBadgeText: { fontSize: 11.5, fontWeight: "800", color: "#D6430F" },
  rotationText: { fontSize: 12, fontWeight: "700", color: "#6C7A93" },
  carSection: { flexDirection: "row", gap: 15, alignItems: "center", marginTop: 18 },
  carIconTile: { width: 58, height: 58, borderRadius: 17, backgroundColor: "#1C2B46", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  carPlate: { fontSize: 19, fontWeight: "800", letterSpacing: 0.3, color: "#1C2B46" },
  carDesc: { fontSize: 13, fontWeight: "600", color: "#6C7A93", marginTop: 2 },
  infoGrid: { flexDirection: "row", gap: 10, marginTop: 16 },
  infoCard: { flex: 1, backgroundColor: "#F6F7F9", borderRadius: 14, padding: 12, paddingLeft: 14 },
  infoLabel: { fontSize: 10.5, fontWeight: "800", letterSpacing: 1.2, color: "#6C7A93", textTransform: "uppercase" },
  infoValue: { fontSize: 15, fontWeight: "800", marginTop: 2, color: "#1C2B46" },
  infoCardAmber: { flex: 1, backgroundColor: "#FDF3E3", borderRadius: 14, padding: 12, paddingLeft: 14 },
  infoLabelAmber: { fontSize: 10.5, fontWeight: "800", letterSpacing: 1.2, color: "#B97B17", textTransform: "uppercase" },
  infoValueAmber: { fontSize: 15, fontWeight: "800", marginTop: 2, color: "#B97B17" },
  actionButtons: { flexDirection: "row", gap: 10, marginTop: 18 },
  passButton: { flex: 1, padding: 15, borderRadius: 99, backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#E7EAF0", alignItems: "center" },
  passButtonText: { color: "#6C7A93", fontSize: 14.5, fontWeight: "700" },
  acceptButton: { flex: 2, padding: 15, borderRadius: 99, backgroundColor: "#F4531F", alignItems: "center", shadowColor: "#F4531F", shadowOpacity: 0.32, shadowOffset: { width: 0, height: 10 }, shadowRadius: 22, elevation: 6 },
  acceptButtonText: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "800" },
  emptyContainer: { alignItems: "center", paddingVertical: 30 },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: "#1C2B46" },
  emptySubtitle: { fontSize: 13, fontWeight: "500", color: "#6C7A93", marginTop: 4 },
  closeButton: { marginTop: 20, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 99, backgroundColor: "#F4531F" },
  closeButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});

export default DriverReturnRequest;
