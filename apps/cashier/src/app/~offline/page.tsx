import { AuthSplitShell } from "@pos-apps/ui/organisms";
export default function OfflineFallbackPage() {
  return (
    <AuthSplitShell
      brandTitle="POS Apps"
      brandSubtitle="Cashier"
      heading="Offline"
      description="Cashier is offline. Full Offline Mode arrives in later stories."
      quoteBy="Cashier"
    >
      <p className="text-center text-sm text-muted-foreground">
        Check your connection, then reopen the app to continue.
      </p>
    </AuthSplitShell>
  );
}
