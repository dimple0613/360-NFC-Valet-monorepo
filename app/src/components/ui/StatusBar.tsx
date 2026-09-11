import React from "react";
import { StatusBar } from "expo-status-bar";

type StatusBarProps = {
  light?: boolean;
};

const MobileStatusBar = ({ light = false }: StatusBarProps) => {
  return <StatusBar style={light ? "light" : "dark"} />;
};

export default MobileStatusBar;
