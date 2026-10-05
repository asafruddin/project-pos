import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Modal, View } from "react-native";
import { useAuth, useContainer } from "@/core/di/container-context";
import { AuthLoading } from "@/components/layout";
import CustomersScreen from "@/screens/CustomersScreen";
import DayCloseScreen from "@/screens/DayCloseScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import MenuScreen from "@/screens/MenuScreen";
import { PinScreen } from "@/screens/PinScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import ShiftScreen from "@/screens/ShiftScreen";
import TransactionsScreen from "@/screens/TransactionsScreen";
import { useT } from "@/i18n";
import { fontFamily, useTheme } from "@/theme";
import type { RootStackParamList } from "./navigationTypes";

const Stack = createNativeStackNavigator<RootStackParamList>();

/** The till: every screen draws its own shell (header + nav), so no native header and no transition flash. */
function MainStack({ initial }: { initial: keyof RootStackParamList }) {
  return (
    <Stack.Navigator initialRouteName={initial} screenOptions={{ headerShown: false, animation: "none", gestureEnabled: false }}>
      <Stack.Screen name="Menu" component={MenuScreen} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
      <Stack.Screen name="Customers" component={CustomersScreen} />
      <Stack.Screen name="DayClose" component={DayCloseScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Shift" component={ShiftScreen} />
    </Stack.Navigator>
  );
}

/** Gate: account login → PIN → till. A leftover/closing shift sends the cashier to the shift screen first. */
export function AppNavigator() {
  const container = useContainer();
  const { colors, dark } = useTheme();
  const { t } = useT();
  const { gate, shiftIntent, reauthOpen } = useAuth();
  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: colors.background, card: colors.card, text: colors.foreground, border: colors.border, primary: colors.primary },
    fonts: { ...base.fonts, regular: { ...base.fonts.regular, fontFamily: fontFamily.regular } },
  };

  if (gate === "booting") return <AuthLoading message={t("loading")} />;
  if (gate === "login") return <LoginScreen />;
  if (gate === "pin") return <PinScreen />;

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer theme={navTheme}>
        <MainStack key={shiftIntent ? "shift" : "main"} initial={shiftIntent ? "Shift" : "Menu"} />
      </NavigationContainer>
      <Modal visible={reauthOpen} animationType="slide" onRequestClose={() => container.closeReauth()}>
        <LoginScreen reauth />
      </Modal>
    </View>
  );
}
