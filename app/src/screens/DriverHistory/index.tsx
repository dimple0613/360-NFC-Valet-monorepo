import React, { useCallback, useState } from "react";
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Text } from "@/theme";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { http } from "../../api/client";
import { ApiEndpoints } from "../../api/endpoints";
import { useAsyncData } from "../../hooks/useAsyncData";
import { TabBar } from "../../components";
import type { HistoryItem } from "../../types";
import type { RootStackScreenProps } from "../../navigation";
import MobileStatusBar from "../../components/ui/StatusBar";

type Props = RootStackScreenProps<"DriverHistory">;
type HistoryFilter = "today" | "week" | "month";

const CheckIcon = () => (
  <Svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0C9D61" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 12.5 9.5 18 20 6.5" />
  </Svg>
);

const formatDuration = (seconds: number | null) => {
  if (!seconds) return "\u2014";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m} m ${String(s).padStart(2, "0")} s`;
};

const formatAvg = (min: number | undefined) => {
  const m = min ?? 0;
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
};

const getTimePeriod = (dateStr: string): string => {
  const hour = new Date(dateStr).getHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
};

const DriverHistory = ({ navigation }: Props) => {
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>("today");
  const fetchHistory = useCallback(
    () => http.get<{ stats: { total: number; avgReturnMin: number }; history: HistoryItem[] }>(
      `${ApiEndpoints.driver.history}?period=${activeFilter === "today" ? "day" : activeFilter === "week" ? "week" : "month"}`,
    ),
    [activeFilter],
  );
  const { data, loading, error, reload } = useAsyncData<{ stats: { total: number; avgReturnMin: number }; history: HistoryItem[] }>(fetchHistory, [fetchHistory]);

  const stats = data?.stats;
  const history = data?.history ?? [];

  const groupedHistory = history.reduce<Record<string, HistoryItem[]>>((acc, item) => {
    const period = item.returnedAt ? getTimePeriod(item.returnedAt) : "Other";
    if (!acc[period]) acc[period] = [];
    acc[period].push(item);
    return acc;
  }, {});

  const periodOrder = ["Morning", "Afternoon", "Evening", "Other"];
  const sortedPeriods = periodOrder.filter((p) => groupedHistory[p]?.length);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.flex}>
        <MobileStatusBar />

        <View style={styles.header}>
          <Text style={styles.title}>My history</Text>
        </View>

        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={activeFilter === "today" ? styles.activeTab : styles.inactiveTab}
            activeOpacity={0.7}
            onPress={() => setActiveFilter("today")}
          >
            <Text style={activeFilter === "today" ? styles.activeTabText : styles.inactiveTabText}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={activeFilter === "week" ? styles.activeTab : styles.inactiveTab}
            activeOpacity={0.7}
            onPress={() => setActiveFilter("week")}
          >
            <Text style={activeFilter === "week" ? styles.activeTabText : styles.inactiveTabText}>This week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={activeFilter === "month" ? styles.activeTab : styles.inactiveTab}
            activeOpacity={0.7}
            onPress={() => setActiveFilter("month")}
          >
            <Text style={activeFilter === "month" ? styles.activeTabText : styles.inactiveTabText}>Month</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{loading ? "\u2014" : stats?.total ?? 0}</Text>
            <Text style={styles.statLabel}>Orders completed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: "#0C9D61" }]}>{loading ? "\u2014" : formatAvg(stats?.avgReturnMin)}</Text>
            <Text style={styles.statLabel}>Avg retrieval time</Text>
          </View>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
          {loading ? (
            <ActivityIndicator size="small" color="#F4531F" style={{ marginTop: 24 }} />
          ) : error ? (
            <TouchableOpacity onPress={reload} activeOpacity={0.7}>
              <Text style={[styles.emptyText, { color: "#F4531F" }]}>Failed to load \u2014 tap to retry</Text>
            </TouchableOpacity>
          ) : history.length === 0 ? (
            <Text style={styles.emptyText}>No history yet</Text>
          ) : (
            sortedPeriods.flatMap((period) => [
              <Text key={`label-${period}`} style={styles.sectionLabel}>{period}</Text>,
              ...groupedHistory[period].map((item) => (
                <View key={item.id} style={styles.historyItem}>
                  <View style={[styles.iconTile, { backgroundColor: "#E7F7EF" }]}>
                    <CheckIcon />
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemPlate}>{item.plate} {"\u00B7"} {item.car}</Text>
                    <Text style={styles.itemDetail}>
                      Returned {"\u00B7"} {item.cardUid ? `card ${item.cardUid}` : ""}{" "}
                      {item.durationSeconds ? formatDuration(item.durationSeconds) : ""}
                    </Text>
                  </View>
                  <Text style={styles.itemTime}>
                    {item.returnedAt
                      ? new Date(item.returnedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                      : item.droppedAt
                        ? new Date(item.droppedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                        : "\u2014"}
                  </Text>
                </View>
              )),
            ])
          )}
        </ScrollView>

        <TabBar activeScreen="History" navigation={navigation} />
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
  statsGrid: { flexDirection: "row", gap: 10, marginTop: 14, paddingHorizontal: 22 },
  statCard: { flex: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7EAF0", borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16 },
  statValue: { fontSize: 24, fontWeight: "800", color: "#1C2B46" },
  statLabel: { fontSize: 11, fontWeight: "600", color: "#6C7A93", marginTop: 2 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 30, gap: 9 },
  sectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: "#6C7A93", textTransform: "uppercase", marginTop: 4, marginBottom: -2 },
  emptyText: { fontSize: 13, fontWeight: "600", color: "#6C7A93", textAlign: "center", marginTop: 24 },
  historyItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7EAF0", borderRadius: 15, padding: 12, paddingLeft: 15, gap: 12 },
  iconTile: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  itemInfo: { flex: 1 },
  itemPlate: { fontSize: 13.5, fontWeight: "800", color: "#1C2B46" },
  itemDetail: { fontSize: 11, fontWeight: "500", color: "#6C7A93", marginTop: 1 },
  itemTime: { fontSize: 11.5, fontWeight: "700", color: "#6C7A93" },
});

export default DriverHistory;
