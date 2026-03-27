export interface ProductModel {
  id: string;
  name: string;
  skuCode: string;
  barcode?: string;
  sellingPrice: number; // in paise
  costPrice: number; // in paise
  taxRate: number; // GST percentage: 0, 5, 12, 18, 28
  categoryId: string;
  unit: "PCS" | "KG" | "L" | "BOX";
  stockQuantity: number;
  isActive: boolean;
  syncedAt?: string;
}

export interface ProductCategoryModel {
  id: string;
  name: string;
  parentId?: string;
}

export interface CreateProductRequest {
  name: string;
  skuCode: string;
  barcode?: string;
  sellingPrice: number;
  costPrice: number;
  taxRate: number;
  categoryId: string;
  unit: string;
  openingStock?: number;
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {}
