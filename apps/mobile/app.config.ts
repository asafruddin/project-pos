import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "POS Cashier",
  slug: "pos-cashier",
  version: "0.1.0",
  // Phones and tablets: layout follows the window size (see theme breakpoints).
  orientation: "default",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  backgroundColor: "#f4f6f8",
  platforms: ["android"],
  android: {
    package: "com.posapps.cashier",
    adaptiveIcon: {
      backgroundColor: "#f97316",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    // Bluetooth/foreground-service permissions are added with the native
    // printer module (see docs/02-mobile/printer.md).
  },
  plugins: [
    "expo-sqlite",
    "expo-secure-store",
    "expo-asset",
    "expo-font",
    "expo-image",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 160,
        backgroundColor: "#f97316",
        dark: { image: "./assets/splash-icon.png", backgroundColor: "#f97316" },
      },
    ],
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    eas: {
      projectId: "3b5eac97-6abd-4fb3-aa42-5cf543806bd8",
    },
  },
};

export default config;
