// <------ Reg exp ------->

export const numbersOnlyReg = RegExp(/^[0-9]+$/);

export const numbersOnlyRegWithDot = RegExp(/^[0-9.]+$/);

export const alphaNumericOnlyReg = RegExp(/^[a-zA-Z0-9]+$/);

export const alphaNumericWithDotReg = RegExp(/^[a-zA-Z0-9.]+$/);

export const phoneReg = RegExp(/^[6-9]\d{9}$/);

export const gstinReg = RegExp(
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
);

export const emailReg = RegExp(
  "^(?!\\.)(?!.*\\.{2})(?!.*\\.$)[A-Za-z0-9+_.-]+(?<!\\.)@[A-Za-z0-9.-]+\\.[A-Za-z]{2,6}(?<!\\.)$",
);

export const websiteReg = RegExp(
  /^(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:[0-9]{1,5})?(\/.*)?$/,
);

// <------ GST Rates ------->

export const GST_RATES = [0, 5, 12, 18, 28] as const;
export type GSTRate = (typeof GST_RATES)[number];

// <------ Sync / Outbox ------->

export const MAX_OUTBOX_RETRY_ATTEMPTS = 10;

export const CONNECTIVITY_PROBE_INTERVAL_MS = 30_000;

export const OUTBOX_WORKER_CONCURRENCY = 5;

export const RETRY_BASE_DELAY_MS = 1_000;

// <------ Lookup constants ------->

export const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "CREDIT"] as const;

export const PRODUCT_UNITS = ["PCS", "KG", "L", "BOX"] as const;

export const SYNC_STATUS = [
  "PENDING",
  "SYNCING",
  "SYNCED",
  "FAILED",
  "DEAD",
] as const;

export const CONNECTIVITY_STATUS = [
  "ONLINE",
  "DEGRADED",
  "OFFLINE",
  "SYNCING",
] as const;
