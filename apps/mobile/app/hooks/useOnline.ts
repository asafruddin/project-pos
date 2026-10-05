import { useSyncExternalStore } from "react";
import { useContainer } from "@/core/di/container-context";

export function useOnline(): boolean {
  const container = useContainer();
  return useSyncExternalStore(
    (cb) => container.connectivity.subscribe(cb),
    () => container.connectivity.getSnapshot().state === "online",
  );
}
