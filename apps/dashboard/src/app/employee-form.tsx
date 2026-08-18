"use client";

import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import { FormActions, FormBackLink, FormDenied, FormSection, FormBody, formPageClassName } from "@pos-apps/ui/organisms";
import { Checkbox, Input, Label, NativeSelect, Skeleton } from "@pos-apps/ui/atoms";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ApiErrorBody,
  Role,
  StoreListResponse,
  StoreRecord,
  UserListResponse,
} from "@pos-apps/types";
import {
  ACCOUNT_ROLES,
  ROLE_LABELS,
  STORE_1_ID,
  hasPermission,
} from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

export function assignableRoles(actorRole: Role): Role[] {
  return ACCOUNT_ROLES.filter((target) => {
    if (target === "owner") return actorRole === "owner";
    if (target === "catalog_admin" || target === "store_manager") {
      return actorRole === "owner" || actorRole === "catalog_admin";
    }
    return actorRole === "owner" || actorRole === "catalog_admin";
  });
}

function errorMessage(res: Response, body: unknown): string {
  const err = body as ApiErrorBody;
  return err?.message ?? `Gagal (${res.status})`;
}

function storeOptions(stores: StoreRecord[]): StoreRecord[] {
  return stores.length
    ? stores
    : [{ store_id: STORE_1_ID, name: "Store #1", created_at: "" }];
}

export function EmployeeForm({
  actorRole,
  permissions,
  userId,
}: {
  actorRole: Role;
  permissions: string[];
  userId?: string;
}) {
  const router = useRouter();
  const canMutate = userId
    ? hasPermission(permissions, "users", "update")
    : hasPermission(permissions, "users", "create");
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
        userId ? authorizedFetch("/users") : Promise.resolve(null),
        authorizedFetch("/stores"),
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
          setError("Karyawan tidak ditemukan.");
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
      setError("Gagal memuat karyawan.");
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
    if (!canMutate || pending) return;
    if (password && password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = userId
        ? await authorizedFetch(`/users/${userId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              role,
              store_id: storeId,
              active,
              ...(password ? { password } : {}),
            }),
          })
        : await authorizedFetch("/users", {
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
      router.push("/employees");
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal menyimpan karyawan.");
    } finally {
      setPending(false);
    }
  }

  if (!canMutate) {
    return (
      <FormDenied href="/employees">
        {userId
          ? "Anda tidak memiliki izin untuk mengubah karyawan."
          : "Anda tidak memiliki izin untuk menambah karyawan."}
      </FormDenied>
    );
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
      
        <FormBackLink href="/employees">Daftar karyawan</FormBackLink>
        <p className="text-sm text-destructive" role="alert">
          {error ?? "Karyawan tidak ditemukan."}
        </p>
      </div>
    );
  }

  const roles = userId
    ? Array.from(new Set<Role>([role, ...assignableRoles(actorRole)]))
    : assignableRoles(actorRole);

  return (
    <form onSubmit={(e) => void onSave(e)} className={formPageClassName}>
      <FormBody>
      <FormBackLink href="/employees">Daftar karyawan</FormBackLink>
      <FormSection
        title={userId ? "Akun" : "Pengguna baru"}
        description="Toko mengikuti akun, bukan Checkout. Store Manager tidak dapat membuat Admin. Kasir PWA tidak punya layar ini."
      >
        {userId ? (
          <p className="text-sm text-muted-foreground">Username: {username}</p>
        ) : (
          <FormField id="emp-username" label="Username" required>
            <Input
              id="emp-username"
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
          id="emp-password"
          label="Password"
          required={!userId}
          hint={userId ? "Kosongkan jika tidak diubah. Minimal 8 karakter." : undefined}
        >
          <Input
            id="emp-password"
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
          <FormField id="emp-role" label="Peran" required>
            <NativeSelect
              id="emp-role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              disabled={pending}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="emp-store" label="Toko" required>
            <NativeSelect
              id="emp-store"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              disabled={pending}
            >
              {storeOptions(stores).map((store) => (
                <option key={store.store_id} value={store.store_id}>
                  {store.name}
                  {store.store_id === STORE_1_ID ? " · Store #1" : ""}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
        {userId ? (
          <div className="flex items-center gap-2">
            <Checkbox
              id="emp-active"
              checked={active}
              disabled={pending}
              onCheckedChange={(checked) => setActive(checked === true)}
            />
            <Label htmlFor="emp-active" className="font-normal">
              Akun aktif
            </Label>
          </div>
        ) : null}
      </FormSection>
      
      </FormBody>
      <FormActions
        error={error}
        pending={pending}
        cancelHref="/employees"
      />
    </form>
  );
}
