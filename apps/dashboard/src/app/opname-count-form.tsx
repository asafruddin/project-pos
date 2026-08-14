"use client";

import { Button, Input, Skeleton } from "@pos-apps/ui/atoms";
import { formInputClass } from "@pos-apps/ui/molecules";
import { FormActions, FormBackLink, FormSection } from "@pos-apps/ui/organisms";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorBody, OpnameDetail, OpnameStatus } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

function statusLabel(status: OpnameStatus): string {
  if (status === "draft") return "Draf";
  if (status === "approved") return "Disetujui";
  if (status === "rejected") return "Ditolak";
  return "Dibatalkan";
}

export function OpnameCountForm({
  opnameId,
  canMutate,
  canApprove,
}: {
  opnameId: string;
  canMutate: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<OpnameDetail | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await authorizedFetch(`/inventory/opnames/${opnameId}`);
      const data = (await res.json()) as OpnameDetail | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal memuat opname.");
        setSelected(null);
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
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Tidak dapat menghubungi API.");
    } finally {
      setLoading(false);
    }
  }, [opnameId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSaveCounts(e: FormEvent) {
    e.preventDefault();
    if (!selected || !canMutate) return;
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
        return;
      }
      setSelected(data as OpnameDetail);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Tidak dapat menghubungi API.");
    } finally {
      setPending(false);
    }
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
        return;
      }
      router.push("/opname");
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Tidak dapat menghubungi API.");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="flex flex-col gap-4">
        <FormBackLink href="/opname">Daftar opname</FormBackLink>
        <p className="text-sm text-destructive" role="alert">
          {error ?? "Opname tidak ditemukan."}
        </p>
      </div>
    );
  }

  const draft = selected.status === "draft";

  return (
    <form
      onSubmit={(e) => void onSaveCounts(e)}
      className="flex min-h-full flex-col gap-5"
    >
      <FormBackLink href="/opname">Daftar opname</FormBackLink>

      <FormSection
        title={`${statusLabel(selected.status)} · ${selected.lines.length} produk`}
      >
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
                  n != null && Number.isInteger(n)
                    ? n - line.system_qty
                    : line.variance;
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
                          className={`${formInputClass} w-24`}
                          aria-label={`Hitung ${line.name}`}
                        />
                      ) : (
                        (line.counted_qty ?? "—")
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
      </FormSection>

      <FormActions
        error={error}
        pending={pending}
        submitLabel="Simpan hitungan"
        cancelHref="/opname"
        hideSubmit={!draft || !canMutate}
        extra={
          canApprove ? (
            <>
              <Button
                type="button"
                disabled={pending}
                onClick={() => void decide("approve")}
              >
                Setujui
              </Button>
              <Button
                type="button"
                disabled={pending}
                className="bg-secondary text-secondary-foreground hover:opacity-90"
                onClick={() => void decide("reject")}
              >
                Tolak
              </Button>
              {draft ? (
                <Button
                  type="button"
                  disabled={pending}
                  className="bg-secondary text-secondary-foreground hover:opacity-90"
                  onClick={() => void decide("cancel")}
                >
                  Batalkan
                </Button>
              ) : null}
            </>
          ) : draft && canMutate ? (
            <Button
              type="button"
              disabled={pending}
              className="bg-secondary text-secondary-foreground hover:opacity-90"
              onClick={() => void decide("cancel")}
            >
              Batalkan
            </Button>
          ) : null
        }
      />
    </form>
  );
}
