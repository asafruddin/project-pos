"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { SpreadsheetImportForm } from "../../spreadsheet-import-form";

export default function CustomerImportPage() {
  const me = useDashboardSession();
  return (
    <SpreadsheetImportForm
      canMutate={hasPermission(me.permissions, "customers", "update")}
      deniedMessage="Anda tidak memiliki izin untuk mengimpor pelanggan."
      backHref="/customers"
      backLabel="Daftar pelanggan"
      templatePath="/customers/import/template"
      uploadPath="/customers/import"
      csvFilename="pelanggan-impor-template.csv"
      xlsxFilename="pelanggan-impor-template.xlsx"
      templateDescription="Kolom: name, phone, email, notes, group_name, store_credit_minor. Wajib nama plus telepon atau email."
      uploadDescription="Telepon yang sudah ada akan diperbarui (jika kosong, email). Maksimal 1.000 baris."
      submitLabel="Impor pelanggan"
      updatedHeading="Telepon/email yang diperbarui"
      noneUpdatedLabel="Tidak ada pelanggan yang diperbarui."
      keyColumnLabel="Kunci"
    />
  );
}
