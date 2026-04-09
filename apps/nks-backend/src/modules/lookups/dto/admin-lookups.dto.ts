import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ─── Request DTOs ──────────────────────────────────────────────────────────────

const CreateLookupValueSchema = z.object({
  code:        z.string().min(1).max(50).toUpperCase(),
  label:       z.string().min(1).max(100),
  description: z.string().max(255).optional(),
  sortOrder:   z.number().int().optional(),
});

export class CreateLookupValueDto extends createZodDto(CreateLookupValueSchema) {}

export class UpdateLookupValueDto extends createZodDto(CreateLookupValueSchema.partial()) {}

// ─── Response ──────────────────────────────────────────────────────────────────

export interface LookupTypeResponse {
  code:       string;
  name:       string;
  isSystem:   boolean;
  valueCount: number;
}

export interface LookupValueAdminResponse {
  id:          number;
  code:        string;
  label:       string;
  description: string | null | undefined;
  isActive:    boolean;
  isHidden:    boolean;
  isSystem:    boolean;
  sortOrder:   number | null;
  createdAt:   Date | string;
  updatedAt:   Date | string | null;
}

export type LookupTypesListResponse = LookupTypeResponse[];
export type LookupValuesListResponse = LookupValueAdminResponse[];
