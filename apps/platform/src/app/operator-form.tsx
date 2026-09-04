"use client";

import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import {
  FormActions,
  FormBackLink,
  FormSection,
  FormBody,
  formPageClassName,
} from "@pos-apps/ui/organisms";
import { Checkbox, Input, Label, Skeleton } from "@pos-apps/ui/atoms";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorBody, PlatformOperatorListResponse } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

function errorMessage(res: Response, body: unknown): string {
  const err = body as ApiErrorBody;
  return err?.message ?? `Gagal (${res.status})`;
}

export function OperatorForm({ userId }: { userId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(Boolean(userId));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const res = await authorizedFetch("/platform/operators");
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        setMissing(true);
        return;
      }
      const packed = (await res.json()) as PlatformOperatorListResponse;
      const row = packed.operators.find((op) => op.user_id === userId);
      if (!row) {
        setError("Operator tidak ditemukan.");
        setMissing(true);
        return;
      }
      setUsername(row.username);
      setActive(row.active);
      setError(null);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal memuat operator.");
      setMissing(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (password && password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = userId
        ? await authorizedFetch(`/platform/operators/${userId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              active,
              ...(password ? { password } : {}),
            }),
          })
        : await authorizedFetch("/platform/operators", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username,
              password,
              role: "super_admin",
            }),
          });
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      router.push("/operators");
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal menyimpan operator.");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-40 w-full max-w-md" />
      </div>
    );
  }

  if (missing) {
    return (
      <div className="flex flex-col gap-5">
        <FormBackLink href="/operators">Daftar operator</FormBackLink>
        <p className="text-sm text-destructive" role="alert">
          {error ?? "Operator tidak ditemukan."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSave(e)} className={formPageClassName}>
      <FormBody>
        <FormBackLink href="/operators">Daftar operator</FormBackLink>
        <FormSection
          title={userId ? "Akun operator" : "Operator baru"}
          description="Hanya Super Admin. Super Admin terakhir tidak dapat dinonaktifkan."
        >
          {userId ? (
            <p className="text-sm text-muted-foreground">Username: {username}</p>
          ) : (
            <FormField id="op-username" label="Username" required>
              <Input
                id="op-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                required
                disabled={pending}
                className={formInputClass}
              />
            </FormField>
          )}
          <FormField
            id="op-password"
            label="Password"
            required={!userId}
            hint={userId ? "Kosongkan jika tidak diubah. Minimal 8 karakter." : undefined}
          >
            <Input
              id="op-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required={!userId}
              minLength={userId ? undefined : 8}
              disabled={pending}
              className={formInputClass}
            />
          </FormField>
          {userId ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id="op-active"
                checked={active}
                disabled={pending}
                onCheckedChange={(checked) => setActive(checked === true)}
              />
              <Label htmlFor="op-active" className="font-normal">
                Akun aktif
              </Label>
            </div>
          ) : null}
        </FormSection>
      </FormBody>
      <FormActions error={error} pending={pending} cancelHref="/operators" />
    </form>
  );
}
