"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, PlusIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const formInputClass = "h-10 min-h-10 rounded-md";

export const formSelectClass =
  "flex h-10 min-h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export const formTextareaClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function FormField({
  id,
  label,
  hint,
  required,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-background/40 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function FormBackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon size={16} />
      {children}
    </Link>
  );
}

export function FormActions({
  error,
  pending,
  submitLabel = "Simpan",
  cancelLabel = "Batal",
  cancelHref,
  extra,
  hideSubmit,
}: {
  error?: string | null;
  pending?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  cancelHref: string;
  extra?: ReactNode;
  hideSubmit?: boolean;
}) {
  const router = useRouter();
  return (
    <div className="sticky bottom-0 z-10 mt-auto flex flex-wrap items-center gap-2 border-t border-border bg-card/95 py-3 backdrop-blur">
      {error ? (
        <p className="w-full text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {extra}
      {hideSubmit ? null : (
        <Button type="submit" disabled={pending} className="min-w-28">
          {pending ? "Menyimpan…" : submitLabel}
        </Button>
      )}
      <Button
        type="button"
        className="bg-secondary text-secondary-foreground hover:opacity-90"
        onClick={() => router.push(cancelHref, { scroll: false })}
        disabled={pending}
      >
        {cancelLabel}
      </Button>
    </div>
  );
}

export function FormDenied({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <FormBackLink href={href}>Kembali</FormBackLink>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

export function CreateLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
    >
      <PlusIcon size={18} weight="bold" />
      {children}
    </Link>
  );
}

export function RowLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "inline-flex h-9 items-center rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:opacity-90",
        className,
      )}
    >
      {children}
    </Link>
  );
}
