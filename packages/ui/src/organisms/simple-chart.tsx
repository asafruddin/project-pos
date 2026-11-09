import { cn } from "@pos-apps/ui/lib/utils";

export type BarDatum = {
  label: string;
  value: number;
  hint?: string;
};

export function HBarChart({
  data,
  empty = "Tidak ada data.",
}: {
  data: BarDatum[];
  empty?: string;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="flex flex-col gap-4" aria-label="Diagram batang horizontal">
      {data.map((row) => {
        const pct = max <= 0 ? 0 : Math.min(100, Math.round((row.value / max) * 100));
        return (
          <li key={row.label} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{row.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {row.hint ?? row.value}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
              <div
                className="h-2.5 rounded-full bg-primary transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function VBarChart({
  data,
  empty = "Tidak ada data.",
}: {
  data: BarDatum[];
  empty?: string;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="flex h-60 items-end gap-2 border-b border-border/70 pt-4 sm:gap-3" role="img" aria-label="Diagram batang vertikal">
      {data.map((row) => {
        const pct = max <= 0 ? 10 : Math.max(10, Math.round((row.value / max) * 100));
        return (
          <div key={row.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <p className="w-full truncate text-center text-[11px] tabular-nums text-muted-foreground" title={row.hint ?? row.label}>
              {row.hint ?? row.value}
            </p>
            <div
              className={cn("w-full max-w-14 rounded-t-xl bg-primary transition-[height] duration-500")}
              style={{ height: `${pct}%` }}
              title={row.label}
            />
            <p className="w-full truncate text-center text-xs font-medium">{row.label}</p>
          </div>
        );
      })}
    </div>
  );
}
