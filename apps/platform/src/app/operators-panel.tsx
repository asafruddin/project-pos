"use client";

import { Button } from "@pos-apps/ui/atoms";
import { TableSkeleton } from "@pos-apps/ui/molecules";
import { CreateLink, RowLink } from "@pos-apps/ui/organisms";
import { useCallback, useEffect, useState } from "react";
import type {
  ApiErrorBody,
  PlatformOperator,
  PlatformOperatorListResponse,
} from "@pos-apps/types";
import { PLATFORM_ROLE_LABELS } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

function errorMessage(res: Response, body: unknown): string {
  const err = body as ApiErrorBody;
  return err?.message ?? `Gagal (${res.status})`;
}

export function OperatorsPanel() {
  const [operators, setOperators] = useState<PlatformOperator[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await authorizedFetch("/platform/operators");
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      setOperators(((await res.json()) as PlatformOperatorListResponse).operators);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal memuat operator.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchOperator(userId: string, body: { active?: boolean }) {
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(`/platform/operators/${userId}`, {
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
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Daftar operator
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "Memuat…" : `${operators.length} operator`}
          </p>
        </div>
        <CreateLink href="/operators/new">Tambah operator</CreateLink>
      </div>

      {error ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <TableSkeleton rows={4} />
      ) : operators.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Belum ada operator.</p>
        </div>
      ) : (
        <>
          <ul className="grid gap-3 sm:hidden">
            {operators.map((row) => (
              <li
                key={row.user_id}
                className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <p className="font-medium text-foreground">{row.username}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {PLATFORM_ROLE_LABELS[row.role]} ·{" "}
                  {row.active ? "Aktif" : "Nonaktif"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <RowLink href={`/operators/${row.user_id}/edit`}>Ubah</RowLink>
                  <Button
                    type="button"
                    className="h-9 min-h-9 bg-secondary px-3 text-secondary-foreground"
                    disabled={pending}
                    onClick={() =>
                      void patchOperator(row.user_id, { active: !row.active })
                    }
                  >
                    {row.active ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] sm:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Username</th>
                    <th className="px-4 py-3 font-medium">Peran</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {operators.map((row) => (
                    <tr
                      key={row.user_id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">{row.username}</td>
                      <td className="px-4 py-3">
                        {PLATFORM_ROLE_LABELS[row.role]}
                      </td>
                      <td className="px-4 py-3">
                        {row.active ? "Aktif" : "Nonaktif"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <RowLink href={`/operators/${row.user_id}/edit`}>
                            Ubah
                          </RowLink>
                          <Button
                            type="button"
                            className="h-9 min-h-9 bg-secondary px-3 text-secondary-foreground"
                            disabled={pending}
                            onClick={() =>
                              void patchOperator(row.user_id, {
                                active: !row.active,
                              })
                            }
                          >
                            {row.active ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
