import React, { Component } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Text } from "@/theme";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error?.message ?? "Unexpected error"}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, backgroundColor: "#F6F7F9" },
  title: { fontSize: 18, fontWeight: "800", color: "#1C2B46", marginBottom: 8 },
  message: { fontSize: 13, color: "#6C7A93", textAlign: "center", marginBottom: 24 },
  button: { backgroundColor: "#F4531F", borderRadius: 99, paddingVertical: 14, paddingHorizontal: 32 },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
