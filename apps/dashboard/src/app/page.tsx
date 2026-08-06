import type { PlaceholderId } from "@pos-apps/types";

const scaffoldId: PlaceholderId = "dashboard-scaffold";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-start justify-center gap-4 p-8">
      <p className="text-sm font-medium text-accent">Dashboard</p>
      <span className="sr-only">{scaffoldId}</span>
      <h1 className="text-3xl font-semibold tracking-tight text-primary">
        POS Apps
      </h1>
      <p className="max-w-md text-muted-foreground">
        Online-only dashboard scaffold. Catalog and day-close screens come later.
      </p>
      <button
        type="button"
        className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Primary action (placeholder)
      </button>
    </main>
  );
}
