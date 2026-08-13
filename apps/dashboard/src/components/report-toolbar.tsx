"use client";

import { FormEvent, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FormField, formInputClass } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  downloadCsv,
  downloadPdf,
  downloadXls,
  type ExportTable,
} from "@/lib/export-table";

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function reportQs(from: string, to: string): string {
  return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

export function ReportToolbar({
  from,
  to,
  pending,
  onApply,
  table,
  extra,
}: {
  from: string;
  to: string;
  pending?: boolean;
  onApply: (range: { from: string; to: string }) => void;
  table: ExportTable | null;
  extra?: ReactNode;
}) {
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);

  function submit(e: FormEvent) {
    e.preventDefault();
    onApply({ from: start, to: end });
  }

  return (
    <form
      className="flex flex-col gap-3 lg:flex-row lg:items-end"
      onSubmit={submit}
    >
      <div className="min-w-0 flex-1">
        <FormField id="report-from" label="Dari (UTC)">
          <Input
            id="report-from"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={formInputClass}
          />
        </FormField>
      </div>
      <div className="min-w-0 flex-1">
        <FormField id="report-to" label="Sampai (UTC)">
          <Input
            id="report-to"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={formInputClass}
          />
        </FormField>
      </div>
      <Button type="submit" disabled={pending}>
        Terapkan
      </Button>
      {table ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="bg-secondary text-secondary-foreground hover:opacity-90"
            onClick={() => downloadCsv(table)}
          >
            CSV
          </Button>
          <Button
            type="button"
            className="bg-secondary text-secondary-foreground hover:opacity-90"
            onClick={() => downloadXls(table)}
          >
            Excel
          </Button>
          <Button
            type="button"
            className="bg-secondary text-secondary-foreground hover:opacity-90"
            onClick={() => downloadPdf(table)}
          >
            PDF
          </Button>
        </div>
      ) : null}
      {extra}
    </form>
  );
}
