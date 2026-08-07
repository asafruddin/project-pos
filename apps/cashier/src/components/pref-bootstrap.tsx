"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { applyTheme, getLang } from "@/lib/preferences";

/** Client bootstrap for theme/lang before paint of child routes. */
export function PrefBootstrap({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyTheme();
    document.documentElement.lang = getLang();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return children;
}
