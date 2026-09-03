import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type RootStackParamList = {
  DriverLogin: undefined;
  DriverForgotPassword: undefined;
  DriverResetPassword: { token: string };
  DriverSelectLocation: undefined;
  DriverHome: undefined;
  DriverNfcTap: undefined;
  DriverWriteCard: undefined;
  DriverCarDetails: { cardUid: string };
  DriverCardActivated: { orderId: number; plate: string; carDesc: string };
  DriverPickupRequests: undefined;
  DriverUpdateParking: { orderId: number };
  DriverReturnRequest: undefined;
  DriverRetrievalDetail: { orderId: number };
  DriverHistory: undefined;
  DriverProfile: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
