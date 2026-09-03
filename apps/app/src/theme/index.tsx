import React from "react";
import { Text as RNText, TextInput as RNTextInput, StyleSheet, StyleProp, TextStyle } from "react-native";
import { Typography } from "../constants/typography";

function resolveFont(style?: StyleProp<TextStyle>): { fontFamily: string; stripped: TextStyle } {
  const flat = StyleSheet.flatten(style) ?? {};
  const fontFamily = Typography.font(flat.fontWeight as string | undefined);
  const { fontWeight: _, ...rest } = flat;
  return { fontFamily, stripped: rest };
}

export function Text({ style, ...props }: React.ComponentProps<typeof RNText>) {
  const { fontFamily, stripped } = resolveFont(style);
  return <RNText style={[{ fontFamily }, stripped]} {...props} />;
}

export function TextInput({ style, ...props }: React.ComponentProps<typeof RNTextInput>) {
  const { fontFamily, stripped } = resolveFont(style);
  return <RNTextInput style={[{ fontFamily }, stripped]} {...props} />;
}
