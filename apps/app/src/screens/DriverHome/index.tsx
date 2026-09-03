import React, { useCallback, useEffect } from "react";
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Text } from "@/theme";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { http } from "../../api/client";
import { ApiEndpoints } from "../../api/endpoints";
import { useAsyncData } from "../../hooks/useAsyncData";
import { TabBar } from "../../components";
import type { DashboardStats, QueueItem } from "../../types";
import type { RootStackScreenProps } from "../../navigation";
import MobileStatusBar from "../../components/ui/StatusBar";

type Props = RootStackScreenProps<"DriverHome">;

const ClockIcon = () => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B97B17" strokeWidth="2" strokeLinecap="round">
    <Circle cx="12" cy="12" r="9" />
    <Path d="M12 7v5l3 2" />
  </Svg>
);

const CarIcon = () => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F4531F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 11l1.2-4A2 2 0 0 1 6.1 5h11.8a2 2 0 0 1 1.9 2l1.2 4" />
    <Path d="M3 11h18v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Z" />
    <Circle cx="7.5" cy="17.5" r="1.6" />
    <Circle cx="16.5" cy="17.5" r="1.6" />
  </Svg>
);

const NfcCardIcon = ({ size = 26 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="4" y="2.5" width="16" height="19" rx="3" />
    <Path d="M9.5 9.5a4.2 4.2 0 0 1 5 0" />
    <Path d="M8 7a7 7 0 0 1 8 0" />
    <Circle cx="12" cy="13.5" r="1.4" fill="#fff" stroke="none" />
  </Svg>
);

const BellIcon = () => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C2B46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <Path d="M10.3 21a2 2 0 0 0 3.4 0" />
  </Svg>
);

