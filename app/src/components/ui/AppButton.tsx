import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { Text } from "@/theme";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Spacing, Typography } from "../../constants";

type AppButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
};

const AppButton = ({
  label,
  onPress,
  disabled = false,
  variant = "primary",
}: AppButtonProps) => {
  const gradientColors: Record<string, readonly [string, string, ...string[]]> = {
    primary: [Colors.primary, Colors.primaryLight],
    secondary: [Colors.text.primary, "#2A3C61"],
    danger: [Colors.error, "#C62828"],
  };

  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.container}
    >
      <LinearGradient
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        colors={
          disabled
            ? [Colors.surfaceBorder, Colors.surfaceBorder]
            : gradientColors[variant]
        }
        style={[styles.gradient, disabled && styles.disabled]}
      >
        <Text style={[styles.label, disabled && styles.labelDisabled]}>
          {label}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  gradient: {
    alignItems: "center",
    borderRadius: 99,
    paddingVertical: 17,
    shadowColor: Colors.primary,
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 6,
  },
  disabled: {
    shadowOpacity: 0,
  },
  label: {
    color: Colors.text.inverse,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.extrabold,
  },
  labelDisabled: {
    color: Colors.text.secondary,
  },
});

export default AppButton;
