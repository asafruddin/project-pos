"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type {
  ApiErrorBody,
  PlatformOperatorListResponse,
  UserListResponse,
} from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

function errorMessage(res: Response, body: unknown): string {
  const err = body as ApiErrorBody;
  return err?.message ?? `Gagal (${res.status})`;
}

export function HomePanel() {
  const [operators, setOperators] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [opsRes, accRes] = await Promise.all([
        authorizedFetch("/platform/operators"),
        authorizedFetch("/platform/accounts"),
      ]);
      if (!opsRes.ok) {
        setError(errorMessage(opsRes, await opsRes.json().catch(() => ({}))));
        return;
      }
      if (!accRes.ok) {
        setError(errorMessage(accRes, await accRes.json().catch(() => ({}))));
        return;
      }
      setOperators(
        ((await opsRes.json()) as PlatformOperatorListResponse).operators.length,
      );
      setAccounts(((await accRes.json()) as UserListResponse).users.length);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal memuat ringkasan.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {error ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/operators"
          className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-primary/40"
        >
          <p className="text-sm text-muted-foreground">Operator</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {operators ?? "—"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Akun Super Admin konsol ini
          </p>
        </Link>
        <Link
          href="/accounts"
          className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-primary/40"
        >
          <p className="text-sm text-muted-foreground">Akun POS</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {accounts ?? "—"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pengguna toko di deployment ini
          </p>
        </Link>
      </div>
    </div>
  );
}