const ChevronRight = ({ color = "#fff", size = 20 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 5l7 7-7 7" />
  </Svg>
);

type DashboardData = { stats: DashboardStats; queue: QueueItem[] };

const formatAvg = (min: number | undefined) => {
  const m = min ?? 0;
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
};

const DriverHome = ({ navigation }: Props) => {
  const { driver } = useAuth();
  const fetchDashboard = useCallback(
    () => http.get<DashboardData>(ApiEndpoints.driver.dashboard),
    [],
  );
  const { data, loading, error, reload } = useAsyncData<DashboardData>(fetchDashboard);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;
    const onEvent = () => reload();
    socket.on("valet.order.created", onEvent);
    socket.on("valet.order.parked", onEvent);
    socket.on("valet.order.completed", onEvent);
    socket.on("valet.order.return.requested", onEvent);
    return () => {
      socket.off("valet.order.created", onEvent);
      socket.off("valet.order.parked", onEvent);
      socket.off("valet.order.completed", onEvent);
      socket.off("valet.order.return.requested", onEvent);
    };
  }, [socket, reload]);

  useEffect(() => {
    if (socket) return;
    const t = setInterval(() => reload(), 15000);
    return () => clearInterval(t);
  }, [socket, reload]);

  const stats = data?.stats;
  const queue = data?.queue ?? [];
  const firstName = driver?.fullName?.split(" ")[0] ?? "Driver";
  const initials = driver?.initials ?? "??";
  const propertyName = driver?.propertyName ?? "";
  const isOnShift = driver?.status === "on_shift";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.flex}>
        <MobileStatusBar />

        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.avatar, driver?.avatarColor ? { backgroundColor: driver.avatarColor } : undefined]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View>
                <Text style={styles.driverName}>{firstName}</Text>
                <Text style={styles.driverStatus}>
                  {isOnShift ? "● On shift" : "Off duty"}{propertyName ? ` · ${propertyName}` : ""}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.bellButton} activeOpacity={0.7} onPress={() => navigation.navigate("DriverReturnRequest")}>
              <BellIcon />
              <View style={styles.bellBadge} />
            </TouchableOpacity>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{loading ? "—" : (stats?.parkedToday ?? 0)}</Text>
              <Text style={styles.statLabel}>Parked today</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: "#E9A23B" }]}>{loading ? "—" : (stats?.returnsPending ?? 0)}</Text>
              <Text style={styles.statLabel}>Returns pending</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: "#0C9D61" }]}>{loading ? "—" : formatAvg(stats?.avgReturnMin)}</Text>
              <Text style={styles.statLabel}>Avg return</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate("DriverNfcTap")}
            activeOpacity={0.8}
          >
            <LinearGradient
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              colors={["#F4531F", "#FF8A50"]}
              style={styles.nfcCard}
            >
              <View style={styles.nfcIconTile}>
                <NfcCardIcon size={26} />
              </View>
              <View style={styles.nfcTextContainer}>
                <Text style={styles.nfcTitle}>Tap NFC card</Text>
                <Text style={styles.nfcSubtitle}>New arrival — activate a card in seconds</Text>
              </View>
              <ChevronRight />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate("DriverWriteCard")}
            activeOpacity={0.8}
            style={styles.writeCardButton}
          >
            <Text style={styles.writeCardButtonText}>Write / encode a card</Text>
          </TouchableOpacity>

          <View style={styles.queueHeader}>
            <Text style={styles.queueTitle}>Live queue</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate("DriverPickupRequests")}>
              <Text style={styles.viewAll}>View all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.queueList}>
            {loading ? (
              <ActivityIndicator size="small" color="#F4531F" style={{ marginTop: 16 }} />
            ) : error ? (
              <TouchableOpacity onPress={reload} activeOpacity={0.7}>
                <Text style={[styles.emptyQueue, { color: "#F4531F" }]}>Failed to load — tap to retry</Text>
              </TouchableOpacity>
            ) : queue.length === 0 ? (
              <Text style={styles.emptyQueue}>No active orders</Text>
            ) : (
              queue.slice(0, 5).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.queueItem, item.status === "returning" && styles.queueItemReturning]}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate("DriverRetrievalDetail", { orderId: item.id })}
                >
                  <View style={[styles.queueIconTile, { backgroundColor: item.status === "returning" ? "#FDF3E3" : "#FEEFE8" }]}>
                    {item.status === "returning" ? <ClockIcon /> : <CarIcon />}
                  </View>
                  <View style={styles.queueItemInfo}>
                    <Text style={styles.queueItemPlate}>
                      {item.plate} · {item.car}
                    </Text>
                    <Text style={styles.queueItemDetail}>
                      {item.status === "returning"
                        ? `Return request · Zone ${item.zone ?? "?"} · Slot ${item.slot ?? "?"}`
                        : `To park · card ${item.cardUid ?? "?"}`}
                    </Text>
                  </View>
                  {item.guestEta ? (
                    <View style={styles.queueItemTimer}>
                      <Text style={[styles.queueItemTime, { color: "#B97B17" }]}>
                        {new Date(item.guestEta).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                      <Text style={styles.queueItemTimeLabel}>ETA</Text>
                    </View>
                  ) : (
                    <View style={styles.parkBadge}>
                      <Text style={styles.parkBadgeText}>Park</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>

        <TabBar activeScreen="Home" navigation={navigation} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F6F7F9",
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    gap: 11,
    alignItems: "center",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#1C2B46",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  driverName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1C2B46",
  },
  driverStatus: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#0C9D61",
    marginTop: 1,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E7EAF0",
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadge: {
    position: "absolute",
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#F4531F",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7EAF0",
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1C2B46",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6C7A93",
    marginTop: 1,
  },
  nfcCard: {
    marginTop: 18,
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    shadowColor: "#F4531F",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 26,
    elevation: 8,
  },
  nfcIconTile: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  nfcTextContainer: {
    flex: 1,
  },
  nfcTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  nfcSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  writeCardButton: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E7EAF0",
    alignItems: "center",
  },
  writeCardButtonText: {
    color: "#F4531F",
    fontSize: 13,
    fontWeight: "700",
  },
  queueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 20,
  },
  queueTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1C2B46",
  },
  viewAll: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F4531F",
  },
  queueList: {
    gap: 10,
    marginTop: 12,
    paddingBottom: 16,
  },
  emptyQueue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6C7A93",
    textAlign: "center",
    marginTop: 16,
  },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7EAF0",
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 15,
    gap: 12,
  },
  queueItemReturning: {
    borderColor: "#E9A23B",
  },
  queueIconTile: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  queueItemInfo: {
    flex: 1,
  },
  queueItemPlate: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1C2B46",
  },
  queueItemDetail: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "#6C7A93",
    marginTop: 1,
  },
  queueItemTimer: {
    alignItems: "flex-end",
  },
  queueItemTime: {
    fontSize: 15,
    fontWeight: "800",
  },
  queueItemTimeLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6C7A93",
  },
  parkBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: "#FEEFE8",
  },
  parkBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#D6430F",
  },
});

export default DriverHome;
