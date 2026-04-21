import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ─── Request ──────────────────────────────────────────────────────────────────

export const AssignStatusSchema = z.object({
  statusGuuid: z.string().uuid(),
});

export class AssignStatusDto extends createZodDto(AssignStatusSchema) {}

// ─── Response ─────────────────────────────────────────────────────────────────

export interface EntityStatusResponse {
  entityCode:  string;
  statusGuuid: string;
  statusCode:  string;
  name:        string;
  fontColor:   string | null;
  bgColor:     string | null;
  borderColor: string | null;
  isBold:      boolean;
  isActive:    boolean;
  sortOrder:   number | null;
}

export type EntityStatusListResponse = EntityStatusResponse[];
