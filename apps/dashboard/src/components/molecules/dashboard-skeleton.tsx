"use client";

import { Skeleton } from "@pos-apps/ui/atoms";
export function DashboardSkeleton() {
  return (
    <div className="flex h-dvh overflow-hidden bg-background" role="status" aria-label="Memuat dasbor">
      <aside className="hidden h-full w-64 shrink-0 flex-col gap-5 border-r border-border bg-card p-4 md:flex">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
      </aside>
      <aside className="flex h-full w-[4.5rem] shrink-0 flex-col items-center gap-4 border-r border-border bg-card p-2 md:hidden">
        <Skeleton className="size-10 rounded-xl" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="size-10 rounded-xl" />
        ))}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="ml-auto hidden h-10 w-72 rounded-xl sm:block" />
          <Skeleton className="size-10 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </header>
        <section className="min-h-0 flex-1 space-y-4 overflow-hidden p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </section>
      </div>
    </div>
  );
}
