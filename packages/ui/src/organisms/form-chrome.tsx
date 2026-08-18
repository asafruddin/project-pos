"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  FloppyDiskIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react";
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

/**
 * Scrollable form fields. Pair with FormActions as siblings inside a
 * `h-full min-h-0 flex flex-col overflow-hidden` form so actions stay pinned.
 */
export function FormBody({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="flex flex-col gap-5">{children}</div>
    </div>
  );
}

/** Root layout class for dashboard forms with a pinned action bar. */
export const formPageClassName =
  "flex h-full min-h-0 flex-col gap-4 overflow-hidden";

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
    <div className="shrink-0 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-card)] sm:px-5 sm:py-4">
      {error ? (
        <p
          className="order-first w-full rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto sm:gap-3">
        {extra}
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="order-2 min-w-28 border-border bg-background font-medium shadow-sm"
          onClick={() => router.push(cancelHref, { scroll: false })}
          disabled={pending}
        >
          <XIcon weight="bold" />
          {cancelLabel}
        </Button>
        {hideSubmit ? null : (
          <Button
            type="submit"
            size="lg"
            disabled={pending}
            aria-busy={pending}
            className="order-1 min-w-32 font-semibold shadow-md shadow-primary/20"
          >
            <FloppyDiskIcon weight="bold" />
            {pending ? "Menyimpan…" : submitLabel}
          </Button>
        )}
      </div>
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
