"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  ApiErrorBody,
  Role,
  RolePermissionsResponse,
  StoreListResponse,
  StoreRecord,
  UserAccount,
  UserListResponse,
} from "@pos-apps/types";
import { ACCOUNT_ROLES, ROLE_LABELS, STORE_1_ID, hasPermission } from "@pos-apps/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authorizedFetch } from "@/lib/api-client";

function assignableRoles(actorRole: Role): Role[] {
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

export function EmployeesPanel({
  actorRole,
  permissions,
}: {
  actorRole: Role;
  permissions: string[];
}) {
  const canEditMatrix = hasPermission(permissions, "rbac", "update");
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [roles, setRoles] = useState<RolePermissionsResponse["roles"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("cashier");
  const [storeId, setStoreId] = useState(STORE_1_ID);
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [matrixRole, setMatrixRole] = useState<Role>("cashier");
  const [matrixText, setMatrixText] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [usersRes, rolesRes, storesRes] = await Promise.all([
        authorizedFetch("/users"),
        authorizedFetch("/rbac/roles"),
        authorizedFetch("/stores"),
      ]);
      if (!usersRes.ok) {
        setError(errorMessage(usersRes, await usersRes.json().catch(() => ({}))));
        return;
      }
      if (!rolesRes.ok) {
        setError(errorMessage(rolesRes, await rolesRes.json().catch(() => ({}))));
        return;
      }
      setUsers(((await usersRes.json()) as UserListResponse).users);
      if (storesRes.ok) {
        setStores(((await storesRes.json()) as StoreListResponse).stores);
      }
      const packed = (await rolesRes.json()) as RolePermissionsResponse;
      setRoles(packed.roles);
      const current =
        packed.roles.find((r) => r.role === matrixRole)?.permissions ?? [];
      setMatrixText(current.join("\n"));
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal memuat karyawan.");
    }
  }, [matrixRole]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch("/users", {
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
      setUsername("");
      setPassword("");
      await load();
    } finally {
      setPending(false);
    }
  }

  async function patchUser(
    userId: string,
    body: { active?: boolean; role?: Role; password?: string },
  ) {
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(`/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      await load();
    } finally {
      setPending(false);
    }
  }

  async function saveMatrix(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const permissions = matrixText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((key) => {
        const [resource, action] = key.split(":");
        return { resource: resource ?? "", action: action ?? "" };
      });
    try {
      const res = await authorizedFetch(`/rbac/roles/${matrixRole}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      await load();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <div
          className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => void onCreate(e)}>
        <div>
          <Label htmlFor="emp-username">Username</Label>
          <Input
            id="emp-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor="emp-password">Password</Label>
          <Input
            id="emp-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div>
          <Label htmlFor="emp-role">Peran</Label>
          <select
            id="emp-role"
            className="flex h-12 w-full rounded-lg border border-border bg-background px-3 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {assignableRoles(actorRole).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="emp-store">Toko</Label>
          <select
            id="emp-store"
            className="flex h-12 w-full rounded-lg border border-border bg-background px-3 text-sm"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          >
            {(stores.length ? stores : [{ store_id: STORE_1_ID, name: "Store #1", created_at: "" }]).map(
              (store) => (
                <option key={store.store_id} value={store.store_id}>
                  {store.name}
                  {store.store_id === STORE_1_ID ? " · Store #1" : ""}
                </option>
              ),
            )}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={pending}>
            Buat pengguna
          </Button>
        </div>
      </form>
      <p className="text-xs text-muted-foreground">
        Toko mengikuti akun, bukan Checkout. Store Manager tidak dapat membuat Admin. Kasir PWA tidak punya layar ini.
      </p>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-3 py-2 font-medium">Username</th>
              <th className="px-3 py-2 font-medium">Peran</th>
              <th className="px-3 py-2 font-medium">Toko</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((row) => (
              <tr key={row.user_id} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2">{row.username}</td>
                <td className="px-3 py-2">{ROLE_LABELS[row.role]}</td>
                <td className="px-3 py-2">
                  {stores.find((store) => store.store_id === row.store_id)?.name ??
                    (row.store_id === STORE_1_ID ? "Store #1" : row.store_id)}
                </td>
                <td className="px-3 py-2">{row.active ? "Aktif" : "Nonaktif"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="h-9 min-h-9 bg-secondary px-3 text-secondary-foreground"
                      disabled={pending}
                      onClick={() =>
                        void patchUser(row.user_id, { active: !row.active })
                      }
                    >
                      {row.active ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                    <Button
                      type="button"
                      className="h-9 min-h-9 bg-secondary px-3 text-secondary-foreground"
                      disabled={pending}
                      onClick={() => {
                        const next = window.prompt("Password baru (min 8)");
                        if (next) void patchUser(row.user_id, { password: next });
                      }}
                    >
                      Reset sandi
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEditMatrix ? (
        <form className="flex flex-col gap-3" onSubmit={(e) => void saveMatrix(e)}>
          <h2 className="text-lg font-semibold">Matriks izin</h2>
          <p className="text-sm text-muted-foreground">
            Satu izin per baris (`resource:action`). Berlaku pada permintaan API berikutnya — bukan
            hanya hide/show UI. Peran: {ROLE_LABELS[actorRole]}.
          </p>
          <div className="max-w-sm">
            <Label htmlFor="matrix-role">Peran</Label>
            <select
              id="matrix-role"
              className="flex h-12 w-full rounded-lg border border-border bg-background px-3 text-sm"
              value={matrixRole}
              onChange={(e) => {
                const next = e.target.value as Role;
                setMatrixRole(next);
                setMatrixText(
                  (roles.find((r) => r.role === next)?.permissions ?? []).join("\n"),
                );
              }}
            >
              {ACCOUNT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="min-h-48 w-full rounded-lg border border-border bg-background p-3 font-mono text-xs"
            value={matrixText}
            onChange={(e) => setMatrixText(e.target.value)}
          />
          <Button type="submit" disabled={pending} className="w-fit">
            Simpan matriks
          </Button>
        </form>
      ) : null}
    </div>
  );
}
