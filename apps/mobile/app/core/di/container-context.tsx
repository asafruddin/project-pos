import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import type { Container, EventKey } from "./container";

const ContainerContext = createContext<Container | null>(null);

export function ContainerProvider({
  container,
  children,
}: {
  container: Container;
  children: ReactNode;
}) {
  return <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>;
}

export function useContainer(): Container {
  const container = useContext(ContainerContext);
  if (!container) throw new Error("ContainerProvider missing");
  return container;
}

/** Subscribe to a vanilla zustand store living in the container. */
export function useContainerStore<T, S>(
  pick: (container: Container) => StoreApi<S>,
  selector: (state: S) => T,
): T {
  return useStore(pick(useContainer()), selector);
}

/** Auth/session state from the container. */
export function useAuth() {
  return useContainerStore((c) => c.auth, (s) => s);
}

/** Preferences (theme, language, catalog view) from the container. */
export function usePrefs() {
  return useContainerStore((c) => c.prefs, (s) => s);
}

/** Re-reads `read()` whenever one of the container's version counters changes. */
export function useEventValue<T>(keys: EventKey[], read: (container: Container) => T): T {
  const container = useContainer();
  const versions = useStore(container.events, (s) => keys.map((k) => s[k]).join("."));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => read(container), [container, versions]);
}
