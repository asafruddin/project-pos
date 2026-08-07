"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthMeResponse } from "@pos-apps/types";
import { Button } from "@/components/ui/button";
import { clearSession, getAccessToken, getSession } from "@/lib/auth-token";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function HomePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    void (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          clearSession();
          router.replace("/login");
          return;
        }
        const data = (await res.json()) as AuthMeResponse;
        setMe(data);
        setReady(true);
      } catch {
        setError("Tidak dapat memverifikasi sesi.");
        setReady(true);
      }
    })();
  }, [router]);

  function logout() {
    clearSession();
    router.replace("/login");
  }

  if (!ready) {
    return (
      <main className="flex flex-1 items-center p-8 text-muted-foreground">
        Memuat…
      </main>
    );
  }

  const session = getSession();

  return (
    <main className="flex flex-1 flex-col items-start justify-center gap-4 p-8">
      <p className="text-sm font-medium text-accent">Dashboard</p>
      <h1 className="text-3xl font-semibold tracking-tight text-primary">
        POS Apps
      </h1>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <p className="max-w-md text-muted-foreground">
          Anda masuk sebagai{" "}
          <span className="font-medium text-foreground">
            {me?.role ?? session?.role}
          </span>
          . Katalog produk datang di story berikutnya.
        </p>
      )}
      <Button type="button" onClick={logout}>
        Keluar
      </Button>
    </main>
  );
}
