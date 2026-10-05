import { AppState } from "react-native";

/** App foreground/background signal (RN AppState in the app, a fake in tests). */
export interface AppStateSource {
  /** Emits `true` whenever the app comes to the foreground. */
  onForeground(listener: () => void): () => void;
}

export const reactNativeAppState: AppStateSource = {
  onForeground(listener) {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") listener();
    });
    return () => sub.remove();
  },
};
