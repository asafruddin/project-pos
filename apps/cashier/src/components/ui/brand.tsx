import { CoffeeIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export function BrandMark({
  title = "POS Apps",
  subtitle,
  className,
  size = "md",
}: {
  title?: string;
  subtitle?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const mark =
    size === "lg" ? "h-16 w-16" : size === "sm" ? "h-9 w-9" : "h-12 w-12";
  const iconSize = size === "lg" ? 28 : size === "sm" ? 18 : 22;

  return (
    <div className={cn("flex flex-col items-center gap-2 text-center", className)}>
      <div
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-border bg-secondary text-accent",
          mark,
        )}
        aria-hidden
      >
        <CoffeeIcon size={iconSize} weight="fill" />
      </div>
      <div>
        <p
          className={cn(
            "font-semibold tracking-[0.18em] text-foreground uppercase",
            size === "lg" ? "text-sm" : "text-xs",
          )}
        >
          {title}
        </p>
        {subtitle ? (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

export function SurfaceCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  icon?: React.ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-accent"
        : tone === "danger"
          ? "text-destructive"
          : "text-primary";

  return (
    <SurfaceCard className="flex items-start gap-3 p-4 sm:p-5">
      {icon ? (
        <div
          className={cn(
            "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary",
            toneClass,
          )}
        >
          {icon}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
        {hint ? <div className={cn("mt-1 text-xs", toneClass)}>{hint}</div> : null}
      </div>
    </SurfaceCard>
  );
}
