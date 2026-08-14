"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, PlusIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Button } from "@pos-apps/ui/atoms/button";
import { cn } from "@pos-apps/ui/lib/utils";
import { Card } from "@pos-apps/ui/molecules/card";

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
    <Card className="gap-4 p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
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
        variant="secondary"
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
    <Button asChild>
      <Link href={href} scroll={false}>
        <PlusIcon size={18} weight="bold" />
        {children}
      </Link>
    </Button>
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
    <Button asChild variant="secondary" size="sm" className={cn(className)}>
      <Link href={href} scroll={false}>
        {children}
      </Link>
    </Button>
  );
}
