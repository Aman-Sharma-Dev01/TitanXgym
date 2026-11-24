const IST_TIMEZONE = 'Asia/Kolkata';

export function getNowIST(): { date: string; time: string; hour: number; iso: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }
  const hourNum = Number(map.hour === '24' ? '00' : map.hour);
  const hourStr = String(hourNum).padStart(2, '0');
  const date = `${map.year}-${map.month}-${map.day}`;
  const time = `${hourStr}:${map.minute}:${map.second}`;
  return {
    date,
    time,
    hour: hourNum,
    iso: `${date}T${time}+05:30`,
  };
}

export function getTodayIST(): string {
  return getNowIST().date;
}

export function parseDateParts(dateStr: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function formatDateParts(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addDuration(
  startDateStr: string,
  duration: number,
  unit: 'days' | 'months' | 'years',
): string {
  const parts = parseDateParts(startDateStr);
  if (!parts) return startDateStr;
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (unit === 'days') {
    d.setUTCDate(d.getUTCDate() + duration);
  } else if (unit === 'months') {
    const targetMonth = d.getUTCMonth() + duration;
    const origDay = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(targetMonth);
    const maxDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(origDay, maxDay));
  } else if (unit === 'years') {
    const targetYear = d.getUTCFullYear() + duration;
    const origDay = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCFullYear(targetYear);
    const maxDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(origDay, maxDay));
  }
  return formatDateParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function diffDaysIST(fromDateStr: string, toDateStr: string): number {
  const from = parseDateParts(fromDateStr);
  const to = parseDateParts(toDateStr);
  if (!from || !to) return 0;
  const fromMs = Date.UTC(from.year, from.month - 1, from.day);
  const toMs = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toMs - fromMs) / 86400000);
}

export type ComputedSubStatus =
  | 'Active'
  | 'Expiring Soon'
  | 'Expired'
  | 'Pending Payment'
  | 'Suspended';

export function computeSubscriptionState(
  sub: {
    expiry_date: string;
    pending_amount: number;
    status_override?: string | null;
  },
  todayIST = getTodayIST(),
): {
  status: ComputedSubStatus;
  daysRemaining: number;
  hasPendingPayment: boolean;
} {
  const daysRemaining = diffDaysIST(todayIST, sub.expiry_date);
  const hasPendingPayment = Number(sub.pending_amount || 0) > 0;

  if (sub.status_override === 'suspended') {
    return { status: 'Suspended', daysRemaining, hasPendingPayment };
  }
  if (daysRemaining < 0) {
    return { status: 'Expired', daysRemaining, hasPendingPayment };
  }
  if (daysRemaining <= 7) {
    return { status: 'Expiring Soon', daysRemaining, hasPendingPayment };
  }
  if (hasPendingPayment) {
    return { status: 'Pending Payment', daysRemaining, hasPendingPayment };
  }
  return { status: 'Active', daysRemaining, hasPendingPayment };
}

export function formatReadableDate(dateStr: string): string {
  const parts = parseDateParts(dateStr);
  if (!parts) return dateStr;
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return d.toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
