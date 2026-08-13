"use client";

import { cn } from "@/lib/utils";

export function Skeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      aria-hidden
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex h-dvh overflow-hidden bg-background" role="status" aria-label="Memuat dasbor">
      <div className="mx-auto flex h-full w-full max-w-[90rem] gap-3 p-3 sm:gap-4 sm:p-4 lg:gap-5 lg:p-6">
        <aside className="hidden h-full w-64 shrink-0 flex-col gap-5 rounded-lg border border-border bg-card p-5 shadow-sm md:flex">
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </aside>
        <aside className="flex h-full w-[4.5rem] shrink-0 flex-col items-center gap-4 rounded-lg border border-border bg-card p-3 shadow-sm md:hidden">
          <Skeleton className="size-11 rounded-full" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="size-10" />
          ))}
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
          <header className="shrink-0 space-y-3 rounded-lg border border-border bg-card px-4 py-4 shadow-sm sm:px-5">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </header>
          <section className="min-h-0 flex-1 space-y-4 overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-10 w-36" />
            </div>
            <div className="overflow-hidden rounded-md border border-border">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-border/60 px-4 py-3 last:border-0"
                >
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-md border border-border" role="status" aria-label="Memuat data">
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
    </div>
  );
}
