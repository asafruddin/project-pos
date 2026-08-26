"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

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

type DatePickerProps = {
  value?: string
  onChange?: (value: string) => void
  id?: string
  disabled?: boolean
  placeholder?: string
  className?: string
  align?: "start" | "center" | "end"
}

function DatePicker({
  value,
  onChange,
  id,
  disabled,
  placeholder = "Pick a date",
  className,
  align = "start",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = React.useMemo(() => parseDateValue(value), [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!selected}
          className={cn(
            "w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
            className
          )}
        >
          <CalendarIcon />
          {selected ? format(selected, "dd/MM/yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            onChange?.(date ? formatDateValue(date) : "")
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
export type { DatePickerProps }
