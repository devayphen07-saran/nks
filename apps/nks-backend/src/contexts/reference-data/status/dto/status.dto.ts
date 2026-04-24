import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { searchableSchema } from '../../../../common/dto/pagination.schema';

// ─── Hex color validation ──────────────────────────────────────────────────────
const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g. #4CAF50)')
  .nullable()
  .optional();

// ─── Request DTOs ──────────────────────────────────────────────────────────────

const CreateStatusSchema = z.object({
  code:        z.string().min(1).max(30).toUpperCase(),
  name:        z.string().min(1).max(50),
  description: z.string().max(100).optional(),
  fontColor:   hexColor,
  bgColor:     hexColor,
  borderColor: hexColor,
  isBold:      z.boolean().default(false),
  sortOrder:   z.number().int().optional(),
});

export class CreateStatusDto extends createZodDto(CreateStatusSchema) {}

const UpdateStatusSchema = CreateStatusSchema.omit({ code: true }).partial().extend({
  isActive: z.boolean().optional(),
});

export class UpdateStatusDto extends createZodDto(UpdateStatusSchema) {}

// ─── Query DTOs ────────────────────────────────────────────────────────────

export const GetAllStatusesQuerySchema = searchableSchema;

export class GetAllStatusesQueryDto extends createZodDto(GetAllStatusesQuerySchema) {}

// ─── Response DTO ──────────────────────────────────────────────────────────────

export interface StatusResponse {
  guuid:       string;
  code:        string;
  name:        string;
  description: string | null;
  fontColor:   string | null;
  bgColor:     string | null;
  borderColor: string | null;
  isBold:      boolean;
  isActive:    boolean;
  isSystem:    boolean;
  sortOrder:   number | null;
  createdAt:   string;
  updatedAt:   string | null;
}

