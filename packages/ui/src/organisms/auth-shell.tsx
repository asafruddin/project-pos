"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { BrandMark } from "@pos-apps/ui/molecules/brand-mark";
import { cn } from "@pos-apps/ui/lib/utils";

const KEYBOARD_INSET_PX = 120;

function editableField(shell: HTMLElement) {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !shell.contains(active)) return null;
  if (active.closest(".sr-only")) return null;
  if (active instanceof HTMLTextAreaElement) return active;
  if (active instanceof HTMLInputElement) {
    const skip = new Set([
      "button",
      "checkbox",
      "radio",
      "submit",
      "reset",
      "file",
      "hidden",
      "image",
    ]);
    if (skip.has(active.type)) return null;
    return active;
  }
  return null;
}

function scrollFieldIntoView(scroller: HTMLElement, field: HTMLElement) {
  const view = scroller.getBoundingClientRect();
  const margin = 12;
  const form = field.closest("form");
  const formBox = (form ?? field).getBoundingClientRect();
  const formFits = formBox.height <= view.height - margin * 2;
  const box = formFits ? formBox : field.getBoundingClientRect();
  if (box.bottom > view.bottom - margin) {
    scroller.scrollTop += box.bottom - (view.bottom - margin);
  } else if (box.top < view.top + margin) {
    scroller.scrollTop -= view.top + margin - box.top;
  }
}

function useKeyboardLift(
  shellRef: RefObject<HTMLElement | null>,
  scrollerRef: RefObject<HTMLElement | null>,
  setLifted: (value: boolean | ((current: boolean) => boolean)) => void,
) {
  useEffect(() => {
    const shell = shellRef.current;
    const viewport = window.visualViewport;
    if (!shell || !viewport) return;

    let frame = 0;
    let blurTimer = 0;

    const apply = () => {
      const field = editableField(shell);
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      const lifted = Boolean(field) && inset > KEYBOARD_INSET_PX;

      if (lifted) {
        shell.style.height = `${viewport.height}px`;
        shell.style.transform = viewport.offsetTop
          ? `translate3d(0, ${viewport.offsetTop}px, 0)`
          : "";
        if (window.scrollY !== 0) window.scrollTo(0, 0);
      } else {
        shell.style.height = "";
        shell.style.transform = "";
      }

      setLifted((current) => (current === lifted ? current : lifted));

      const scroller = scrollerRef.current;
      if (lifted && field && scroller) scrollFieldIntoView(scroller, field);
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };

    const onFocusOut = () => {
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(schedule, 80);
    };

    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    shell.addEventListener("focusin", schedule);
    shell.addEventListener("focusout", onFocusOut);
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(blurTimer);
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      shell.removeEventListener("focusin", schedule);
      shell.removeEventListener("focusout", onFocusOut);
      shell.style.height = "";
      shell.style.transform = "";
    };
  }, [scrollerRef, setLifted, shellRef]);
}

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
  logoSrc,
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
  logoSrc?: string | null;
}) {
  const shellRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLElement>(null);
  const [lifted, setLifted] = useState(false);
  useKeyboardLift(shellRef, scrollerRef, setLifted);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const shell = shellRef.current;
    if (!scroller || !shell) return;
    if (!lifted) {
      scroller.scrollTop = 0;
      return;
    }
    const field = editableField(shell);
    if (field) scrollFieldIntoView(scroller, field);
  }, [lifted]);

  return (
    <main
      ref={shellRef}
      className={cn(
        "fixed inset-x-0 top-0 flex h-dvh w-full flex-col overflow-hidden bg-background lg:flex-row",
        className,
      )}
    >
      {topRight ? (
        <div className="absolute top-4 right-4 z-30 sm:top-6 sm:right-6">{topRight}</div>
      ) : null}

      <aside className="relative hidden overflow-hidden lg:flex lg:w-[48%] lg:flex-col lg:justify-end">
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

      <section
        ref={scrollerRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 sm:px-8 lg:px-12 xl:px-16",
          lifted ? "py-3" : "py-10",
        )}
      >
        <div className="mx-auto my-auto w-full max-w-md">
          <BrandMark
            title={brandTitle}
            subtitle={brandSubtitle}
            size={lifted ? "md" : "lg"}
            className={lifted ? "mb-4" : "mb-8"}
            logoSrc={logoSrc}
          />
          <h1
            className={cn(
              "text-center font-semibold tracking-tight text-foreground",
              lifted ? "text-2xl" : "text-3xl sm:text-4xl",
            )}
          >
            {heading}
          </h1>
          <p
            className={cn(
              "text-center text-sm text-muted-foreground sm:text-base",
              lifted ? "mt-1" : "mt-3",
            )}
          >
            {description}
          </p>
          <div className={lifted ? "mt-4" : "mt-8"}>{children}</div>
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
