"use client"

import * as React from "react"
import { endOfMonth, format, startOfMonth, subDays } from "date-fns"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Button } from "@pos-apps/ui/atoms/button"
import { Calendar } from "@pos-apps/ui/molecules/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@pos-apps/ui/molecules/popover"
import { cn } from "@pos-apps/ui/lib/utils"
import {
  formatDateValue,
  parseDateValue,
} from "@pos-apps/ui/lib/date-value"

type DateRangePickerProps = {
  from?: string
  to?: string
  onChange?: (range: { from: string; to: string }) => void
  /** Fires only once a full range is chosen (second click or a preset), not on the first click. */
  onRangeComplete?: (range: { from: string; to: string }) => void
  id?: string
  disabled?: boolean
  placeholder?: string
  numberOfMonths?: number
  className?: string
  align?: "start" | "center" | "end"
}

function DateRangePicker({
  from,
  to,
  onChange,
  onRangeComplete,
  id,
  disabled,
  placeholder = "Pick a date range",
  numberOfMonths = 2,
  className,
  align = "start",
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [choosingEnd, setChoosingEnd] = React.useState(false)
  const selected = React.useMemo<DateRange | undefined>(() => {
    const start = parseDateValue(from)
    const end = parseDateValue(to)
    if (!start && !end) return undefined
    return { from: start, to: end }
  }, [from, to])

  function handleSelect(range: DateRange | undefined) {
    if (!onChange) return
    const nextFrom = range?.from ? formatDateValue(range.from) : ""
    const nextTo = range?.to
      ? formatDateValue(range.to)
      : range?.from
        ? formatDateValue(range.from)
        : ""
    onChange({ from: nextFrom, to: nextTo })
    if (range?.from && !range?.to) setChoosingEnd(true)
    if (range?.from && range?.to) {
      onRangeComplete?.({ from: nextFrom, to: nextTo })
      setChoosingEnd(false)
      setOpen(false)
    }
  }

  function utcDate(offsetDays = 0) {
    const now = new Date()
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays)
    )
    return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  }

  function selectPreset(start: Date, end: Date) {
    const next = { from: formatDateValue(start), to: formatDateValue(end) }
    onChange?.(next)
    onRangeComplete?.(next)
    setChoosingEnd(false)
    setOpen(false)
  }

  const today = utcDate()
  const presets = [
    { label: "Hari ini", start: today, end: today },
    { label: "7 hari terakhir", start: utcDate(-6), end: today },
    { label: "30 hari terakhir", start: utcDate(-29), end: today },
    { label: "Bulan ini", start: startOfMonth(today), end: today },
    {
      label: "Bulan lalu",
      start: startOfMonth(subDays(today, 1)),
      end: endOfMonth(subDays(today, 1)),
    },
  ]

  const label =
    selected?.from && selected?.to
      ? `${format(selected.from, "dd/MM/yyyy")} – ${format(selected.to, "dd/MM/yyyy")}`
      : selected?.from
        ? format(selected.from, "dd/MM/yyyy")
        : null

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) setChoosingEnd(false)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!label}
          className={cn(
            "w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
            className
          )}
        >
          <CalendarIcon />
          {label ?? <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto max-w-[calc(100vw-1rem)] overflow-hidden p-0"
        align={align}
      >
        <div className="border-b px-4 py-3">
          <p className="text-sm font-medium">Pilih rentang tanggal</p>
          <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
            {choosingEnd ? "Pilih tanggal akhir" : "Pilih tanggal mulai, lalu tanggal akhir"} · UTC
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-full px-2.5 text-xs"
                onClick={() => selectPreset(preset.start, preset.end)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
        <Calendar
          mode="range"
          defaultMonth={selected?.from}
          selected={selected}
          onSelect={handleSelect}
          numberOfMonths={numberOfMonths}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DateRangePicker }
export type { DateRangePickerProps }
