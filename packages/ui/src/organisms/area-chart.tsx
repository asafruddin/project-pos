"use client";

import { useId, useState } from "react";
import { cn } from "@pos-apps/ui/lib/utils";

export type AreaDatum = {
  /** Short x-axis label, e.g. "09 Nov". */
  label: string;
  value: number;
  /** Tooltip heading; defaults to label. */
  title?: string;
  /** Extra tooltip rows. */
  details?: Array<{ label: string; value: string }>;
};

const W = 100;
const H = 40;

export function AreaChart({
  data,
  formatValue = (v) => String(v),
  formatAxis,
  empty = "Tidak ada data.",
  ariaLabel = "Grafik area",
  className,
}: {
  data: AreaDatum[];
  formatValue?: (value: number) => string;
  /** Compact formatter for y-axis ticks; falls back to formatValue. */
  formatAxis?: (value: number) => string;
  empty?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);
  const n = data.length;
  if (n === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;

  const max = Math.max(0, ...data.map((d) => d.value));
  const top = max <= 0 ? 1 : max;
  const xPct = (i: number) => ((i + 0.5) / n) * 100;
  const yPct = (v: number) => 100 - (v / top) * 100;
  const points = data.map((d, i) => ({
    x: (xPct(i) / 100) * W,
    y: (yPct(d.value) / 100) * H,
  }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const area = `${line} L${points[n - 1].x.toFixed(2)},${H} L${points[0].x.toFixed(2)},${H} Z`;
  const axis = formatAxis ?? formatValue;
  const step = Math.max(1, Math.ceil(n / 8));
  const ticks = [1, 0.5, 0];
  const current = active == null ? null : data[active];

  return (
    <div className={cn("flex gap-3", className)}>
      <div
        className="flex h-64 shrink-0 flex-col justify-between pb-6 text-right text-[11px] tabular-nums text-muted-foreground"
        aria-hidden="true"
      >
        {ticks.map((t) => (
          <span key={t}>{axis(Math.round(top * t))}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="relative h-64 pb-6"
          role="img"
          aria-label={`${ariaLabel}: ${data.map((d) => `${d.label} ${formatValue(d.value)}`).join(", ")}`}
          onMouseLeave={() => setActive(null)}
        >
          <div className="relative h-full">
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute inset-x-0 border-t border-dashed border-border/70"
                style={{ top: `${(1 - t) * 100}%` }}
              />
            ))}
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full overflow-visible"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={area} fill={`url(#${gradientId})`} />
              <path
                d={line}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {active != null ? (
              <>
                <div
                  className="pointer-events-none absolute inset-y-0 w-px bg-border"
                  style={{ left: `${xPct(active)}%` }}
                />
                <div
                  className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary"
                  style={{ left: `${xPct(active)}%`, top: `${yPct(data[active].value)}%` }}
                />
              </>
            ) : null}
            <div className="absolute inset-0 flex">
              {data.map((d, i) => (
                <button
                  key={d.label + i}
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  className="h-full flex-1 cursor-default"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                />
              ))}
            </div>
            {current && active != null ? (
              <div
                className="pointer-events-none absolute z-10 min-w-36 -translate-y-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
                style={{
                  top: "20%",
                  ...(xPct(active) > 60
                    ? { right: `${100 - xPct(active) + 2}%` }
                    : { left: `${xPct(active) + 2}%` }),
                }}
              >
                <p className="font-semibold">{current.title ?? current.label}</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-primary">
                  {formatValue(current.value)}
                </p>
                {current.details?.map((row) => (
                  <p key={row.label} className="mt-0.5 flex justify-between gap-4 text-muted-foreground">
                    <span>{row.label}</span>
                    <span className="tabular-nums text-foreground">{row.value}</span>
                  </p>
                ))}
              </div>
            ) : null}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex" aria-hidden="true">
            {data.map((d, i) => (
              <span
                key={d.label + i}
                className="min-w-0 flex-1 truncate text-center text-[11px] text-muted-foreground"
              >
                {i % step === 0 || i === n - 1 ? d.label : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
