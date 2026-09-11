import { Platform } from "react-native";

let _Notifications: typeof import("expo-notifications") | null = null;
let _Device: typeof import("expo-device") | null = null;
let _loaded = false;

function loadModules() {
  if (_loaded) return;
  _loaded = true;
  try {
    _Notifications = require("expo-notifications");
    _Notifications!.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    _Device = require("expo-device");
  } catch {
    console.log("[Push] expo-notifications not available in Expo Go");
  }
}

export async function registerForPushNotifications(): Promise<string | null> {
  loadModules();
  if (!_Notifications || !_Device) return null;
  if (!_Device.isDevice) return null;

  const { status: existing } = await _Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await _Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await _Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: _Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const token = await _Notifications.getExpoPushTokenAsync();
  return token.data;
}

export function listenForNotifications(
  onReceive: (notification: unknown) => void
) {
  loadModules();
  if (!_Notifications) return null;
  return _Notifications.addNotificationReceivedListener(onReceive as never);
}

export function listenForNotificationResponse(
  onResponse: (response: unknown) => void
) {
  loadModules();
  if (!_Notifications) return null;
  return _Notifications.addNotificationResponseReceivedListener(onResponse as never);
}
