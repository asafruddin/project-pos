"use client";

import { Button, Input, Label } from "@pos-apps/ui/atoms";
import { BackspaceIcon, XIcon } from "@phosphor-icons/react";
import { FormEvent, useCallback } from "react";
import { cn } from "@/lib/utils";

type Key = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "back" | "0" | "clear";

const KEYS: Key[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "clear"];

type PinPadProps = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  inputLabel: string;
  pasteHint: string;
  className?: string;
};

export function PinPad({
  value,
  onChange,
  disabled,
  inputLabel,
  pasteHint,
  className,
}: PinPadProps) {
  const setDigits = useCallback(
    (raw: string) => {
      const digits = raw.replace(/\D/g, "").slice(0, 6);
      onChange(digits);
    },
    [onChange],
  );

  function press(key: Key) {
    if (disabled) return;
    if (key === "back") {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === "clear") {
      onChange("");
      return;
    }
    if (value.length >= 6) return;
    onChange(value + key);
  }

  function onPasteInput(e: FormEvent<HTMLInputElement>) {
    setDigits(e.currentTarget.value);
  }

  function labelFor(key: Key) {
    if (key === "back") return <BackspaceIcon size={24} weight="bold" />;
    if (key === "clear") return <XIcon size={22} weight="bold" />;
    return key;
  }

  return (
    <div className={cn("mx-auto flex w-full max-w-xs flex-col gap-5", className)}>
      <div className="flex justify-center gap-2" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary",
              i < value.length && "border-accent/50",
            )}
          >
            {i < value.length ? (
              <span className="h-2.5 w-2.5 rounded-full bg-foreground" />
            ) : null}
          </span>
        ))}
      </div>

      <div className="sr-only flex flex-col gap-1">
        <Label htmlFor="pin-masked">{inputLabel}</Label>
        <Input
          id="pin-masked"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          value={value}
          disabled={disabled}
          onChange={onPasteInput}
          onPaste={(e) => {
            e.preventDefault();
            setDigits(e.clipboardData.getData("text"));
          }}
          aria-describedby="pin-paste-hint"
        />
        <p id="pin-paste-hint">{pasteHint}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key) => (
          <Button
            key={key}
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={() => press(key)}
            aria-label={
              key === "back" ? "Backspace" : key === "clear" ? "Clear" : undefined
            }
            className="h-14 min-h-[3.5rem] rounded-2xl text-xl font-medium"
          >
            {labelFor(key)}
          </Button>
        ))}
      </div>
    </div>
  );
}
