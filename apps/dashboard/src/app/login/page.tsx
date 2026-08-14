"use client";

import { AuthSplitShell } from "@pos-apps/ui/organisms";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  clearSession,
  getAccessToken,
  isAccessTokenExpired,
} from "@/lib/auth-token";
import { ThemeToggle } from "@/components/molecules/theme-toggle";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const token = getAccessToken();
    if (token && isAccessTokenExpired(token)) {
      clearSession();
      return;
    }
    if (token) {
      router.replace("/");
    }
  }, [router]);

  return (
    <AuthSplitShell
      brandTitle="POS Apps"
      brandSubtitle="Dashboard"
      heading="Masuk"
      description="Masuk dengan akun katalog atau kasir untuk mengelola toko."
      topRight={<ThemeToggle />}
    >
      <LoginForm />
    </AuthSplitShell>
  );
}
