"use client";

import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import {
  FormActions,
  FormBackLink,
  FormDenied,
  FormSection,
  FormBody,
  formPageClassName,
} from "@pos-apps/ui/organisms";
import { Button, Input, Skeleton } from "@pos-apps/ui/atoms";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorBody, QueueResetMode, StoreRecord } from "@pos-apps/types";
import { storeLogoFilePath } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";
import { useAuthorizedImage } from "@/lib/use-authorized-image";

const QUEUE_MODES: Array<{ value: QueueResetMode; label: string; hint: string }> = [
  { value: "daily", label: "Harian", hint: "Mulai dari 1 setiap hari baru." },
  { value: "shift", label: "Per shift", hint: "Mulai dari 1 setiap shift dibuka." },
  { value: "manual", label: "Manual", hint: "Lanjut terus sampai Anda menekan Reset sekarang." },
];

function errorMessage(res: Response, body: unknown): string {
  return (body as ApiErrorBody)?.message ?? `Gagal (${res.status})`;
}

export function StoreEditForm({
  canEdit,
  storeId,
}: {
  canEdit: boolean;
  storeId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [hasLogo, setHasLogo] = useState(false);
  const [queueMode, setQueueMode] = useState<QueueResetMode>("daily");
  const [queueResetAt, setQueueResetAt] = useState<string | null>(null);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [managerPin, setManagerPin] = useState("");
  const [managerPinCustom, setManagerPinCustom] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [logoNonce, setLogoNonce] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);

  const remoteLogo = useAuthorizedImage(
    hasLogo ? `${storeLogoFilePath(storeId)}?v=${logoNonce}` : null,
  );
  const logoSrc = preview ?? remoteLogo;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authorizedFetch(`/stores/${storeId}`);
      const data = (await res.json()) as StoreRecord | ApiErrorBody;
      if (!res.ok) {
        if (res.status === 404) {
          setMissing(true);
          return;
        }
        setError(errorMessage(res, data));
        return;
      }
      const store = data as StoreRecord;
      setName(store.name);
      setHasLogo(Boolean(store.logo_public_id || store.logo_secure_url));
      setQueueMode(store.queue_reset_mode ?? "daily");
      setQueueResetAt(store.queue_reset_at ?? null);
      setManagerPinCustom(Boolean(store.manager_pin_custom));
      setMissing(false);
      setError(null);
    } catch {
      setError("Gagal memuat toko.");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onUpload(file: File) {
    if (!canEdit || pending) return;
    setPending(true);
    setError(null);
    const nextPreview = URL.createObjectURL(file);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextPreview;
    });
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await authorizedFetch(`/stores/${storeId}/logo`, {
        method: "POST",
        body,
      });
      if (!res.ok) {
        setPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      setHasLogo(true);
      setLogoNonce((n) => n + 1);
    } catch {
      setError("Gagal mengunggah gambar toko.");
    } finally {
      setPending(false);
    }
  }

  async function onResetQueue() {
    if (!canEdit || pending) return;
    if (!window.confirm("Reset antrian sekarang? Nomor berikutnya di semua perangkat mulai dari 1.")) {
      return;
    }
    setPending(true);
    setError(null);
    setQueueMessage(null);
    try {
      const res = await authorizedFetch(`/stores/${storeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queue_reset_now: true }),
      });
      const data = (await res.json().catch(() => ({}))) as StoreRecord | ApiErrorBody;
      if (!res.ok) {
        setError(errorMessage(res, data));
        return;
      }
      setQueueResetAt((data as StoreRecord).queue_reset_at ?? null);
      setQueueMessage("Antrian direset. Perangkat menerima ini saat tersambung berikutnya.");
    } finally {
      setPending(false);
    }
  }

  async function onResetManagerPin() {
    if (!canEdit || pending) return;
    if (!window.confirm("Kembalikan PIN manajer ke default (000000)?")) return;
    setPending(true);
    setError(null);
    setPinMessage(null);
    try {
      const res = await authorizedFetch(`/stores/${storeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manager_pin_reset: true }),
      });
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      setManagerPin("");
      setManagerPinCustom(false);
      setPinMessage("PIN manajer kembali ke default (000000). Perangkat menerima ini saat tersambung berikutnya.");
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || pending) return;
    if (managerPin !== "" && !/^\d{6}$/.test(managerPin)) {
      setError("PIN manajer harus 6 digit angka.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(`/stores/${storeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          queue_reset_mode: queueMode,
          ...(managerPin !== "" ? { manager_pin: managerPin } : {}),
        }),
      });
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      router.push("/stores");
    } finally {
      setPending(false);
    }
  }

  if (!canEdit) {
    return (
      <FormDenied href="/stores">
        Anda tidak memiliki izin untuk mengubah toko.
      </FormDenied>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (missing) {
    return (
      <FormDenied href="/stores">Toko tidak ditemukan.</FormDenied>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className={formPageClassName}>
      <FormBody>
        <FormBackLink href="/stores">Daftar toko</FormBackLink>
        <FormSection
          title="Identitas toko"
          description="Nama dan gambar tampil di dashboard dan kasir setelah masuk."
        >
          <FormField id="store-name" label="Nama toko" required>
            <Input
              id="store-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
              className={formInputClass}
            />
          </FormField>
        </FormSection>
        <FormSection
          title="Antrian"
          description="Nomor antrian tampil di struk dan daftar transaksi. Dihitung per perangkat kasir dan selalu mulai dari 1 saat shift baru dibuka."
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {QUEUE_MODES.map((mode) => (
              <Button
                key={mode.value}
                type="button"
                variant={queueMode === mode.value ? "default" : "secondary"}
                disabled={pending}
                onClick={() => setQueueMode(mode.value)}
              >
                {mode.label}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {QUEUE_MODES.find((m) => m.value === queueMode)?.hint} Simpan untuk menerapkan pilihan ini.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" disabled={pending} onClick={() => void onResetQueue()}>
              Reset sekarang
            </Button>
            <span className="text-xs text-muted-foreground">
              {queueResetAt
                ? `Terakhir direset ${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(queueResetAt))}`
                : "Belum pernah direset manual."}
            </span>
          </div>
          {queueMessage ? (
            <p className="text-sm text-muted-foreground" role="status">
              {queueMessage}
            </p>
          ) : null}
        </FormSection>
        <FormSection
          title="PIN manajer"
          description="Dimasukkan di kasir untuk membatalkan (void) transaksi. Default 000000. Simpan untuk menerapkan PIN baru."
        >
          <FormField id="manager-pin" label="PIN manajer baru">
            <Input
              id="manager-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              placeholder="6 digit angka"
              value={managerPin}
              onChange={(e) => setManagerPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={pending}
              className={formInputClass}
            />
          </FormField>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={pending || !managerPinCustom}
              onClick={() => void onResetManagerPin()}
            >
              Kembalikan ke default
            </Button>
            <span className="text-xs text-muted-foreground">
              {managerPinCustom
                ? "PIN kustom aktif. Kosongkan kolom di atas untuk tidak mengubahnya."
                : "Memakai PIN default (000000). Sebaiknya ganti."}
            </span>
          </div>
          {pinMessage ? (
            <p className="text-sm text-muted-foreground" role="status">
              {pinMessage}
            </p>
          ) : null}
        </FormSection>
        <FormSection
          title="Gambar"
          description="JPEG, PNG, WebP, atau GIF. Maksimal 8 MB."
        >
          <label
            htmlFor="storeLogo"
            className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-secondary/30 px-4 py-6 text-center text-sm text-muted-foreground hover:bg-secondary/50"
          >
            <span className="font-medium text-foreground">Unggah gambar</span>
            <span className="mt-1 text-xs">JPEG, PNG, WebP, atau GIF</span>
            <Input
              id="storeLogo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={pending}
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void onUpload(file);
              }}
            />
          </label>
          {logoSrc ? (
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt="Gambar toko"
                className="size-16 rounded-md object-cover"
              />
              <p className="text-sm text-muted-foreground">
                Gambar ini tampil di akun yang terhubung ke toko ini.
              </p>
            </div>
          ) : null}
        </FormSection>
      </FormBody>
      <FormActions error={error} pending={pending} cancelHref="/stores" />
    </form>
  );
}
