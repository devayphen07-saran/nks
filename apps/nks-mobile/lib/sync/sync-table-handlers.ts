/**
 * Sync Table Handlers
 *
 * Maps server-side camelCase API payloads to local snake_case DB rows,
 * then calls the correct repository for each table.
 *
 * Each handler exposes batch methods so the pull loop can collect an entire
 * page of changes per table and write them in one SQLite statement instead
 * of N individual round-trips.
 *
 * Add a new entry to TABLE_HANDLERS when adding a new synced table.
 */

import {
  stateRepository,
  districtRepository,
} from "../database/repositories";

import type {
  StateRow,
  DistrictRow,
} from "../database/schema";

import { createLogger } from '../utils/logger';
const log = createLogger('SyncTableHandlers');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyncChange {
  table: string;
  id: number;
  operation: "upsert" | "delete";
  data: Record<string, unknown> | null;
  updatedAt: number; // Unix ms — used to advance per-table cursor
}

export type TableHandler = {
  /** Write a batch of upserts in a single DB statement. */
  onBatchUpsert: (items: Array<{ id: number; data: Record<string, unknown> }>) => Promise<void>;
  /** Soft-delete a batch of rows in a single DB statement. */
  onBatchDelete: (ids: number[]) => Promise<void>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
// All helpers validate the runtime type — no blind `as` casts on server data.

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

const bool = (v: unknown): number => (v ? 1 : 0);

const nullableStr = (v: unknown): string | null =>
  typeof v === "string" ? v : null;

// ─── TABLE_HANDLERS ───────────────────────────────────────────────────────────
// Key must exactly match the `table` field from the server's ChangesResponse.

export const TABLE_HANDLERS: Record<string, TableHandler> = {
  // ── state (reference data) ──────────────────────────────────────────────────
  state: {
    async onBatchUpsert(items) {
      log.debug(`state: onBatchUpsert called with ${items.length} items`);
      if (items.length > 0) {
        log.debug(`state: first item=${JSON.stringify(items[0])}`);
      }
      const rows: StateRow[] = items.map(({ id, data: d }) => ({
        id,
        guuid:              str(d.guuid),
        state_name:         str(d.stateName),
        state_code:         str(d.stateCode),
        gst_state_code:     nullableStr(d.gstStateCode),
        is_union_territory: bool(d.isUnionTerritory),
        is_active:          bool(d.isActive),
        updated_at:         str(d.updatedAt),
        deleted_at:         nullableStr(d.deletedAt),
      }));
      log.debug(`state: calling stateRepository.batchUpsert with ${rows.length} rows`);
      await stateRepository.batchUpsert(rows);
      log.debug(`state: batchUpsert completed`);
    },
    async onBatchDelete(ids) {
      log.debug(`state: onBatchDelete called with ${ids.length} ids`);
      await stateRepository.batchSoftDelete(ids);
    },
  },

  // ── district (reference data) ────────────────────────────────────────────────
  district: {
    async onBatchUpsert(items) {
      log.debug(`district: onBatchUpsert called with ${items.length} items`);
      if (items.length > 0) {
        log.debug(`district: first item=${JSON.stringify(items[0])}`);
      }
      const rows: DistrictRow[] = items.map(({ id, data: d }) => ({
        id,
        guuid:         str(d.guuid),
        district_name: str(d.districtName),
        district_code: nullableStr(d.districtCode),
        lgd_code:      nullableStr(d.lgdCode),
        state_guuid:   str(d.stateGuuid),
        is_active:     bool(d.isActive),
        updated_at:    str(d.updatedAt),
        deleted_at:    nullableStr(d.deletedAt),
      }));
      log.debug(`district: calling districtRepository.batchUpsert with ${rows.length} rows`);
      await districtRepository.batchUpsert(rows);
      log.debug(`district: batchUpsert completed`);
    },
    async onBatchDelete(ids) {
      log.debug(`district: onBatchDelete called with ${ids.length} ids`);
      await districtRepository.batchSoftDelete(ids);
    },
  },
};

/**
 * All table names registered for cursor-based sync.
 * These are sent to the server in the `tables` query param.
 */
export const SYNC_TABLES = Object.keys(TABLE_HANDLERS);
