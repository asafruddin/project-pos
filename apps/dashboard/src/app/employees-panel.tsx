"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ApiErrorBody,
  StoreListResponse,
  StoreRecord,
  UserAccount,
  UserListResponse,
} from "@pos-apps/types";
import { ROLE_LABELS, STORE_1_ID, hasPermission } from "@pos-apps/types";
import { Button } from "@/components/ui/button";
import { CreateLink, RowLink } from "@/components/ui/form";
import { authorizedFetch } from "@/lib/api-client";

function errorMessage(res: Response, body: unknown): string {
  const err = body as ApiErrorBody;
  return err?.message ?? `Gagal (${res.status})`;
}

export function EmployeesPanel({
  permissions,
}: {
  permissions: string[];
}) {
  const canCreate = hasPermission(permissions, "users", "create");
  const canUpdate = hasPermission(permissions, "users", "update");
  const canEditMatrix = hasPermission(permissions, "rbac", "update");
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [stores, setStores] = useState<StoreRecord[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [usersRes, storesRes] = await Promise.all([
        authorizedFetch("/users"),
        authorizedFetch("/stores"),
      ]);
      if (!usersRes.ok) {
        setError(errorMessage(usersRes, await usersRes.json().catch(() => ({}))));
        return;
      }
      setUsers(((await usersRes.json()) as UserListResponse).users);
      if (storesRes.ok) {
        setStores(((await storesRes.json()) as StoreListResponse).stores);
      }
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchUser(userId: string, body: { active?: boolean }) {
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Daftar karyawan
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {users.length} pengguna
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditMatrix ? (
            <RowLink href="/employees/roles">Matriks izin</RowLink>
          ) : null}
          {canCreate ? (
            <CreateLink href="/employees/new">Tambah karyawan</CreateLink>
          ) : null}
        </div>
      </div>

      {error ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-border">
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
                    {canUpdate ? (
                      <>
                        <RowLink href={`/employees/${row.user_id}/edit`}>Ubah</RowLink>
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
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
