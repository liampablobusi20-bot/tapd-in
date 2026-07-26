export type MonthCell = { date: Date; inCurrentMonth: boolean };

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Postgres `date` columns come back as "YYYY-MM-DD" strings, which
// `new Date(...)` parses as UTC midnight — off by a day in negative UTC
// offsets. Force local-time parsing instead.
export function parseDateKey(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

export function getMonthGrid(year: number, month: number): MonthCell[] {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: MonthCell[] = [];

  for (let i = startWeekday - 1; i >= 0; i--) {
    const date = new Date(year, month, 1 - (i + 1));
    cells.push({ date, inCurrentMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(year, month, day), inCurrentMonth: true });
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const date = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    cells.push({ date, inCurrentMonth: date.getMonth() === month });
  }

  return cells;
}
