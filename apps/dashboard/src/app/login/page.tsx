"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthSplitShell } from "@/components/auth-shell";
import { getAccessToken } from "@/lib/auth-token";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (getAccessToken()) {
      router.replace("/");
    }
  }, [router]);

  return (
    <AuthSplitShell
      brandTitle="POS Apps"
      brandSubtitle="Dashboard"
      heading="Masuk"
      description="Masuk dengan akun katalog atau kasir untuk mengelola toko."
      quoteBy="Dashboard"
    >
      <LoginForm />
    </AuthSplitShell>
  );
}
