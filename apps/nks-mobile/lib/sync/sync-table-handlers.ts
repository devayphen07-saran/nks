/**
 * Sync Table Handlers
 *
 * Maps server-side camelCase API payloads to local snake_case DB rows,
 * then calls the correct repository for each table.
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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyncChange {
  table: string;
  id: number;
  operation: "upsert" | "delete";
  data: Record<string, unknown> | null;
  updatedAt: number; // Unix ms — used to advance per-table cursor
}

type TableHandler = {
  onUpsert: (id: number, data: Record<string, unknown>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
// All helpers validate the runtime type — no blind `as` casts on server data.

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && isFinite(v) ? v : fallback;

const bool = (v: unknown): number => (v ? 1 : 0);

const nullableStr = (v: unknown): string | null =>
  typeof v === "string" ? v : null;

const nullableNum = (v: unknown): number | null =>
  typeof v === "number" && isFinite(v) ? v : null;

// ─── TABLE_HANDLERS ───────────────────────────────────────────────────────────
// Key must exactly match the `table` field from the server's ChangesResponse.

export const TABLE_HANDLERS: Record<string, TableHandler> = {
  // ── state (reference data) ──────────────────────────────────────────────────
  state: {
    async onUpsert(id, d) {
      const row: StateRow = {
        id,
        guuid: str(d.guuid),
        state_name: str(d.stateName),
        state_code: str(d.stateCode),
        gst_state_code: nullableStr(d.gstStateCode),
        is_union_territory: bool(d.isUnionTerritory),
        is_active: bool(d.isActive),
        updated_at: str(d.updatedAt),
        deleted_at: nullableStr(d.deletedAt),
      };
      await stateRepository.upsert(row);
    },
    async onDelete(_id) {
      // States are never deleted — ignore
    },
  },

  // ── district (reference data) ────────────────────────────────────────────────
  district: {
    async onUpsert(id, d) {
      const row: DistrictRow = {
        id,
        guuid: str(d.guuid),
        district_name: str(d.districtName),
        district_code: nullableStr(d.districtCode),
        lgd_code: nullableStr(d.lgdCode),
        state_fk: num(d.stateFk),
        is_active: bool(d.isActive),
        updated_at: str(d.updatedAt),
        deleted_at: nullableStr(d.deletedAt),
      };
      await districtRepository.upsert(row);
    },
    async onDelete(_id) {
      // Districts are never deleted — ignore
    },
  },
};

/**
 * All table names registered for cursor-based sync.
 * These are sent to the server in the `tables` query param.
 */
export const SYNC_TABLES = Object.keys(TABLE_HANDLERS);
