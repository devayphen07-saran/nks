export const IDEMPOTENCY_TTL_DAYS = 90;
export const TOMBSTONE_TTL_DAYS = 90;

export const DEFAULT_PULL_LIMIT = 500;
export const MAX_PUSH_BATCH = 50;
export const MAX_PUSH_BYTES = 500_000; // 500 KB

export const STALE_DEVICE_THRESHOLD_DAYS = 90;

export const ENTITY_PRIORITY: Record<string, number> = {
  sale: 10,
  payment: 10,
  customer: 5,
  product: 1,
  category: 1,
  tax: 1,
  stock_movement: 3,
};

export const TOMBSTONE_TARGETS = Symbol('TOMBSTONE_TARGETS');
