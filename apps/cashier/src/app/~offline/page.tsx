export default function OfflineFallbackPage() {
  return (
    <main className="flex flex-1 flex-col items-start justify-center gap-3 p-8">
      <h1 className="text-2xl font-semibold text-primary">Offline</h1>
      <p className="text-muted-foreground">
        Cashier is offline. Full Offline Mode arrives in later stories.
      </p>
    </main>
  );
}
