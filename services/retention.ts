import { useEffect } from 'react';

const HOUR = 60 * 60 * 1000;

interface Dated {
  id: string;
  timestamp: number;
}

/** The records that are older than the retention time. Zero hours means "keep all". */
export function expiredIds(records: Dated[], now: number, retentionHours: number): string[] {
  if (!(retentionHours > 0)) return [];
  const cutoff = now - retentionHours * HOUR;
  return records.filter((record) => record.timestamp < cutoff).map((record) => record.id);
}

/**
 * Deletes expired records for the full group. The retention time must be a
 * shared setting: a delete operation syncs to all peers. `remove` must be a
 * stable function.
 */
export function usePurgeExpired<T extends Dated>(
  records: T[],
  retentionHours: number,
  remove: (ids: string[]) => void,
): void {
  useEffect(() => {
    const purge = () => {
      const ids = expiredIds(records, Date.now(), retentionHours);
      if (ids.length > 0) remove(ids);
    };
    purge();
    const timer = setInterval(purge, 30_000);
    return () => clearInterval(timer);
  }, [records, retentionHours, remove]);
}
