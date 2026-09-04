"use client";

import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pos-apps/ui/molecules";
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
import type {
  ApiErrorBody,
  Role,
  StoreListResponse,
  StoreRecord,
  UserListResponse,
} from "@pos-apps/types";
import { ACCOUNT_ROLES, ROLE_LABELS, STORE_1_ID } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

function errorMessage(res: Response, body: unknown): string {
  const err = body as ApiErrorBody;
  return err?.message ?? `Gagal (${res.status})`;
}

function storeOptions(stores: StoreRecord[]): StoreRecord[] {
  return stores.length
    ? stores
    : [{ store_id: STORE_1_ID, name: "Store #1", created_at: "" }];
}

export function AccountForm({ userId }: { userId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(Boolean(userId));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("cashier");
  const [storeId, setStoreId] = useState(STORE_1_ID);
  const [active, setActive] = useState(true);
  const [stores, setStores] = useState<StoreRecord[]>([]);

  const load = useCallback(async () => {
    try {
      const [usersRes, storesRes] = await Promise.all([
        userId ? authorizedFetch("/platform/accounts") : Promise.resolve(null),
        authorizedFetch("/platform/stores"),
      ]);
      if (storesRes.ok) {
        setStores(((await storesRes.json()) as StoreListResponse).stores);
      }
      if (userId && usersRes) {
        if (!usersRes.ok) {
          setError(errorMessage(usersRes, await usersRes.json().catch(() => ({}))));
          setMissing(true);
          return;
        }
        const packed = (await usersRes.json()) as UserListResponse;
        const row = packed.users.find((user) => user.user_id === userId);
        if (!row) {
          setError("Akun tidak ditemukan.");
          setMissing(true);
          return;
        }
        setUsername(row.username);
        setRole(row.role);
        setStoreId(row.store_id);
        setActive(row.active);
      }
      setError(null);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal memuat akun POS.");
      if (userId) setMissing(true);
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
        ? await authorizedFetch(`/platform/accounts/${userId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              role,
              store_id: storeId,
              active,
              ...(password ? { password } : {}),
            }),
          })
        : await authorizedFetch("/platform/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username,
              password,
              role,
              store_id: storeId,
            }),
          });
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      router.push("/accounts");
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal menyimpan akun POS.");
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
        <FormBackLink href="/accounts">Daftar akun POS</FormBackLink>
        <p className="text-sm text-destructive" role="alert">
          {error ?? "Akun tidak ditemukan."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSave(e)} className={formPageClassName}>
      <FormBody>
        <FormBackLink href="/accounts">Daftar akun POS</FormBackLink>
        <FormSection
          title={userId ? "Akun POS" : "Pengguna baru"}
          description="Operator dapat menetapkan Owner. Owner terakhir tidak dapat dinonaktifkan."
        >
          {userId ? (
            <p className="text-sm text-muted-foreground">Username: {username}</p>
          ) : (
            <FormField id="acc-username" label="Username" required>
              <Input
                id="acc-username"
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
            id="acc-password"
            label="Password"
            required={!userId}
            hint={userId ? "Kosongkan jika tidak diubah. Minimal 8 karakter." : undefined}
          >
            <Input
              id="acc-password"
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
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="acc-role" label="Peran" required>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as Role)}
                disabled={pending}
              >
                <SelectTrigger id="acc-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="acc-store" label="Toko" required>
              <Select
                value={storeId}
                onValueChange={setStoreId}
                disabled={pending}
              >
                <SelectTrigger id="acc-store">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {storeOptions(stores).map((store) => (
                    <SelectItem key={store.store_id} value={store.store_id}>
                      {store.name}
                      {store.store_id === STORE_1_ID ? " · Store #1" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          {userId ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id="acc-active"
                checked={active}
                disabled={pending}
                onCheckedChange={(checked) => setActive(checked === true)}
              />
              <Label htmlFor="acc-active" className="font-normal">
                Akun aktif
              </Label>
            </div>
          ) : null}
        </FormSection>
      </FormBody>
      <FormActions error={error} pending={pending} cancelHref="/accounts" />
    </form>
  );
}
