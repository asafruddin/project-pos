"use client";

import { Button } from "@pos-apps/ui/atoms";
import { DateRangePicker, FormField } from "@pos-apps/ui/molecules";
import { FormEvent, useEffect, useState, type ReactNode } from "react";
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

  useEffect(() => {
    setStart(from);
    setEnd(to);
  }, [from, to]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!start || !end) return;
    onApply({ from: start, to: end });
  }

  return (
    <form
      className="flex flex-col gap-3 lg:flex-row lg:items-end"
      onSubmit={submit}
    >
      <div className="min-w-0 flex-1 sm:max-w-sm">
        <FormField id="report-range" label="Rentang tanggal (UTC)">
          <DateRangePicker
            id="report-range"
            from={start}
            to={end}
            disabled={pending}
            placeholder="Pilih rentang tanggal"
            onChange={({ from: nextFrom, to: nextTo }) => {
              setStart(nextFrom);
              setEnd(nextTo);
            }}
          />
        </FormField>
      </div>
      <Button type="submit" disabled={pending || !start || !end}>
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
