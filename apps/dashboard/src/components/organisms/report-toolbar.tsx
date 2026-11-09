"use client";

import { Button } from "@pos-apps/ui/atoms";
import {
  DateRangePicker,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@pos-apps/ui/molecules";
import {
  CaretDownIcon,
  DownloadSimpleIcon,
  FilePdfIcon,
  FileCsvIcon,
  FileXlsIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import {
  downloadCsv,
  downloadPdf,
  downloadXls,
  type ExportTable,
} from "@/lib/export-table";
import { cn } from "@/lib/utils";

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function reportQs(from: string, to: string): string {
  return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

export function shiftUtc(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthStartUtc(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

const PRESETS: Array<{ label: string; range: () => { from: string; to: string } }> = [
  { label: "Hari ini", range: () => ({ from: todayUtc(), to: todayUtc() }) },
  { label: "7 hari", range: () => ({ from: shiftUtc(-6), to: todayUtc() }) },
  { label: "30 hari", range: () => ({ from: shiftUtc(-29), to: todayUtc() }) },
  { label: "Bulan ini", range: () => ({ from: monthStartUtc(), to: todayUtc() }) },
];

export function DateRangeFilter({
  from,
  to,
  pending,
  onApply,
  className,
}: {
  from: string;
  to: string;
  pending?: boolean;
  onApply: (range: { from: string; to: string }) => void;
  className?: string;
}) {
  // While the user is mid-selection (first click), show the draft; otherwise the applied range.
  const [draft, setDraft] = useState<{ from: string; to: string } | null>(null);
  const shown = draft ?? { from, to };

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}>
      <div className="w-full sm:w-64">
        <DateRangePicker
          id="report-range"
          from={shown.from}
          to={shown.to}
          disabled={pending}
          placeholder="Pilih rentang tanggal"
          onChange={setDraft}
          onRangeComplete={(range) => {
            setDraft(null);
            if (range.from !== from || range.to !== to) onApply(range);
          }}
        />
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Rentang cepat">
        {PRESETS.map((preset) => {
          const r = preset.range();
          const active = r.from === from && r.to === to;
          return (
            <Button
              key={preset.label}
              type="button"
              size="sm"
              variant={active ? "secondary" : "ghost"}
              disabled={pending}
              aria-pressed={active}
              className={cn(!active && "text-muted-foreground")}
              onClick={() => {
                setDraft(null);
                onApply(r);
              }}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export type ExportMenuExtra = {
  label: string;
  description?: string;
  onSelect: () => void;
};

export function ExportMenu({
  table,
  extras,
}: {
  table: ExportTable | null;
  extras?: ExportMenuExtra[];
}) {
  const disabled = !table && !(extras && extras.length > 0);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled}>
          <DownloadSimpleIcon aria-hidden />
          Ekspor
          <CaretDownIcon aria-hidden className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {table ? (
          <>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Unduh tampilan ini
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => downloadCsv(table)}>
              <FileCsvIcon aria-hidden />
              <span>CSV</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => downloadXls(table)}>
              <FileXlsIcon aria-hidden />
              <span>Excel</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => downloadPdf(table)}>
              <FilePdfIcon aria-hidden />
              <span>PDF</span>
            </DropdownMenuItem>
          </>
        ) : null}
        {table && extras && extras.length > 0 ? <DropdownMenuSeparator /> : null}
        {extras && extras.length > 0 ? (
          <>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Data mentah
            </DropdownMenuLabel>
            {extras.map((item) => (
              <DropdownMenuItem
                key={item.label}
                className="items-start"
                onSelect={item.onSelect}
              >
                <FileCsvIcon aria-hidden className="mt-0.5" />
                <span className="flex flex-col">
                  <span>{item.label}</span>
                  {item.description ? (
                    <span className="text-xs text-muted-foreground">{item.description}</span>
                  ) : null}
                </span>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ReportToolbar({
  from,
  to,
  pending,
  onApply,
  table,
  exportExtras,
}: {
  from: string;
  to: string;
  pending?: boolean;
  onApply: (range: { from: string; to: string }) => void;
  table: ExportTable | null;
  exportExtras?: ExportMenuExtra[];
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)] sm:p-4 lg:flex-row lg:items-center">
      <DateRangeFilter from={from} to={to} pending={pending} onApply={onApply} />
      <div className="flex items-center gap-2 lg:ml-auto">
        {pending ? (
          <span className="text-xs text-muted-foreground" role="status">
            Memuat…
          </span>
        ) : null}
        <ExportMenu table={table} extras={exportExtras} />
      </div>
    </div>
  );
}
