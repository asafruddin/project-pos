import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-start justify-center gap-6 p-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-accent">Dashboard</p>
        <h1 className="text-3xl font-semibold tracking-tight text-primary">
          Masuk
        </h1>
        <p className="max-w-md text-muted-foreground">
          Masuk dengan akun katalog atau kasir untuk mengelola toko.
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
