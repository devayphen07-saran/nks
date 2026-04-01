import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const RegisterStoreSchema = z.object({
  storeName: z.string().min(1).max(255),
  storeCode: z.string().min(1).max(50).optional(),
  storeLegalTypeCode: z.string().min(1), // e.g. 'PVT_LTD'
  storeCategoryCode: z.string().min(1), // e.g. 'GROCERY'
  registrationNumber: z.string().max(100).optional(),
  taxNumber: z.string().max(100).optional(),

  // Store Address Fields
  address: z
    .object({
      line1: z.string().min(1).max(255),
      line2: z.string().max(255).optional(),
      cityName: z.string().min(1).max(150),
      stateRegionProvinceText: z.string().max(100).optional(),
      stateRegionProvinceFk: z.number().optional(),
      administrativeDivisionFk: z.number().optional(),
      administrativeDivisionText: z.string().max(100).optional(),
      postalCode: z.string().max(20),
      countryFk: z.number(),
    })
    .optional(),
});

export class RegisterStoreDto extends createZodDto(RegisterStoreSchema) {}
