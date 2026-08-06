export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-start justify-center gap-4 p-8">
      <p className="text-sm font-medium text-accent">Cashier</p>
      <h1 className="text-3xl font-semibold tracking-tight text-primary">
        POS Apps
      </h1>
      <p className="max-w-md text-muted-foreground">
        Scaffold ready. Instant Checkout and Offline Mode land in later stories.
      </p>
      <button
        type="button"
        disabled
        className="inline-flex h-12 min-h-12 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        Primary action (placeholder)
      </button>
    </main>
  );
}
