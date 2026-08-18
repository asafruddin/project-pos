"use client";

import { NativeSelect } from "@pos-apps/ui/atoms";
import { RowLink } from "@pos-apps/ui/organisms";
import { useCallback, useEffect, useState } from "react";
import type {
  ApiErrorBody,
  CustomerListResponse,
  LoyaltyAccount,
  LoyaltyProgram,
} from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";
import { getAccessToken, isAccessTokenExpired, logoutToLogin } from "@/lib/auth-token";
import { formatIdr } from "@/lib/format-money";

export function LoyaltyPanel({ canEdit }: { canEdit: boolean }) {
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [customers, setCustomers] = useState<CustomerListResponse["customers"]>(
    [],
  );
  const [customerId, setCustomerId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadProgram = useCallback(async () => {
    const token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) {
      logoutToLogin();
      return;
    }
    try {
      const [pRes, cRes] = await Promise.all([
        authorizedFetch("/loyalty/program"),
        authorizedFetch("/customers"),
      ]);
      const pData = (await pRes.json()) as LoyaltyProgram | ApiErrorBody;
      if (!pRes.ok) {
        setError((pData as ApiErrorBody).message ?? "Gagal memuat program.");
        return;
      }
      setError(null);
      setProgram(pData as LoyaltyProgram);
      if (cRes.ok) {
        const cData = (await cRes.json()) as CustomerListResponse;
        setCustomers(cData.customers);
      }
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal memuat program loyalitas.");
    }
  }, []);

  useEffect(() => {
    void loadProgram();
  }, [loadProgram]);

  async function loadAccount(id: string) {
    setCustomerId(id);
    setAccount(null);
    if (!id) return;
    try {
      const res = await authorizedFetch(`/loyalty/accounts/${id}`);
      const data = (await res.json()) as LoyaltyAccount | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal memuat akun.");
        return;
      }
      setError(null);
      setAccount(data as LoyaltyAccount);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal memuat akun loyalitas.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Buku besar pelanggan
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pilih pelanggan untuk melihat mutasi poin.
          </p>
        </div>
        {canEdit ? (
          <RowLink href="/loyalty/program">Ubah program</RowLink>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)] sm:p-4">
        <NativeSelect
          value={customerId}
          onChange={(e) => void loadAccount(e.target.value)}
          aria-label="Pilih pelanggan"
          className="h-10"
        >
          <option value="">Pilih pelanggan</option>
          {customers.map((row) => (
            <option key={row.customer_id} value={row.customer_id}>
              {row.name} · {row.loyalty_points} poin
            </option>
          ))}
        </NativeSelect>
      </div>

      {account ? (
        account.ledger.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Saldo {account.points_balance} · seumur hidup {account.lifetime_earned}
              {account.tier ? ` · ${account.tier}` : ""}. Belum ada mutasi.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Saldo {account.points_balance} · seumur hidup {account.lifetime_earned}
              {account.tier ? ` · ${account.tier}` : ""}
            </p>
            <ul className="grid gap-3 sm:hidden">
              {account.ledger.map((row) => (
                <li
                  key={row.entry_id}
                  className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
                >
                  <p className="font-medium text-foreground">
                    {row.kind} {row.points_delta > 0 ? "+" : ""}
                    {row.points_delta}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {row.note ?? "—"}
                    {row.occurred_at
                      ? ` · ${new Date(row.occurred_at).toLocaleString("id-ID")}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] sm:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Jenis</th>
                      <th className="px-4 py-3 font-medium">Poin</th>
                      <th className="px-4 py-3 font-medium">Catatan</th>
                      <th className="px-4 py-3 font-medium">Waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {account.ledger.map((row) => (
                      <tr
                        key={row.entry_id}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="px-4 py-3 font-medium">{row.kind}</td>
                        <td className="px-4 py-3">
                          {row.points_delta > 0 ? "+" : ""}
                          {row.points_delta}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.note ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.occurred_at
                            ? new Date(row.occurred_at).toLocaleString("id-ID")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          Pilih pelanggan untuk melihat poin. Nilai{" "}
          {formatIdr(program?.point_value_minor ?? 100)}.
        </p>
      )}
    </div>
  );
}
