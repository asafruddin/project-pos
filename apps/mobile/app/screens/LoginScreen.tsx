import { useState } from "react";
import { View } from "react-native";
import { AuthShell, PrefControls } from "@/components/layout";
import { Button, EyeIcon, EyeSlashIcon, Text, TextField } from "@/components/ui";
import { useAuth, useContainer } from "@/core/di/container-context";
import { isAppError } from "@/core/errors/app-error";
import { useT, type TranslationKey } from "@/i18n";
import { radius, useTheme } from "@/theme";

function errorKey(error: unknown): TranslationKey | string {
  if (isAppError(error)) {
    if (error.code === "NETWORK" || error.code === "TIMEOUT") return "apiDown";
    if (error.code === "VALIDATION" && error.message === "NOT_CASHIER") return "notCashier";
    if (error.code === "API" && error.message) return error.message; // server text, e.g. wrong password
  }
  return error instanceof Error && error.message === "INVALID_LOGIN_RESPONSE" ? "invalidResponse" : "apiDown";
}

/** Account login. Also used (inside a modal) to renew an expired token without leaving the till. */
export function LoginScreen({ reauth }: { reauth?: boolean }) {
  const container = useContainer();
  const { colors } = useTheme();
  const { t } = useT();
  const { session, logoUri } = useAuth();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (pending || !login.trim() || !password) return;
    setPending(true);
    setError(null);
    try {
      await container.signIn({ login, password });
    } catch (e) {
      const key = errorKey(e);
      setError(key in { apiDown: 1, notCashier: 1, invalidResponse: 1 } ? t(key as TranslationKey) : key);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      brandTitle={reauth && session ? session.storeName : "POS Apps"}
      brandSubtitle={t("brand")}
      heading={reauth ? t("reauthTitle") : t("title")}
      description={reauth ? t("reauthBody") : t("subtitle")}
      logoUri={reauth ? logoUri : null}
      topRight={<PrefControls />}
    >
      <View style={{ gap: 20 }}>
        <TextField
          label={t("username")}
          value={login}
          onChangeText={setLogin}
          placeholder={t("usernamePlaceholder")}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          editable={!pending}
          height={48}
          error={Boolean(error)}
        />
        <TextField
          label={t("password")}
          value={password}
          onChangeText={setPassword}
          placeholder={t("passwordPlaceholder")}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          editable={!pending}
          height={48}
          error={Boolean(error)}
          right={
            <Button
              variant="ghost"
              size="iconSm"
              accessibilityLabel={show ? t("hidePasswordAria") : t("showPasswordAria")}
              accessibilityState={{ checked: show }}
              icon={show ? <EyeSlashIcon size={18} weight="bold" color={colors.mutedForeground} /> : <EyeIcon size={18} weight="bold" color={colors.mutedForeground} />}
              onPress={() => setShow((v) => !v)}
              disabled={pending}
            />
          }
        />
        {error ? (
          <View
            accessibilityRole="alert"
            style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: `${colors.destructive}4d`, backgroundColor: `${colors.destructive}1a`, paddingHorizontal: 12, paddingVertical: 10 }}
          >
            <Text color={colors.destructive}>{error}</Text>
          </View>
        ) : null}
        <Button
          size="lg"
          label={pending ? t("pending") : t("submit")}
          loading={pending}
          disabled={!login.trim() || !password}
          onPress={submit}
        />
        {reauth ? <Button variant="link" label={t("cancel")} onPress={() => container.closeReauth()} /> : null}
      </View>
    </AuthShell>
  );
}
