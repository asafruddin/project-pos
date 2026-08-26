"use client"

import * as React from "react"
import { format } from "date-fns"
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
  id,
  disabled,
  placeholder = "Pick a date range",
  numberOfMonths = 2,
  className,
  align = "start",
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
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
    if (range?.from && range?.to) setOpen(false)
  }

  const label =
    selected?.from && selected?.to
      ? `${format(selected.from, "dd/MM/yyyy")} – ${format(selected.to, "dd/MM/yyyy")}`
      : selected?.from
        ? format(selected.from, "dd/MM/yyyy")
        : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
      <PopoverContent className="w-auto p-0" align={align}>
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
