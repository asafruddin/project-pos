"use client";

import type { ReactNode } from "react";
import { BrandMark } from "@pos-apps/ui/molecules/brand-mark";
import { cn } from "@pos-apps/ui/lib/utils";

export function AuthSplitShell({
  brandTitle = "POS Apps",
  brandSubtitle,
  heading,
  description,
  quote = "Serve customers the best food with prompt and friendly service in a welcoming atmosphere, and they’ll keep coming back.",
  quoteBy = "POS Apps",
  topRight,
  children,
  className,
}: {
  brandTitle?: string;
  brandSubtitle?: string;
  heading: string;
  description: string;
  quote?: string;
  quoteBy?: string;
  topRight?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "relative flex min-h-dvh flex-1 flex-col bg-background lg:flex-row",
        className,
      )}
    >
      {topRight ? (
        <div className="absolute top-4 right-4 z-30 sm:top-6 sm:right-6">{topRight}</div>
      ) : null}

      <aside className="relative hidden min-h-[40vh] overflow-hidden lg:flex lg:w-[48%] lg:min-h-dvh lg:flex-col lg:justify-end">
        <div
          className="absolute inset-0 bg-[radial-gradient(120%_90%_at_10%_10%,color-mix(in_oklab,var(--primary)_42%,transparent),transparent_50%),radial-gradient(90%_80%_at_90%_90%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_45%),linear-gradient(160deg,#1c1410,#0f0c0a)]"
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{ background: "var(--hero-overlay)" }}
          aria-hidden
        />
        <div className="relative z-10 max-w-xl space-y-4 p-10 xl:p-14">
          <p className="text-lg leading-relaxed text-white/95 xl:text-xl">“{quote}”</p>
          <span className="inline-flex rounded-md border border-white/70 px-4 py-1.5 text-sm text-white">
            {quoteBy}
          </span>
        </div>
      </aside>

      <section className="relative flex flex-1 flex-col justify-center px-4 py-10 sm:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-md">
          <BrandMark
            title={brandTitle}
            subtitle={brandSubtitle}
            size="lg"
            className="mb-8"
          />
          <h1 className="text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {heading}
          </h1>
          <p className="mt-3 text-center text-sm text-muted-foreground sm:text-base">
            {description}
          </p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}

export function AuthLoadingShell({ message }: { message: string }) {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-background px-6">
      <p className="text-sm text-muted-foreground sm:text-base">{message}</p>
    </main>
  );
}
