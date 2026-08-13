"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  ApiErrorBody,
  OpnameDetail,
  OpnameListResponse,
  OpnameStatus,
  StockOverviewResponse,
} from "@pos-apps/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authorizedFetch } from "@/lib/api-client";
import { getAccessToken, isAccessTokenExpired, logoutToLogin } from "@/lib/auth-token";

function statusLabel(status: OpnameStatus): string {
  if (status === "draft") return "Draf";
  if (status === "approved") return "Disetujui";
  if (status === "rejected") return "Ditolak";
  return "Dibatalkan";
}

export function OpnamePanel({
  canMutate = true,
  canApprove = true,
}: {
  canMutate?: boolean;
  canApprove?: boolean;
}) {
  const [list, setList] = useState<OpnameListResponse["opnames"]>([]);
  const [catalog, setCatalog] = useState<StockOverviewResponse["products"]>([]);
  const [selected, setSelected] = useState<OpnameDetail | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const loadList = useCallback(async () => {
    const token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) {
      logoutToLogin();
      return;
    }
    try {
      const [opRes, ovRes] = await Promise.all([
        authorizedFetch("/inventory/opnames"),
        authorizedFetch("/inventory/overview"),
      ]);
      const opData = (await opRes.json()) as OpnameListResponse | ApiErrorBody;
      const ovData = (await ovRes.json()) as StockOverviewResponse | ApiErrorBody;
      if (!opRes.ok) {
        setError((opData as ApiErrorBody).message ?? "Gagal memuat opname.");
        return;
      }
      if (!ovRes.ok) {
        setError((ovData as ApiErrorBody).message ?? "Gagal memuat produk.");
        return;
      }
      setError(null);
      setList((opData as OpnameListResponse).opnames);
      setCatalog((ovData as StockOverviewResponse).products);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Tidak dapat menghubungi API.");
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  async function openDetail(id: string) {
    setPending(true);
    try {
      const res = await authorizedFetch(`/inventory/opnames/${id}`);
      const data = (await res.json()) as OpnameDetail | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal memuat opname.");
        setPending(false);
        return;
      }
      const detail = data as OpnameDetail;
      setSelected(detail);
      setCounts(
        Object.fromEntries(
          detail.lines.map((line) => [
            line.product_id,
            line.counted_qty == null ? "" : String(line.counted_qty),
          ]),
        ),
      );
      setError(null);
    } catch {
      setError("Tidak dapat menghubungi API.");
    }
    setPending(false);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (picked.size === 0) {
      setError("Pilih minimal satu produk.");
      return;
    }
    setPending(true);
    try {
      const res = await authorizedFetch("/inventory/opnames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids: [...picked] }),
      });
      const data = (await res.json()) as OpnameDetail | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal membuat opname.");
        setPending(false);
        return;
      }
      setPicked(new Set());
      await loadList();
      await openDetail((data as OpnameDetail).opname_id);
    } catch {
      setError("Tidak dapat menghubungi API.");
    }
    setPending(false);
  }

  async function onSaveCounts(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const lines: Array<{ product_id: string; counted_qty: number }> = [];
    for (const line of selected.lines) {
      const raw = counts[line.product_id] ?? "";
      if (!raw.trim()) continue;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) {
        setError("Jumlah hitung harus bilangan bulat ≥ 0.");
        return;
      }
      lines.push({ product_id: line.product_id, counted_qty: n });
    }
    if (!lines.length) {
      setError("Isi minimal satu jumlah hitung.");
      return;
    }
    setPending(true);
    try {
      const res = await authorizedFetch(
        `/inventory/opnames/${selected.opname_id}/counts`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines }),
        },
      );
      const data = (await res.json()) as OpnameDetail | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal menyimpan hitungan.");
        setPending(false);
        return;
      }
      setSelected(data as OpnameDetail);
      setError(null);
      await loadList();
    } catch {
      setError("Tidak dapat menghubungi API.");
    }
    setPending(false);
  }

  async function decide(path: "approve" | "reject" | "cancel") {
    if (!selected) return;
    setPending(true);
    try {
      const res = await authorizedFetch(
        `/inventory/opnames/${selected.opname_id}/${path}`,
        { method: "POST" },
      );
      const data = (await res.json()) as OpnameDetail | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal memproses opname.");
        setPending(false);
        return;
      }
      setSelected(data as OpnameDetail);
      setError(null);
      await loadList();
    } catch {
      setError("Tidak dapat menghubungi API.");
    }
    setPending(false);
  }

  const draft = selected?.status === "draft";

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {canMutate ? (
      <form onSubmit={(e) => void onCreate(e)} className="flex flex-col gap-3">
        <p className="font-medium">Buat opname</p>
        <div className="max-h-48 overflow-y-auto rounded-md border border-border p-3">
          {catalog.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada produk.</p>
          ) : (
            catalog.map((row) => (
              <label
                key={row.product_id}
                className="flex items-center gap-2 py-1 text-sm"
              >
                <input
                  type="checkbox"
                  checked={picked.has(row.product_id)}
                  onChange={(e) => {
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(row.product_id);
                      else next.delete(row.product_id);
                      return next;
                    });
                  }}
                  disabled={pending}
                />
                <span>
                  {row.name}{" "}
                  <span className="text-muted-foreground">
                    (dijual {row.sellable_qty})
                  </span>
                </span>
              </label>
            ))
          )}
        </div>
        <Button type="submit" disabled={pending} className="h-12 w-fit">
          {pending ? "Menyimpan…" : "Buat draf"}
        </Button>
      </form>
      ) : null}

      <div>
        <p className="mb-2 font-medium">Daftar opname</p>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada opname.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((item) => (
              <li key={item.opname_id}>
                <Button
                  type="button"
                  className="h-11 bg-secondary text-secondary-foreground hover:opacity-90"
                  onClick={() => void openDetail(item.opname_id)}
                  disabled={pending}
                >
                  {statusLabel(item.status)} · {item.product_count} produk
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected ? (
        <form
          onSubmit={(e) => void onSaveCounts(e)}
          className="flex flex-col gap-4"
        >
          <p className="font-medium">
            {statusLabel(selected.status)} · {selected.lines.length} produk
          </p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium">Sistem</th>
                  <th className="px-4 py-3 font-medium">Dihitung</th>
                  <th className="px-4 py-3 font-medium">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {selected.lines.map((line) => {
                  const raw = counts[line.product_id] ?? "";
                  const n = raw.trim() === "" ? null : Number(raw);
                  const variance =
                    n != null && Number.isInteger(n) ? n - line.system_qty : line.variance;
                  return (
                    <tr
                      key={line.product_id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">{line.name}</td>
                      <td className="px-4 py-3">{line.system_qty}</td>
                      <td className="px-4 py-3">
                        {draft ? (
                          <Input
                            inputMode="numeric"
                            value={raw}
                            onChange={(e) =>
                              setCounts((prev) => ({
                                ...prev,
                                [line.product_id]: e.target.value,
                              }))
                            }
                            disabled={pending || !canMutate}
                            className="h-10 w-24"
                          />
                        ) : (
                          line.counted_qty ?? "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {variance == null ? "—" : variance}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {draft ? (
            <div className="flex flex-wrap gap-2">
              {canMutate ? (
              <Button type="submit" disabled={pending} className="h-12">
                Simpan hitungan
              </Button>
              ) : null}
              {canApprove ? (
              <Button
                type="button"
                disabled={pending}
                className="h-12"
                onClick={() => void decide("approve")}
              >
                Setujui
              </Button>
              ) : null}
              {canApprove ? (
              <Button
                type="button"
                disabled={pending}
                className="h-12 bg-secondary text-secondary-foreground hover:opacity-90"
                onClick={() => void decide("reject")}
              >
                Tolak
              </Button>
              ) : null}
              {canMutate ? (
              <Button
                type="button"
                disabled={pending}
                className="h-12 bg-secondary text-secondary-foreground hover:opacity-90"
                onClick={() => void decide("cancel")}
              >
                Batalkan
              </Button>
              ) : null}
            </div>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
