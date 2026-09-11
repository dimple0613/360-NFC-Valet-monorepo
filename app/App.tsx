import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import Toast from "react-native-toast-message";
import toastConfig from "./src/components/ui/CustomToast";
import { AuthProvider } from "./src/context/AuthContext";
import { SocketProvider } from "./src/context/SocketContext";
import { ErrorBoundary } from "./src/components/ui/ErrorBoundary";
import { RootNavigator } from "./src/navigation";

const App = () => {
  const [fontsLoaded] = useFonts({
    "PlusJakartaSans-Regular": require("./assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Medium": require("./assets/fonts/PlusJakartaSans-Medium.ttf"),
    "PlusJakartaSans-SemiBold": require("./assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    "PlusJakartaSans-Bold": require("./assets/fonts/PlusJakartaSans-Bold.ttf"),
    "PlusJakartaSans-ExtraBold": require("./assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F6F7F9" }}>
        <ActivityIndicator size="large" color="#F4531F" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SocketProvider>
          <ErrorBoundary>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </ErrorBoundary>
        </SocketProvider>
        <Toast config={toastConfig} />
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default App;
