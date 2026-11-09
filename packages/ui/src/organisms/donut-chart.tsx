import type { ReactNode } from "react";
import { cn } from "@pos-apps/ui/lib/utils";

export type DonutSlice = {
  label: string;
  value: number;
  /** CSS color, e.g. "var(--primary)". */
  color: string;
  hint?: string;
};

export function DonutChart({
  data,
  center,
  empty = "Tidak ada data.",
  className,
}: {
  data: DonutSlice[];
  /** Content rendered in the hole (e.g. total). */
  center?: ReactNode;
  empty?: string;
  className?: string;
}) {
  const total = data.reduce((sum, d) => sum + Math.max(0, d.value), 0);
  if (total <= 0) return <p className="text-sm text-muted-foreground">{empty}</p>;

  // Circumference of r=15.9155 is 100, so dash lengths are percentages.
  const gap = data.filter((d) => d.value > 0).length > 1 ? 1.2 : 0;
  let offset = 0;
  return (
    <div className={cn("flex flex-col items-center gap-6 sm:flex-row sm:gap-8", className)}>
      <div className="relative size-44 shrink-0">
        <svg viewBox="0 0 36 36" className="size-full -rotate-90" role="img" aria-label="Diagram donat">
          <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--secondary)" strokeWidth="4" />
          {data.map((d) => {
            const pct = (Math.max(0, d.value) / total) * 100;
            if (pct <= 0) return null;
            const el = (
              <circle
                key={d.label}
                cx="18"
                cy="18"
                r="15.9155"
                fill="none"
                stroke={d.color}
                strokeWidth="4"
                strokeDasharray={`${Math.max(0, pct - gap)} ${100 - Math.max(0, pct - gap)}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += pct;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {center}
        </div>
      </div>
      <ul className="flex w-full min-w-0 flex-1 flex-col gap-3">
        {data.map((d) => (
          <li key={d.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="truncate font-medium">{d.label}</span>
            </span>
            <span className="shrink-0 text-right tabular-nums">
              <span className="text-muted-foreground">{d.hint ?? d.value}</span>{" "}
              <span className="font-semibold">{Math.round((Math.max(0, d.value) / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
