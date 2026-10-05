import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { createContainer, type Container } from "@/core/di/container";
import { ContainerProvider } from "@/core/di/container-context";
import { Text, ToastProvider } from "@/components/ui";
import { netInfoSource } from "@/infrastructure/connectivity/netinfo-source";
import { openAppDb } from "@/infrastructure/db/client";
import { runMigrations } from "@/infrastructure/db/migrate";
import { reactNativeAppState } from "@/infrastructure/sync/app-state-source";
import { AppNavigator } from "@/navigators/AppNavigator";
import { fontFiles, ThemeProvider, useTheme } from "@/theme";

void SplashScreen.preventAutoHideAsync();

function Themed() {
  const { dark } = useTheme();
  return <StatusBar style={dark ? "light" : "dark"} />;
}

export default function App() {
  const [fontsReady, fontError] = useFonts(fontFiles);
  const [container, setContainer] = useState<Container | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let created: Container | null = null;
    let cancelled = false;
    (async () => {
      try {
        const db = openAppDb();
        await runMigrations(db);
        created = createContainer({ db, network: netInfoSource, appState: reactNativeAppState });
        await created.start();
        if (!cancelled) setContainer(created);
      } catch (e) {
        if (!cancelled) setFailure(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      created?.stop();
    };
  }, []);

  const ready = (fontsReady || Boolean(fontError)) && (container !== null || failure !== null);
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  if (!container) {
    return (
      <SafeAreaProvider>
        <View style={styles.boot}>
          <Text weight="semibold">Failed to start</Text>
          <Text size={13} muted style={{ textAlign: "center" }}>{failure}</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ContainerProvider container={container}>
        <ThemeProvider store={container.prefs}>
          <Themed />
          <ToastProvider>
            <AppNavigator />
          </ToastProvider>
        </ThemeProvider>
      </ContainerProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
});
