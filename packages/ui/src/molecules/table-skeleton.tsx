import { Skeleton } from "@pos-apps/ui/atoms/skeleton";
import { Card } from "./card";

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card
      className="gap-0 overflow-hidden py-0 shadow-[var(--shadow-card)]"
      role="status"
      aria-label="Memuat data"
    >
      <div className="flex gap-4 border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="ml-auto h-4 w-16" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-border/60 px-4 py-3 last:border-0"
        >
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </Card>
  );
}
