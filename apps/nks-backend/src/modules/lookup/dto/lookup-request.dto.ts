import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Store Legal Type
const CreateStoreLegalTypeSchema = z.object({
  legalTypeName: z.string().min(1).max(50),
  legalTypeCode: z.string().min(1).max(30),
  description: z.string().optional(),
});

export class CreateStoreLegalTypeDto extends createZodDto(
  CreateStoreLegalTypeSchema,
) {}

const UpdateStoreLegalTypeSchema = z.object({
  legalTypeName: z.string().min(1).max(50).optional(),
  legalTypeCode: z.string().min(1).max(30).optional(),
  description: z.string().optional(),
});

export class UpdateStoreLegalTypeDto extends createZodDto(
  UpdateStoreLegalTypeSchema,
) {}

// Salutation
const CreateSalutationSchema = z.object({
  salutationText: z.string().min(1).max(20),
  description: z.string().optional(),
});

export class CreateSalutationDto extends createZodDto(CreateSalutationSchema) {}

const UpdateSalutationSchema = z.object({
  salutationText: z.string().min(1).max(20).optional(),
  description: z.string().optional(),
});

export class UpdateSalutationDto extends createZodDto(UpdateSalutationSchema) {}

// Store Category
const CreateStoreCategorySchema = z.object({
  categoryName: z.string().min(1).max(50),
  categoryCode: z.string().min(1).max(30),
  description: z.string().optional(),
});

export class CreateStoreCategoryDto extends createZodDto(
  CreateStoreCategorySchema,
) {}

const UpdateStoreCategorySchema = z.object({
  categoryName: z.string().min(1).max(50).optional(),
  categoryCode: z.string().min(1).max(30).optional(),
  description: z.string().optional(),
});

export class UpdateStoreCategoryDto extends createZodDto(
  UpdateStoreCategorySchema,
) {}

// Designation
const CreateDesignationSchema = z.object({
  designationName: z.string().min(1).max(100),
  designationCode: z.string().min(1).max(50),
});

export class CreateDesignationDto extends createZodDto(
  CreateDesignationSchema,
) {}

const UpdateDesignationSchema = z.object({
  designationName: z.string().min(1).max(100).optional(),
  designationCode: z.string().min(1).max(50).optional(),
});

export class UpdateDesignationDto extends createZodDto(
  UpdateDesignationSchema,
) {}
