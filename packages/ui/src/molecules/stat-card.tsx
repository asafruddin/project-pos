import type { ReactNode } from "react";
import { cn } from "@pos-apps/ui/lib/utils";
import { Card } from "./card";

export function SurfaceCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card
      className={cn("gap-0 py-0 shadow-[var(--shadow-card)]", className)}
    >
      {children}
    </Card>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  icon?: ReactNode;
  className?: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-destructive"
          : "text-primary";

  const iconWell =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
        ? "bg-warning/15 text-warning"
        : tone === "danger"
          ? "bg-destructive/10 text-destructive"
          : "bg-primary/10 text-primary";

  return (
    <SurfaceCard className={cn("p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon ? (
          <div
            className={cn(
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              iconWell,
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
      <p className="mt-4 text-[clamp(1.5rem,2.5vw,2rem)] font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      {hint ? <div className={cn("mt-2 text-xs", toneClass)}>{hint}</div> : null}
    </SurfaceCard>
  );
}
