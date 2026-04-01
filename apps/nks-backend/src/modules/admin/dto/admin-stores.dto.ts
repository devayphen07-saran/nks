import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, Min, Max } from 'class-validator';

export class AdminStoreResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'STORE-001' })
  storeCode: string;

  @ApiProperty({ example: 'My Store' })
  storeName: string;

  @ApiProperty({ example: 1 })
  storeLegalTypeFk: number;

  @ApiProperty({ example: 1 })
  storeCategoryFk: number;

  @ApiProperty({ example: 'REG-12345' })
  registrationNumber: string | null;

  @ApiProperty({ example: 'TAX-98765' })
  taxNumber: string | null;

  @ApiProperty({ example: false })
  isDeleted: boolean;

  @ApiProperty({ example: '2026-03-29T11:46:51.493Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-03-29T14:45:29.920Z' })
  updatedAt: string;
}

export class AdminStoresListResponseDto {
  @ApiProperty({ type: [AdminStoreResponseDto] })
  data: AdminStoreResponseDto[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}

export class UpdateAdminStoreDto {
  @ApiProperty({ example: 'Updated Store Name', required: false })
  @IsOptional()
  @IsString()
  storeName?: string;

  @ApiProperty({ example: 'REG-12345', required: false })
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiProperty({ example: 'TAX-98765', required: false })
  @IsOptional()
  @IsString()
  taxNumber?: string;
}

export class ListAdminStoresQueryDto {
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ example: 20, required: false })
  @IsOptional()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiProperty({
    example: 'store',
    required: false,
    description: 'Search by store name or code',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    example: 'createdAt',
    required: false,
    enum: ['storeName', 'storeCode', 'createdAt'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiProperty({ example: 'desc', required: false, enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
