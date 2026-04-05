"use client";

import { format, parseISO } from "date-fns";
import { IconCalendar } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type DatePickerProps = {
  /** ISO date string YYYY-MM-DD */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
};

/**
 * Render a button-triggered popover calendar for selecting a date in YYYY-MM-DD format.
 *
 * The component displays a trigger button showing the formatted date (`dd MMM yyyy`) or a placeholder.
 * Opening the popover shows a calendar; selecting a date calls `onChange` with a local `YYYY-MM-DD` string
 * (constructed from the selected Date's year, month, and day to avoid timezone shifts).
 *
 * @param value - Current selected date as an ISO `YYYY-MM-DD` string; if falsy, no date is selected.
 * @param onChange - Callback invoked with the newly selected date as an ISO `YYYY-MM-DD` string.
 * @param placeholder - Text shown in the trigger when `value` is empty. Defaults to `"Pick a date"`.
 * @param disabled - If true, disables the trigger button.
 * @param id - Optional id applied to the trigger `Button`.
 * @returns A React element that renders the date picker UI.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  id,
}: DatePickerProps) {
  const selected = value ? parseISO(value) : undefined;

  function handleSelect(date: Date | undefined) {
    if (!date) return;
    // Format as local YYYY-MM-DD without timezone shift
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    onChange(`${year}-${month}-${day}`);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start gap-2 border-input bg-transparent px-3 font-normal",
            "hover:bg-transparent dark:bg-input/30 dark:hover:bg-input/50",
            !value && "text-muted-foreground",
          )}
        >
          <IconCalendar className="h-4 w-4 shrink-0 text-muted-foreground" />
          {selected ? format(selected, "dd MMM yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
