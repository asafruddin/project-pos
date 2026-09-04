"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { SpreadsheetImportForm } from "../../../spreadsheet-import-form";

export default function SupplierImportPage() {
  const me = useDashboardSession();
  return (
    <SpreadsheetImportForm
      canMutate={hasPermission(me.permissions, "purchases", "update")}
      deniedMessage="Anda tidak memiliki izin untuk mengimpor pemasok."
      backHref="/purchasing"
      backLabel="Daftar pembelian"
      templatePath="/purchasing/suppliers/import/template"
      uploadPath="/purchasing/suppliers/import"
      csvFilename="pemasok-impor-template.csv"
      xlsxFilename="pemasok-impor-template.xlsx"
      templateDescription="Kolom: name, contact_name, phone, email, payment_terms, notes. Nama wajib."
      uploadDescription="Nama pemasok yang sudah ada akan diperbarui. Maksimal 1.000 baris."
      submitLabel="Impor pemasok"
      updatedHeading="Nama yang diperbarui"
      noneUpdatedLabel="Tidak ada pemasok yang diperbarui."
      keyColumnLabel="Nama"
    />
  );
}
