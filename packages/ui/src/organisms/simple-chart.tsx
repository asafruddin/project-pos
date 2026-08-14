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
    <ul className="flex flex-col gap-3">
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
            <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
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
    <div className="flex h-52 items-end gap-3">
      {data.map((row) => {
        const pct = max <= 0 ? 10 : Math.max(10, Math.round((row.value / max) * 100));
        return (
          <div key={row.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <p className="text-xs tabular-nums text-muted-foreground">
              {row.hint ?? row.value}
            </p>
            <div
              className={cn("w-full max-w-12 rounded-t-xl bg-primary")}
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
