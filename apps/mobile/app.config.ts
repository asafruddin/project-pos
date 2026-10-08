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
    // Resize above the keyboard so the login form can move up instead of staying covered.
    softwareKeyboardLayoutMode: "resize",
    permissions: [
      "android.permission.BLUETOOTH",
      "android.permission.BLUETOOTH_ADMIN",
      "android.permission.BLUETOOTH_CONNECT",
      "android.permission.BLUETOOTH_SCAN",
    ],
  },
  plugins: [
    "expo-sqlite",
    "expo-secure-store",
    "expo-asset",
    "expo-sharing",
    "expo-font",
    "expo-image",
    "./plugins/with-bluetooth-printer",
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
