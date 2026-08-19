"use client";

import { formatMoney } from "@/lib/currency";
import { formatCompactAmount, type CalendarCell } from "@/lib/domain/report";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function MoneyCalendar({ cells, month }: { cells: CalendarCell[]; month: string }) {
  const [year, monthIndex] = month.split("-").map(Number);
  const leadingBlanks = new Date(year, monthIndex - 1, 1).getDay();

  return (
    <div className="grid gap-1.5">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((weekday, index) => (
          <div
            key={`${weekday}-${index}`}
            aria-hidden
            className="py-1 text-center text-[11px] text-muted-foreground"
          >
            {weekday}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <div key={`blank-${index}`} aria-hidden />
        ))}

        {cells.map((cell) => {
          const positive = cell.net > 0;
          const negative = cell.net < 0;

          return (
            <div
              key={cell.date}
              title={
                cell.hasActivity
                  ? `${cell.date}: ${positive ? "+" : negative ? "−" : ""}${formatMoney(Math.abs(cell.net))}`
                  : undefined
              }
              className={cn(
                "grid min-h-12 content-center justify-items-center gap-0.5 rounded-md px-0.5 py-1.5",
                positive && "bg-pos/12",
                negative && "bg-neg/12",
              )}
            >
              <span
                className={cn(
                  "text-xs leading-none tabular-nums",
                  cell.hasActivity ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {cell.day}
              </span>
              {cell.hasActivity ? (
                <span
                  className={cn(
                    "text-[11px] leading-none tabular-nums",
                    positive ? "text-pos" : negative ? "text-neg" : "text-muted-foreground",
                  )}
                >
                  {positive ? "+" : negative ? "−" : ""}
                  {formatCompactAmount(cell.net)}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
