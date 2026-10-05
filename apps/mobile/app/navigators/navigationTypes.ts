import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";

export type RootStackParamList = {
  Menu: undefined;
  Transactions: undefined;
  Customers: undefined;
  DayClose: undefined;
  Settings: undefined;
  Shift: undefined;
};

export type AppScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
export type AppNavigation = NativeStackNavigationProp<RootStackParamList>;
