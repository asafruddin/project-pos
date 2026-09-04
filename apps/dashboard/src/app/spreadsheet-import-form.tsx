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
import type { SpreadsheetImportResult } from "@pos-apps/types";
import { PRODUCT_IMPORT_MAX_BYTES } from "@pos-apps/types";
import { catalogRequest } from "@/lib/catalog-request";
import { downloadAuthorizedFile } from "@/lib/download-authorized-file";

export function SpreadsheetImportForm({
  canMutate,
  deniedMessage,
  backHref,
  backLabel,
  templatePath,
  uploadPath,
  csvFilename,
  xlsxFilename,
  templateDescription,
  uploadDescription,
  submitLabel,
  updatedHeading,
  noneUpdatedLabel,
  keyColumnLabel,
}: {
  canMutate: boolean;
  deniedMessage: string;
  backHref: string;
  backLabel: string;
  templatePath: string;
  uploadPath: string;
  csvFilename: string;
  xlsxFilename: string;
  templateDescription: string;
  uploadDescription: string;
  submitLabel: string;
  updatedHeading: string;
  noneUpdatedLabel: string;
  keyColumnLabel: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [downloading, setDownloading] = useState<"csv" | "xlsx" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SpreadsheetImportResult | null>(null);

  if (!canMutate) {
    return <FormDenied href={backHref}>{deniedMessage}</FormDenied>;
  }

  async function onDownload(format: "csv" | "xlsx") {
    setError(null);
    setDownloading(format);
    const downloaded = await downloadAuthorizedFile(
      `${templatePath}?format=${format}`,
      format === "xlsx" ? xlsxFilename : csvFilename,
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
    const imported = await catalogRequest<SpreadsheetImportResult>(uploadPath, {
      method: "POST",
      body,
    });
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
        <FormBackLink href={backHref}>{backLabel}</FormBackLink>

        <FormSection title="Unduh template" description={templateDescription}>
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

        <FormSection title="Unggah file" description={uploadDescription}>
          <label
            htmlFor="spreadsheetImportFile"
            className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-secondary/30 px-4 py-6 text-center text-sm text-muted-foreground hover:bg-secondary/50"
          >
            <span className="inline-flex items-center gap-2 font-medium text-foreground">
              <UploadSimpleIcon size={18} />
              Pilih CSV atau Excel
            </span>
            <span className="mt-1 text-xs">.csv atau .xlsx, maksimal 2 MB</span>
            <Input
              id="spreadsheetImportFile"
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
            {result.updated_keys.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-foreground">{updatedHeading}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {result.updated_keys.map((key) => (
                    <li key={key}>
                      <span className="font-medium text-foreground">{key}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{noneUpdatedLabel}</p>
            )}
            {result.errors.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-destructive/30">
                <table className="w-full text-left text-sm">
                  <thead className="bg-destructive/10 text-destructive">
                    <tr>
                      <th className="px-3 py-2 font-medium">Baris</th>
                      <th className="px-3 py-2 font-medium">{keyColumnLabel}</th>
                      <th className="px-3 py-2 font-medium">Pesan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((item) => (
                      <tr
                        key={`${item.row}-${item.key ?? ""}-${item.message}`}
                        className="border-t border-border"
                      >
                        <td className="px-3 py-2">{item.row || "—"}</td>
                        <td className="px-3 py-2">{item.key ?? "—"}</td>
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
        submitLabel={submitLabel}
        cancelHref={backHref}
      />
    </form>
  );
}
