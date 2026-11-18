/**
 * Supply inventory: records, guards, and logic.
 *
 * The quantity of an item is not a field. It is the sum of adjustment
 * records. Two members who take stock at the same time each add a record,
 * so both changes count. A quantity field would keep only one of them.
 */

export interface SupplyItem {
  id: string;
  name: string;
  /** For example "boxes" or "liters". */
  unit: string;
  location: string;
  /** The item is low when the quantity is at or below this number. */
  lowAt: number;
  notes: string;
}

export interface SupplyAdjustment {
  id: string;
  itemId: string;
  /** Positive for stock that came in, negative for stock that went out. */
  delta: number;
  timestamp: number;
}

type Fields = Record<string, unknown>;
const fieldsOf = (value: unknown): Fields | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Fields) : null;
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function isSupplyItem(value: unknown): value is SupplyItem {
  const v = fieldsOf(value);
  return v !== null && ['id', 'name', 'unit', 'location', 'notes'].every((key) => typeof v[key] === 'string') && isNumber(v.lowAt);
}

export function isSupplyAdjustment(value: unknown): value is SupplyAdjustment {
  const v = fieldsOf(value);
  return v !== null && typeof v.id === 'string' && typeof v.itemId === 'string' && isNumber(v.delta) && isNumber(v.timestamp);
}

export function quantityOf(itemId: string, adjustments: SupplyAdjustment[]): number {
  return adjustments.reduce((sum, adjustment) => (adjustment.itemId === itemId ? sum + adjustment.delta : sum), 0);
}

export function isLow(item: SupplyItem, adjustments: SupplyAdjustment[]): boolean {
  return quantityOf(item.id, adjustments) <= item.lowAt;
}

export function countLow(items: SupplyItem[], adjustments: SupplyAdjustment[]): number {
  return items.filter((item) => isLow(item, adjustments)).length;
}

/**
 * The change that a member can make to an item. The stock cannot go below
 * zero from this device: a larger "take" is cut to the stock that is left.
 */
export function clampDelta(delta: number, quantity: number): number {
  if (!Number.isFinite(delta)) return 0;
  return delta < 0 ? Math.max(delta, -Math.max(0, quantity)) : delta;
}
