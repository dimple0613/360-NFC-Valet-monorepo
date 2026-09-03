import React from "react";
import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import DriverLogin from "../screens/DriverLogin";
import DriverForgotPassword from "../screens/DriverForgotPassword";
import DriverResetPassword from "../screens/DriverResetPassword";
import DriverSelectLocation from "../screens/DriverSelectLocation";
import DriverHome from "../screens/DriverHome";
import DriverNfcTap from "../screens/DriverNfcTap";
import DriverWriteCard from "../screens/DriverWriteCard";
import DriverCarDetails from "../screens/DriverCarDetails";
import DriverCardActivated from "../screens/DriverCardActivated";
import DriverPickupRequests from "../screens/DriverPickupRequests";
import DriverUpdateParking from "../screens/DriverUpdateParking";
import DriverReturnRequest from "../screens/DriverReturnRequest";
import DriverRetrievalDetail from "../screens/DriverRetrievalDetail";
import DriverHistory from "../screens/DriverHistory";
import DriverProfile from "../screens/DriverProfile";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator = () => {
  const { driver, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F6F7F9" }}>
        <ActivityIndicator size="large" color="#F4531F" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {driver ? (
        <>
          <Stack.Screen name="DriverSelectLocation" component={DriverSelectLocation} />
          <Stack.Screen name="DriverHome" component={DriverHome} />
          <Stack.Screen name="DriverNfcTap" component={DriverNfcTap} />
          <Stack.Screen name="DriverWriteCard" component={DriverWriteCard} />
          <Stack.Screen name="DriverCarDetails" component={DriverCarDetails} />
          <Stack.Screen name="DriverCardActivated" component={DriverCardActivated} />
          <Stack.Screen name="DriverPickupRequests" component={DriverPickupRequests} />
          <Stack.Screen name="DriverUpdateParking" component={DriverUpdateParking} />
          <Stack.Screen
            name="DriverReturnRequest"
            component={DriverReturnRequest}
            options={{ presentation: "transparentModal" }}
          />
          <Stack.Screen name="DriverRetrievalDetail" component={DriverRetrievalDetail} />
          <Stack.Screen name="DriverHistory" component={DriverHistory} />
          <Stack.Screen name="DriverProfile" component={DriverProfile} />
        </>
      ) : (
        <>
          <Stack.Screen name="DriverLogin" component={DriverLogin} />
          <Stack.Screen name="DriverForgotPassword" component={DriverForgotPassword} />
          <Stack.Screen name="DriverResetPassword" component={DriverResetPassword} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default RootNavigator;
