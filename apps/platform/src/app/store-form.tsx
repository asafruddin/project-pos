"use client";

import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import {
  FormActions,
  FormBackLink,
  FormSection,
  FormBody,
  formPageClassName,
} from "@pos-apps/ui/organisms";
import { Input } from "@pos-apps/ui/atoms";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorBody } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

function errorMessage(res: Response, body: unknown): string {
  const err = body as ApiErrorBody;
  return err?.message ?? `Gagal (${res.status})`;
}

export function StoreForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [ownerUsername, setOwnerUsername] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [cashierUsername, setCashierUsername] = useState("");
  const [cashierPassword, setCashierPassword] = useState("");

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (ownerPassword.length < 8) {
      setError("Password owner minimal 8 karakter.");
      return;
    }
    if (cashierUsername.trim() && cashierPassword.length < 8) {
      setError("Password kasir minimal 8 karakter.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch("/platform/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          owner: { username: ownerUsername, password: ownerPassword },
          ...(cashierUsername.trim()
            ? {
                cashier: {
                  username: cashierUsername,
                  password: cashierPassword,
                },
              }
            : {}),
        }),
      });
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      router.push("/stores");
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal membuat toko.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={formPageClassName} onSubmit={(e) => void onSave(e)}>
      <FormBackLink href="/stores">Daftar toko</FormBackLink>
      <FormBody>
        {error ? (
          <div
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        ) : null}
        <FormSection title="Toko baru">
          <p className="text-sm text-muted-foreground">
            Toko ini terpisah dari toko lain. Username tidak boleh sama dengan
            akun yang sudah ada (mis. owner / cashier Store #1).
          </p>
          <FormField id="store-name" label="Nama toko" required>
            <Input
              id="store-name"
              className={formInputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </FormField>
        </FormSection>
        <FormSection title="Owner">
          <FormField id="owner-username" label="Username" required>
            <Input
              id="owner-username"
              className={formInputClass}
              value={ownerUsername}
              autoComplete="off"
              onChange={(e) => setOwnerUsername(e.target.value)}
              required
            />
          </FormField>
          <FormField id="owner-password" label="Password" required>
            <Input
              id="owner-password"
              type="password"
              className={formInputClass}
              value={ownerPassword}
              autoComplete="new-password"
              onChange={(e) => setOwnerPassword(e.target.value)}
              required
            />
          </FormField>
        </FormSection>
        <FormSection title="Kasir (opsional)">
          <FormField id="cashier-username" label="Username">
            <Input
              id="cashier-username"
              className={formInputClass}
              value={cashierUsername}
              autoComplete="off"
              onChange={(e) => setCashierUsername(e.target.value)}
            />
          </FormField>
          <FormField id="cashier-password" label="Password">
            <Input
              id="cashier-password"
              type="password"
              className={formInputClass}
              value={cashierPassword}
              autoComplete="new-password"
              onChange={(e) => setCashierPassword(e.target.value)}
            />
          </FormField>
        </FormSection>
      </FormBody>
      <FormActions
        error={error}
        pending={pending}
        submitLabel="Buat toko"
        cancelHref="/stores"
      />
    </form>
  );
}
