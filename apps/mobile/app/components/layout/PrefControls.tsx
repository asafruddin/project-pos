import { View } from "react-native";
import { usePrefs, useContainer } from "@/core/di/container-context";
import { nextTheme, type ThemePref } from "@/features/settings/domain/preferences";
import { useT } from "@/i18n";
import { useTheme } from "@/theme";
import { Button, DesktopIcon, MoonIcon, SunIcon, TranslateIcon } from "@/components/ui";

export function themeIcon(pref: ThemePref, color: string, size = 18) {
  if (pref === "light") return <SunIcon size={size} weight="duotone" color={color} />;
  if (pref === "dark") return <MoonIcon size={size} weight="duotone" color={color} />;
  return <DesktopIcon size={size} weight="duotone" color={color} />;
}

export function themeLabel(pref: ThemePref, t: ReturnType<typeof useT>["t"]): string {
  return pref === "light" ? t("themeLight") : pref === "dark" ? t("themeDark") : t("themeSystem");
}

/** Always-visible theme + language controls (PWA `PrefControls`). */
export function PrefControls() {
  const container = useContainer();
  const prefs = usePrefs();
  const { colors } = useTheme();
  const { t } = useT();
  const themeTip = `${t("theme")}: ${themeLabel(prefs.theme, t)}`;
  const langTip = `${t("language")}: ${prefs.lang === "id" ? "Indonesia" : "English"}`;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Button
        variant="outline"
        size="icon"
        accessibilityLabel={themeTip}
        icon={themeIcon(prefs.theme, colors.foreground)}
        onPress={() => container.prefs.getState().setTheme(nextTheme(prefs.theme))}
      />
      <Button
        variant="outline"
        label={prefs.lang.toUpperCase()}
        accessibilityLabel={langTip}
        icon={<TranslateIcon size={18} weight="duotone" color={colors.foreground} />}
        onPress={() => container.prefs.getState().setLang(prefs.lang === "id" ? "en" : "id")}
        style={{ paddingHorizontal: 10 }}
      />
    </View>
  );
}
