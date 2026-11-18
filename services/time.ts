import { useEffect, useState } from 'react';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A short relative time, for example "5 min. ago", in the language of the UI. */
export function timeAgo(timestamp: number, now: number, locale: string): string {
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  const elapsed = Math.max(0, now - timestamp);
  if (elapsed < MINUTE) return format.format(0, 'second');
  if (elapsed < HOUR) return format.format(-Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return format.format(-Math.floor(elapsed / HOUR), 'hour');
  return format.format(-Math.floor(elapsed / DAY), 'day');
}

/** The current time. The component renders again at each interval. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
