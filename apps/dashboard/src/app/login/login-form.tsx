"use client";

import { useRouter } from "next/navigation";
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { FormEvent, useId, useState } from "react";
import type { ApiErrorBody, LoginResponse } from "@pos-apps/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSession } from "@/lib/auth-token";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function LoginForm() {
  const router = useRouter();
  const errorId = useId();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = (await res.json()) as LoginResponse | ApiErrorBody;
      if (!res.ok) {
        const err = data as ApiErrorBody;
        setError(err.message ?? "Gagal masuk. Coba lagi.");
        return;
      }
      const ok = data as LoginResponse;
      if (
        typeof ok.access_token !== "string" ||
        !ok.access_token ||
        typeof ok.user_id !== "string" ||
        !ok.user_id ||
        (ok.role !== "cashier" && ok.role !== "catalog_admin")
      ) {
        setError("Respons login tidak valid. Coba lagi.");
        return;
      }
      saveSession({
        accessToken: ok.access_token,
        role: ok.role,
        userId: ok.user_id,
      });
      router.replace("/");
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi API. Pastikan server berjalan.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full flex-col gap-5"
      aria-describedby={error ? errorId : undefined}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="login">Username</Label>
        <Input
          id="login"
          name="login"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="next"
          placeholder="contoh: admin"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          required
          autoFocus
          disabled={pending}
          className="h-12 min-h-12 text-base sm:text-sm"
          aria-invalid={error ? true : undefined}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            enterKeyHint="go"
            placeholder="Masukkan password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={pending}
            className="h-12 min-h-12 pr-12 text-base sm:text-sm"
            aria-invalid={error ? true : undefined}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-1 my-1 inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            onClick={() => setShowPassword((v) => !v)}
            disabled={pending}
            aria-pressed={showPassword}
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
          >
            {showPassword ? (
              <EyeSlashIcon size={18} weight="bold" />
            ) : (
              <EyeIcon size={18} weight="bold" />
            )}
          </button>
        </div>
      </div>

      {error ? (
        <div
          id={errorId}
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={pending || !login.trim() || !password}
        className="mt-1 h-12 min-h-12 w-full rounded-2xl bg-accent text-base text-accent-foreground hover:opacity-90 sm:text-sm"
      >
        {pending ? "Memproses…" : "Masuk"}
      </Button>
    </form>
  );
}
