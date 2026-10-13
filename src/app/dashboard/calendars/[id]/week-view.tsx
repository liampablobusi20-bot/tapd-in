"use client";

import { toDateKey } from "@/lib/month-grid";
import { STATUS_COLORS } from "@/components/phase-status-badge";
import { ItemTime } from "@/components/item-time";
import type { Phase } from "./calendar-types";

export function WeekView({
  weekStart,
  itemsByDate,
  todayKey,
  timezone,
  onOpenDay,
  onOpenItem,
}: {
  weekStart: Date;
  itemsByDate: Map<string, Phase[]>;
  todayKey: string;
  timezone: string | null;
  onOpenDay: (dateKey: string) => void;
  onOpenItem: (dateKey: string, itemId: string) => void;
}) {
  const days = Array.from(
    { length: 7 },
    (_, i) =>
      new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)
  );

  return (
    <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 shadow-sm md:grid-cols-7">
      {days.map((date) => {
        const key = toDateKey(date);
        const dayItems = itemsByDate.get(key) ?? [];
        const isToday = key === todayKey;
        return (
          <div key={key} className="flex min-h-24 flex-col bg-white md:min-h-64">
            <button
              onClick={() => onOpenDay(key)}
              className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2 text-left hover:bg-zinc-50"
            >
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {date.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                  isToday ? "bg-zinc-900 font-semibold text-white" : "text-zinc-800"
                }`}
              >
                {date.getDate()}
              </span>
            </button>
            <div className="flex flex-col gap-1 p-2">
              {dayItems.length === 0 ? (
                <span className="px-1 text-xs text-zinc-300">Nothing scheduled</span>
              ) : (
                dayItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onOpenItem(key, item.id)}
                    className={`rounded-md px-2 py-1.5 text-left text-xs leading-snug ${STATUS_COLORS[item.status]}`}
                  >
                    {item.start_time && (
                      <ItemTime
                        dateKey={key}
                        time={item.start_time}
                        timezone={timezone}
                        showLocal={false}
                        className="block text-[11px] opacity-75"
                      />
                    )}
                    <span className="block break-words font-medium">{item.label}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
