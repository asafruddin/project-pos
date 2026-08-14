import * as React from "react"

import { cn } from "@pos-apps/ui/lib/utils"

function isNumericAmountInput(
  type: React.HTMLInputTypeAttribute | undefined,
  inputMode: React.HTMLAttributes<HTMLInputElement>["inputMode"],
  maxLength: number | undefined,
) {
  if (
    type === "password" ||
    type === "file" ||
    type === "email" ||
    type === "tel" ||
    type === "search" ||
    type === "hidden"
  ) {
    return false
  }
  if (typeof maxLength === "number") return false
  return type === "number" || inputMode === "numeric" || inputMode === "decimal"
}

/** Drop extra leading zeros ("05" → "5") while keeping "0", "0.5", and "-0.5". */
function stripLeadingZeros(raw: string) {
  if (raw === "" || raw === "-" || raw === "." || raw === "-.") return raw
  const negative = raw.startsWith("-")
  const rest = negative ? raw.slice(1) : raw
  if (rest.startsWith(".")) return `${negative ? "-" : ""}0${rest}`
  const [intPart = "", ...fracParts] = rest.split(".")
  const strippedInt = intPart.replace(/^0+(?=\d)/, "") || "0"
  const next = fracParts.length > 0 ? `${strippedInt}.${fracParts.join(".")}` : strippedInt
  return `${negative ? "-" : ""}${next}`
}

function Input({
  className,
  type,
  inputMode,
  maxLength,
  onChange,
  ...props
}: React.ComponentProps<"input">) {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (isNumericAmountInput(type, inputMode, maxLength)) {
      const next = stripLeadingZeros(event.target.value)
      if (next !== event.target.value) {
        event.target.value = next
      }
    }
    onChange?.(event)
  }

  return (
    <input
      type={type}
      inputMode={inputMode}
      maxLength={maxLength}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
      onChange={handleChange}
    />
  )
}

export { Input }
