"use client";

import { FormEvent, useCallback } from "react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "C"] as const;

type PinPadProps = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  inputLabel: string;
  pasteHint: string;
};

export function PinPad({
  value,
  onChange,
  disabled,
  inputLabel,
  pasteHint,
}: PinPadProps) {
  const setDigits = useCallback(
    (raw: string) => {
      const digits = raw.replace(/\D/g, "").slice(0, 6);
      onChange(digits);
    },
    [onChange],
  );

  function press(key: (typeof KEYS)[number]) {
    if (disabled) return;
    if (key === "⌫") {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === "C") {
      onChange("");
      return;
    }
    if (value.length >= 6) return;
    onChange(value + key);
  }

  function onPasteInput(e: FormEvent<HTMLInputElement>) {
    setDigits(e.currentTarget.value);
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-4">
      <div className="flex justify-center gap-2" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full border border-border ${
              i < value.length ? "bg-primary" : "bg-transparent"
            }`}
          />
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="pin-masked" className="text-sm text-muted-foreground">
          {inputLabel}
        </label>
        <input
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
          className="h-12 w-full rounded-lg border border-border bg-background px-3 text-center text-lg tracking-[0.4em] text-foreground"
          aria-describedby="pin-paste-hint"
        />
        <p id="pin-paste-hint" className="text-xs text-muted-foreground">
          {pasteHint}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => press(key)}
            className="inline-flex min-h-[56px] min-w-[56px] items-center justify-center rounded-lg border border-border bg-background text-xl font-medium text-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}
