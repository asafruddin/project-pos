"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReportProductsResponse } from "@pos-apps/types";
import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { ReportToolbar, reportQs, todayUtc } from "@/components/organisms/report-toolbar";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr } from "@/lib/format-money";
import { ProductTable, ReportNote } from "../report-shared";

export default function ReportProductsPage() {
  const me = useDashboardSession();
  const isAdmin = hasPermission(me.permissions, "reports", "view_financial");
  const [from, setFrom] = useState(todayUtc);
  const [to, setTo] = useState(todayUtc);
  const [products, setProducts] = useState<ReportProductsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async (range: { from: string; to: string }) => {
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(`/reports/products?${reportQs(range.from, range.to)}`);
      if (!res.ok) {
        setError("Gagal memuat laporan.");
        return;
      }
      setProducts((await res.json()) as ReportProductsResponse);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" || err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal memuat laporan.");
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void load({ from, to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showMargin = isAdmin;
  const table = useMemo(
    () => ({
      title: `Produk ${from}–${to}`,
      filename: `laporan-produk-${from}-${to}`,
      headers: showMargin
        ? ["Kelompok", "Produk", "Unit", "Omzet", "Margin"]
        : ["Kelompok", "Produk", "Unit", "Omzet"],
      rows: [
        ...(products?.top ?? []).map((row) =>
          showMargin
            ? [
                "Terlaris",
                row.name,
                row.units,
                formatIdr(row.revenue_minor),
                formatIdr(row.margin_minor ?? 0),
              ]
            : ["Terlaris", row.name, row.units, formatIdr(row.revenue_minor)],
        ),
        ...(products?.slow ?? []).map((row) =>
          showMargin
            ? [
                "Lambat",
                row.name,
                row.units,
                formatIdr(row.revenue_minor),
                formatIdr(row.margin_minor ?? 0),
              ]
            : ["Lambat", row.name, row.units, formatIdr(row.revenue_minor)],
        ),
      ],
    }),
    [from, products, showMargin, to],
  );

  return (
    <div className="flex flex-col gap-6">
      <ReportToolbar
        from={from}
        to={to}
        pending={pending}
        table={table}
        onApply={(range) => {
          setFrom(range.from);
          setTo(range.to);
          void load(range);
        }}
      />
      <ReportNote isAdmin={isAdmin} />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Produk terlaris</h2>
        <ProductTable rows={products?.top ?? []} showMargin={showMargin} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Produk lambat</h2>
        <ProductTable rows={products?.slow ?? []} showMargin={showMargin} />
      </section>
    </div>
  );
}
