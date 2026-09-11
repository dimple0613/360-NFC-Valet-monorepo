import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "@360nfc";

const StorageKeys = {
  token: `${PREFIX}:token`,
  user: `${PREFIX}:user`,
  notificationsOn: `${PREFIX}:notificationsOn`,
} as const;

export const storage = {
  async get<T>(key: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  async set(key: string, value: unknown): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};

export { StorageKeys };
