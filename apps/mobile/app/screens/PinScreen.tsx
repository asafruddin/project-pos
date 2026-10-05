import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AuthLoading, AuthShell, PinPad, PrefControls } from "@/components/layout";
import { Button, Text } from "@/components/ui";
import { useAuth, useContainer } from "@/core/di/container-context";
import { isAppError } from "@/core/errors/app-error";
import { useT } from "@/i18n";
import { radius, useTheme } from "@/theme";

type Mode = "loading" | "enroll" | "unlock" | "blocked";

/** 6-digit PIN: set it once after an online login, then unlock offline for the rest of the shift. */
export function PinScreen() {
  const container = useContainer();
  const { colors } = useTheme();
  const { t } = useT();
  const { session, logoUri } = useAuth();
  const [mode, setMode] = useState<Mode>("loading");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const submitting = useRef(false);
  const offline = !container.isOnline();

  useEffect(() => {
    void container.pinMode().then(setMode);
  }, [container]);

  // Tick while locked so the countdown updates.
  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [lockedUntil]);
  const lockedFor = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const locked = lockedFor > 0;

  const submit = useCallback(
    async (digits: string) => {
      if (digits.length !== 6 || submitting.current || locked) return;
      submitting.current = true;
      setPending(true);
      setError(null);
      try {
        const userId = session?.userId ?? null;
        if (mode === "enroll") {
          if (!userId || !container.isOnline()) {
            setError(t("pinOfflineNoMaterial"));
            setPin("");
            return;
          }
          await container.pins.enroll(userId, digits);
          container.completePinUnlock();
          return;
        }
        if (mode === "unlock") {
          const result = await container.pins.verify(userId, digits);
          if (result.ok) {
            container.completePinUnlock();
            return;
          }
          if (result.reason === "locked") {
            setNow(Date.now());
            setLockedUntil(Date.now() + result.retryAfterMs);
            setError(null);
          } else {
            setError(result.reason === "no_material" ? t("pinOfflineNoMaterial") : t("pinWrong"));
          }
          setPin("");
          return;
        }
        setError(t("pinOfflineNoMaterial"));
        setPin("");
      } catch (e) {
        setError(isAppError(e) ? t("pinWrong") : t("genericError"));
        setPin("");
      } finally {
        setPending(false);
        submitting.current = false;
      }
    },
    [container, locked, mode, session?.userId, t],
  );

  if (mode === "loading") return <AuthLoading message={t("loading")} />;

  const storeName = mode === "blocked" ? "POS Apps" : (session?.storeName ?? "POS Apps");
  const hasToken = Boolean(session?.accessToken);

  if (mode === "blocked") {
    return (
      <AuthShell brandTitle="POS Apps" brandSubtitle={t("brand")} heading={t("pinTitle")} description={t("pinOfflineNoMaterial")} topRight={<PrefControls />}>
        <Button size="lg" label={t("title")} onPress={() => void container.endAccountSession()} />
      </AuthShell>
    );
  }

  const description = `${mode === "enroll" ? t("pinEnrollHint") : t("pinUnlockHint")}${offline ? ` ${t("pinOfflineBadge")}` : ""}`;

  return (
    <AuthShell
      brandTitle={storeName}
      brandSubtitle={t("brand")}
      heading={t("pinTitle")}
      description={description}
      quoteBy={storeName}
      logoUri={logoUri}
      topRight={<PrefControls />}
    >
      <View style={{ gap: 24 }}>
        <PinPad
          value={pin}
          label={t("pinInputLabel")}
          disabled={pending || locked}
          onChange={(next) => {
            setError(null);
            setPin(next);
            if (next.length === 6) void submit(next);
          }}
        />
        {locked ? (
          <Banner tone="warning">{t("pinLocked", { seconds: lockedFor })}</Banner>
        ) : error ? (
          <Banner tone="danger">{error}</Banner>
        ) : null}
        <Button size="lg" label={pending ? t("pending") : t("pinSubmit")} loading={pending} disabled={pin.length !== 6 || locked} onPress={() => void submit(pin)} />
        <Button
          variant="link"
          label={hasToken ? t("logout") : t("title")}
          // Like the PWA: leaving from the PIN screen ends the account session without unlocking anything.
          // Local data and any open shift stay on the device for the next login.
          onPress={() => void container.endAccountSession()}
        />
      </View>
    </AuthShell>
  );

  function Banner({ tone, children }: { tone: "danger" | "warning"; children: string }) {
    const c = tone === "danger" ? colors.destructive : colors.warning;
    return (
      <View accessibilityRole="alert" style={{ borderRadius: radius.xl, borderWidth: 1, borderColor: `${c}4d`, backgroundColor: `${c}1a`, paddingHorizontal: 12, paddingVertical: 10 }}>
        <Text color={tone === "danger" ? c : colors.foreground} style={{ textAlign: "center" }}>{children}</Text>
      </View>
    );
  }
}
