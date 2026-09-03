import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Text } from "@/theme";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, keyof RootStackParamList>;

type Props = {
  activeScreen: string;
  navigation: NavigationProp;
};

const HomeIcon = ({ active }: { active: boolean }) => (
  <Svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active ? "#F4531F" : "#9AA6BC"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 10.5 12 3l9 7.5" />
    <Path d="M5 9.5V21h14V9.5" />
  </Svg>
);

const RequestsIcon = ({ active }: { active: boolean }) => (
  <Svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active ? "#F4531F" : "#9AA6BC"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 6h16M4 12h16M4 18h10" />
  </Svg>
);

const NfcCardIcon = ({ size = 24 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="4" y="2.5" width="16" height="19" rx="3" />
    <Path d="M9.5 9.5a4.2 4.2 0 0 1 5 0" />
    <Path d="M8 7a7 7 0 0 1 8 0" />
    <Circle cx="12" cy="13.5" r="1.4" fill="#fff" stroke="none" />
  </Svg>
);

const HistoryIcon = ({ active }: { active: boolean }) => (
  <Svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active ? "#F4531F" : "#9AA6BC"} strokeWidth="2" strokeLinecap="round">
    <Circle cx="12" cy="12" r="9" />
    <Path d="M12 7v5l3 2" />
  </Svg>
);

const ProfileIcon = ({ active }: { active: boolean }) => (
  <Svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active ? "#F4531F" : "#9AA6BC"} strokeWidth="2" strokeLinecap="round">
    <Circle cx="12" cy="8" r="3.6" />
    <Path d="M5 20a7 7 0 0 1 14 0" />
  </Svg>
);

const TabBar = ({ activeScreen, navigation }: Props) => {
  const isHome = activeScreen === "Home";
  const isRequests = activeScreen === "Requests";
  const isHistory = activeScreen === "History";
  const isProfile = activeScreen === "Profile";

  return (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={styles.tabItem}
        activeOpacity={0.7}
        onPress={() => {
          if (!isHome) navigation.navigate("DriverHome");
        }}
      >
        <HomeIcon active={isHome} />
        <Text style={[styles.tabLabel, isHome && styles.tabLabelActive]}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        activeOpacity={0.7}
        onPress={() => {
          if (!isRequests) navigation.navigate("DriverPickupRequests");
        }}
      >
        <RequestsIcon active={isRequests} />
        <Text style={[styles.tabLabel, isRequests && styles.tabLabelActive]}>Requests</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.nfcTabButton}
        activeOpacity={0.8}
        onPress={() => navigation.navigate("DriverNfcTap")}
      >
        <NfcCardIcon size={24} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        activeOpacity={0.7}
        onPress={() => {
          if (!isHistory) navigation.navigate("DriverHistory");
        }}
      >
        <HistoryIcon active={isHistory} />
        <Text style={[styles.tabLabel, isHistory && styles.tabLabelActive]}>History</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        activeOpacity={0.7}
        onPress={() => {
          if (!isProfile) navigation.navigate("DriverProfile");
        }}
      >
        <ProfileIcon active={isProfile} />
        <Text style={[styles.tabLabel, isProfile && styles.tabLabelActive]}>Profile</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E7EAF0",
    paddingHorizontal: 30,
    paddingTop: 12,
    paddingBottom: 26,
  },
  tabItem: {
    alignItems: "center",
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9AA6BC",
  },
  tabLabelActive: {
    fontWeight: "800",
    color: "#F4531F",
  },
  nfcTabButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#F4531F",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -30,
    borderWidth: 4,
    borderColor: "#F6F7F9",
    shadowColor: "#F4531F",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 8,
  },
});

export default TabBar;
