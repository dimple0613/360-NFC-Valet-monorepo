import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "@/theme";
import Svg, { Path } from "react-native-svg";
import type { ToastConfig } from "react-native-toast-message";

type ToastProps = {
  text1?: string;
  text2?: string;
  props?: { toastType?: string };
};

const CheckIcon = () => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 6 9 17l-5-5" />
  </Svg>
);

const XIcon = () => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 6 6 18" />
    <Path d="m6 6 12 12" />
  </Svg>
);

const InfoIcon = () => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 16v-4" />
    <Path d="M12 8h.01" />
    <Path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
  </Svg>
);

const ICONS: Record<string, React.FC> = {
  success: CheckIcon,
  error: XIcon,
  info: InfoIcon,
};

const BG_COLORS: Record<string, string> = {
  success: "#0C9D61",
  error: "#E23D3D",
  info: "#1C2B46",
};

const ToastView = ({ text1, text2, props }: ToastProps) => {
  const Icon = ICONS[props?.toastType ?? "success"];
  const bg = BG_COLORS[props?.toastType ?? "success"];

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.iconWrap}>
        {Icon && <Icon />}
      </View>
      <View style={styles.textWrap}>
        {text1 ? <Text style={styles.title}>{text1}</Text> : null}
        {text2 ? <Text style={styles.message}>{text2}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 8,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 18,
  },
  message: {
    fontSize: 12.5,
    fontWeight: "500",
    color: "rgba(255,255,255,0.82)",
    marginTop: 2,
    lineHeight: 16,
  },
});

const toastConfig: ToastConfig = {
  success: ToastView,
  error: ToastView,
  info: ToastView,
};

export default toastConfig;
