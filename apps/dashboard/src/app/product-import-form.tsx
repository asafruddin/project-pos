"use client";

import { Button, Input } from "@pos-apps/ui/atoms";
import {
  FormActions,
  FormBackLink,
  FormBody,
  FormDenied,
  FormSection,
  formPageClassName,
} from "@pos-apps/ui/organisms";
import { DownloadSimpleIcon, UploadSimpleIcon } from "@phosphor-icons/react";
import { FormEvent, useState } from "react";
import type { ProductImportResult } from "@pos-apps/types";
import { PRODUCT_IMPORT_MAX_BYTES } from "@pos-apps/types";
import { catalogRequest } from "@/lib/catalog-request";
import { downloadAuthorizedFile } from "@/lib/download-authorized-file";

export function ProductImportForm({ canMutate }: { canMutate: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [downloading, setDownloading] = useState<"csv" | "xlsx" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProductImportResult | null>(null);

  if (!canMutate) {
    return (
      <FormDenied href="/products">
        Anda tidak memiliki izin untuk mengimpor produk.
      </FormDenied>
    );
  }

  async function onDownload(format: "csv" | "xlsx") {
    setError(null);
    setDownloading(format);
    const downloaded = await downloadAuthorizedFile(
      `/catalog/products/import/template?format=${format}`,
      format === "xlsx" ? "produk-impor-template.xlsx" : "produk-impor-template.csv",
    );
    setDownloading(null);
    if (!downloaded.ok) setError(downloaded.message);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!file) {
      setError("Pilih file CSV atau Excel (.xlsx).");
      return;
    }
    if (file.size > PRODUCT_IMPORT_MAX_BYTES) {
      setError("Ukuran file maksimal 2 MB.");
      return;
    }
    setPending(true);
    const body = new FormData();
    body.append("file", file);
    const imported = await catalogRequest<ProductImportResult>(
      "/catalog/products/import",
      { method: "POST", body },
    );
    setPending(false);
    if (!imported.ok) {
      setError(imported.message);
      return;
    }
    setResult(imported.data);
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className={formPageClassName}>
      <FormBody>
        <FormBackLink href="/products">Daftar produk</FormBackLink>

        <FormSection
          title="Unduh template"
          description="Kolom mengikuti database (name, price_minor, stock_qty, sku, …). Harga dalam Rupiah penuh, contoh 18000."
        >
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={pending || downloading !== null}
              onClick={() => void onDownload("csv")}
            >
              <DownloadSimpleIcon size={18} />
              {downloading === "csv" ? "Mengunduh…" : "Unduh template CSV"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending || downloading !== null}
              onClick={() => void onDownload("xlsx")}
            >
              <DownloadSimpleIcon size={18} />
              {downloading === "xlsx" ? "Mengunduh…" : "Unduh template Excel"}
            </Button>
          </div>
        </FormSection>

        <FormSection
          title="Unggah file"
          description="SKU yang sudah ada akan diperbarui. SKU baru atau kosong membuat produk baru. Maksimal 1.000 baris."
        >
          <label
            htmlFor="productImportFile"
            className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-secondary/30 px-4 py-6 text-center text-sm text-muted-foreground hover:bg-secondary/50"
          >
            <span className="inline-flex items-center gap-2 font-medium text-foreground">
              <UploadSimpleIcon size={18} />
              Pilih CSV atau Excel
            </span>
            <span className="mt-1 text-xs">.csv atau .xlsx, maksimal 2 MB</span>
            <Input
              id="productImportFile"
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={pending}
              className="sr-only"
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                setFile(next);
                setResult(null);
              }}
            />
          </label>
          {file ? (
            <p className="text-sm text-foreground">
              File dipilih: <span className="font-medium">{file.name}</span>
            </p>
          ) : null}
        </FormSection>

        {result ? (
          <FormSection
            title="Hasil impor"
            description={`${result.created} dibuat, ${result.updated} diperbarui, ${result.errors.length} gagal.`}
          >
            {result.updated_skus.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-foreground">SKU yang diperbarui</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {result.updated_skus.map((sku) => (
                    <li key={sku}>
                      <span className="font-medium text-foreground">{sku}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Tidak ada SKU yang diperbarui.</p>
            )}
            {result.errors.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-destructive/30">
                <table className="w-full text-left text-sm">
                  <thead className="bg-destructive/10 text-destructive">
                    <tr>
                      <th className="px-3 py-2 font-medium">Baris</th>
                      <th className="px-3 py-2 font-medium">SKU</th>
                      <th className="px-3 py-2 font-medium">Pesan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((item) => (
                      <tr
                        key={`${item.row}-${item.sku ?? ""}-${item.message}`}
                        className="border-t border-border"
                      >
                        <td className="px-3 py-2">{item.row || "—"}</td>
                        <td className="px-3 py-2">{item.sku ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{item.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </FormSection>
        ) : null}
      </FormBody>
      <FormActions
        error={error}
        pending={pending}
        submitLabel="Impor produk"
        cancelHref="/products"
      />
    </form>
  );
}
