"use client";

import { Button } from "@pos-apps/ui/atoms";
import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/providers/theme-provider";
import { isDarkTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dark = mounted && isDarkTheme(theme);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Gunakan mode terang" : "Gunakan mode gelap"}
      title={dark ? "Mode terang" : "Mode gelap"}
    >
      {dark ? <SunIcon size={18} weight="bold" /> : <MoonIcon size={18} weight="bold" />}
    </Button>
  );
}
