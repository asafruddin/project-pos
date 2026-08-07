"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorBody, LoginResponse } from "@pos-apps/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSession } from "@/lib/auth-token";
import { copy, type LangPref } from "@/lib/preferences";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function LoginForm({ lang }: { lang: LangPref }) {
  const router = useRouter();
  const t = copy(lang);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
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
        setError((data as ApiErrorBody).message ?? t.apiDown);
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
        setError(t.invalidResponse);
        return;
      }
      if (ok.role !== "cashier") {
        setError(t.notCashier);
        return;
      }
      saveSession({
        accessToken: ok.access_token,
        role: ok.role,
        userId: ok.user_id,
      });
      router.replace("/pin");
      router.refresh();
    } catch {
      setError(t.apiDown);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="login">{t.username}</Label>
        <Input
          id="login"
          name="login"
          autoComplete="username"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? t.pending : t.submit}
      </Button>
    </form>
  );
}
