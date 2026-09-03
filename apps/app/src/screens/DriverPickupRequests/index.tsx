import React, { useCallback, useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Text } from "@/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { http } from "../../api/client";
import { ApiEndpoints } from "../../api/endpoints";
import { useAsyncData } from "../../hooks/useAsyncData";
import { TabBar } from "../../components";
import type { QueueItem } from "../../types";
import type { RootStackScreenProps } from "../../navigation";
import MobileStatusBar from "../../components/ui/StatusBar";
import { toast } from "../../utils/toast";

type Props = RootStackScreenProps<"DriverPickupRequests">;
type FilterTab = "active" | "to_park" | "done";

const DriverPickupRequests = ({ navigation }: Props) => {
  const { driver } = useAuth();
  const [activeTab, setActiveTab] = useState<FilterTab>("active");
  const fetchQueue = useCallback(
    () => http.get<{ queue: QueueItem[] }>(ApiEndpoints.driver.queue),
    [],
  );
  const { data, loading, error, reload } = useAsyncData<{ queue: QueueItem[] }>(fetchQueue);
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

  const allItems = data?.queue ?? [];

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const activeItems = allItems.filter((i) => i.status === "returning" || i.status === "retrieving");
  const toParkItems = allItems.filter((i) => i.status === "active");
  const doneItems = allItems.filter((i) => i.status === "returned" || i.status === "parked");

  const displayedItems = activeTab === "active" ? activeItems : activeTab === "to_park" ? toParkItems : doneItems;

  const handleAcceptReturn = async (item: QueueItem) => {
    try {
      await http.patch<{ ok: boolean }>(
        ApiEndpoints.driver.orderStatus(item.id),
        { status: "retrieving" },
      );
      reload();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed";
      toast.error("Error", message);
    }
  };

  const handleMarkReturned = async (item: QueueItem) => {
    try {
      await http.patch<{ ok: boolean }>(
        ApiEndpoints.driver.orderStatus(item.id),
        { status: "returned" },
      );
      reload();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed";
      toast.error("Error", message);
    }
  };

  const formatOverdueTime = (eta: string | null): string => {
    if (!eta) return "-00:00";
    const diff = new Date(eta).getTime() - now;
    const absDiff = Math.abs(diff);
    const totalSec = Math.floor(absDiff / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `-${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const formatEta = (eta: string | null) => {
    if (!eta) return null;
    const diff = new Date(eta).getTime() - now;
    if (diff <= 0) return null;
    const totalSec = Math.floor(diff / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const getEtaMinutes = (eta: string | null): number | null => {
    if (!eta) return null;
    const diff = new Date(eta).getTime() - now;
    return Math.floor(diff / 60000);
  };

  const getProgressWidth = (item: QueueItem): number => {
    if (item.status === "returned" || item.status === "parked") return 100;
    const mins = getEtaMinutes(item.guestEta);
    if (mins === null) return 30;
    if (mins <= 0) return 100;
    if (mins <= 3) return 95;
    if (mins <= 5) return 80;
    if (mins <= 10) return 62;
    if (mins <= 15) return 45;
    return 30;
  };

  const getBadgeConfig = (item: QueueItem) => {
    if (item.isMine && (item.status === "retrieving" || item.status === "returning")) {
      return { text: `MINE \u00B7 RETRIEVING`, bg: "#FEEFE8", color: "#D6430F" };
    }
    if (item.status === "returning") {
      const assignedTo = item.driverName ?? "Queue";
      return { text: `QUEUED \u00B7 ${assignedTo.toUpperCase()}`, bg: "#FDF3E3", color: "#B97B17" };
    }
    if (item.status === "retrieving") {
      return { text: `RETRIEVING`, bg: "#FEEFE8", color: "#D6430F" };
    }
    if (item.status === "active") {
      return { text: `TO PARK`, bg: "#FEEFE8", color: "#D6430F" };
    }
    if (item.status === "returned") {
      return { text: `RETURNED`, bg: "#E7F7EF", color: "#0C9D61" };
    }
    if (item.status === "parked") {
      return { text: `PARKED`, bg: "#E7F7EF", color: "#0C9D61" };
    }
    return { text: (item.status as string).toUpperCase(), bg: "#E7F7EF", color: "#0C9D61" };
  };

  const isOverdue = (item: QueueItem): boolean => {
    if (item.status !== "returning" && item.status !== "retrieving") return false;
    const mins = getEtaMinutes(item.guestEta);
    return mins !== null && mins <= 0;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.flex}>
        <MobileStatusBar />

        <View style={styles.header}>
          <Text style={styles.title}>Requests</Text>
        </View>

        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={activeTab === "active" ? styles.activeTab : styles.inactiveTab}
            activeOpacity={0.7}
            onPress={() => setActiveTab("active")}
          >
            <Text style={activeTab === "active" ? styles.activeTabText : styles.inactiveTabText}>
              Active {"\u00B7"} {activeItems.length}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={activeTab === "to_park" ? styles.activeTab : styles.inactiveTab}
            activeOpacity={0.7}
            onPress={() => setActiveTab("to_park")}
          >
            <Text style={activeTab === "to_park" ? styles.activeTabText : styles.inactiveTabText}>
              To park {"\u00B7"} {toParkItems.length}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={activeTab === "done" ? styles.activeTab : styles.inactiveTab}
            activeOpacity={0.7}
            onPress={() => setActiveTab("done")}
          >
            <Text style={activeTab === "done" ? styles.activeTabText : styles.inactiveTabText}>
              Done {"\u00B7"} {doneItems.length}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
          {loading ? (
            <ActivityIndicator size="small" color="#F4531F" style={{ marginTop: 24 }} />
          ) : error ? (
            <TouchableOpacity onPress={reload} activeOpacity={0.7}>
              <Text style={[styles.emptyText, { color: "#F4531F" }]}>Failed to load {"\u2014"} tap to retry</Text>
            </TouchableOpacity>
          ) : displayedItems.length === 0 ? (
            <Text style={styles.emptyText}>No items</Text>
          ) : (
            displayedItems.map((item) => {
              const mine = item.isMine;
              const overdue = isOverdue(item);
              const eta = formatEta(item.guestEta);
              const badge = getBadgeConfig(item);
              const progressWidth = getProgressWidth(item);
              const mins = getEtaMinutes(item.guestEta);
              const isReturned = item.status === "returned" || item.status === "parked";

              return (
                <View
                  key={item.id}
                  style={[
                    styles.card,
                    mine && !isReturned && styles.cardMine,
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate("DriverRetrievalDetail", { orderId: item.id })}
                  >
                  <View style={styles.cardHeader}>
                    <Text style={styles.plateText}>{item.plate}</Text>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
                    </View>
                  </View>
                  <Text style={styles.carDesc}>
                    {item.car} {"\u00B7"} Zone {item.zone ?? "?"} {"\u00B7"} {item.slot ?? "?"}
                  </Text>
                  <View style={styles.etaRow}>
                    <Text style={styles.etaLabel}>
                      {overdue ? "Guest waiting at curb" : "Guest ETA"}
                    </Text>
                    <Text style={[styles.etaValue, { color: overdue ? "#E23D3D" : mins !== null && mins <= 5 ? "#B97B17" : "#0C9D61" }]}>
                      {overdue
                        ? formatOverdueTime(item.guestEta)
                        : eta ?? ""}
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${progressWidth}%`,
                          backgroundColor: overdue
                            ? "#E23D3D"
                            : mine
                              ? "#E9A23B"
                              : "#0C9D61",
                        },
                      ]}
                    />
                  </View>
                  </TouchableOpacity>
                  {activeTab === "active" && !mine && (item.status === "returning") && (
                    <TouchableOpacity
                      style={styles.acceptButton}
                      activeOpacity={0.8}
                      onPress={() => handleAcceptReturn(item)}
                    >
                      <Text style={styles.acceptButtonText}>Accept retrieval</Text>
                    </TouchableOpacity>
                  )}
                  {activeTab === "active" && mine && item.status === "retrieving" && (
                    <TouchableOpacity
                      style={styles.completeButton}
                      activeOpacity={0.8}
                      onPress={() => handleMarkReturned(item)}
                    >
                      <Text style={styles.completeButtonText}>Mark as returned</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        <TabBar activeScreen="Requests" navigation={navigation} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F9" },
  flex: { flex: 1 },
  header: { paddingHorizontal: 22, paddingTop: 12 },
  title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3, color: "#1C2B46" },
  filterTabs: { flexDirection: "row", gap: 8, marginTop: 14, paddingHorizontal: 22 },
  activeTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, backgroundColor: "#1C2B46" },
  activeTabText: { fontSize: 12.5, fontWeight: "800", color: "#FFFFFF" },
  inactiveTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#E7EAF0" },
  inactiveTabText: { fontSize: 12.5, fontWeight: "700", color: "#6C7A93" },
  scrollContent: { paddingHorizontal: 22, paddingTop: 16, gap: 11, paddingBottom: 16 },
  emptyText: { fontSize: 13, fontWeight: "600", color: "#6C7A93", textAlign: "center", marginTop: 24 },
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7EAF0", borderRadius: 18, padding: 15, paddingLeft: 16, paddingRight: 16 },
  cardMine: { borderWidth: 1.5, borderColor: "#F4531F", shadowColor: "#F4531F", shadowOpacity: 0.1, shadowOffset: { width: 0, height: 8 }, shadowRadius: 20, elevation: 4 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  plateText: { fontSize: 15.5, fontWeight: "800", color: "#1C2B46" },
  badge: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 99 },
  badgeText: { fontSize: 10.5, fontWeight: "800" },
  carDesc: { fontSize: 12, fontWeight: "600", color: "#6C7A93", marginTop: 2 },
  etaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  etaLabel: { fontSize: 12, fontWeight: "600", color: "#6C7A93" },
  etaValue: { fontSize: 16, fontWeight: "800" },
  progressTrack: { height: 7, borderRadius: 99, backgroundColor: "#F1F3F6", marginTop: 7, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 99 },
  acceptButton: { marginTop: 12, padding: 12, borderRadius: 99, backgroundColor: "#F4531F", alignItems: "center" },
  acceptButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  completeButton: { marginTop: 12, padding: 12, borderRadius: 99, backgroundColor: "#0C9D61", alignItems: "center" },
  completeButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
});

export default DriverPickupRequests;
