import { useMemo } from "react";
import { useStore } from "zustand";
import { useContainer } from "@/core/di/container-context";

/** product id → cached photo URI, refreshed after each catalog/image pull. */
export function useImageUris(): Map<string, string> {
  const container = useContainer();
  const version = useStore(container.catalogEvents, (s) => s.imagesVersion);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => container.repositories.images.uriMap(), [container, version]);
}
