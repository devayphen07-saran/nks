import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, isNull, count, asc, desc } from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm/column';
import { ilikeAny } from '../../../../core/database/query-helpers';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';
import { codeValue } from '../../../../core/database/schema/lookups/code-value/code-value.table';
import { codeCategory } from '../../../../core/database/schema/lookups/code-category/code-category.table';
import { currency } from '../../../../core/database/schema/lookups/currency/currency.table';
import type {
  CreateLookupValueDto,
  UpdateLookupValueDto,
} from '../dto/admin-lookups.dto';

const DEFAULT_LOOKUP_PAGE_SIZE = 200;

// ─── Row Types ──────────────────────────────────────────────────────────────

type CodeValueRow = {
  id: number;
  guuid: string;
  code: string;
  label: string;
  description: string | null;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date | null;
};

type CountryRow = typeof schema.country.$inferSelect;
type CommunicationTypeRow = typeof schema.communicationType.$inferSelect;
type CurrencyRow = typeof currency.$inferSelect;
type VolumesRow = typeof schema.volumes.$inferSelect;
type CodeCategoryWithCount = { code: string; name: string; isSystem: boolean; sortOrder: number | null; valueCount: number };
type CodeCategoryRef = { id: number; code: string; name: string };

/** Columns to select from code_value for generic lookup endpoints */
const codeValueSelect = {
  id: codeValue.id,
  guuid: codeValue.guuid,
  code: codeValue.code,
  label: codeValue.label,
  description: codeValue.description,
  isActive: codeValue.isActive,
  isHidden: codeValue.isHidden,
  isSystem: codeValue.isSystem,
  sortOrder: codeValue.sortOrder,
  createdAt: codeValue.createdAt,
  updatedAt: codeValue.updatedAt,
};

@Injectable()
export class LookupsRepository extends BaseRepository {
  constructor(@InjectDb() db: NodePgDatabase<typeof schema>) { super(db); }

  private getValueOrderColumn(sortBy: string = 'sortOrder') {
    switch (sortBy) {
      case 'code':      return codeValue.code;
      case 'label':     return codeValue.label;
      case 'createdAt': return codeValue.createdAt;
      case 'sortOrder':
      default:          return codeValue.sortOrder;
    }
  }

  private applySortDirection(column: AnyColumn, sortOrder: string = 'asc') {
    return sortOrder === 'desc' ? desc(column) : asc(column);
  }

  private queryCodeValues(categoryCode: string, limit = DEFAULT_LOOKUP_PAGE_SIZE) {
    return this.db
      .select(codeValueSelect)
      .from(codeValue)
      .innerJoin(codeCategory, eq(codeValue.categoryFk, codeCategory.id))
      .where(
        and(
          eq(codeCategory.code, categoryCode),
          isNull(codeValue.storeFk),
          eq(codeValue.isActive, true),
          isNull(codeValue.deletedAt),
        ),
      )
      .orderBy(codeValue.sortOrder)
      .limit(limit);
  }

  async getSalutations(): Promise<CodeValueRow[]> {
    return this.queryCodeValues('SALUTATION');
  }

  async getAddressTypes(): Promise<CodeValueRow[]> {
    return this.queryCodeValues('ADDRESS_TYPE');
  }

  async getDesignations(): Promise<CodeValueRow[]> {
    return this.queryCodeValues('DESIGNATION');
  }

  async getStoreLegalTypes(): Promise<CodeValueRow[]> {
    return this.queryCodeValues('STORE_LEGAL_TYPE');
  }

  async getStoreCategories(): Promise<CodeValueRow[]> {
    return this.queryCodeValues('STORE_CATEGORY');
  }

  async getCountries(): Promise<CountryRow[]> {
    return this.db
      .select()
      .from(schema.country)
      .where(
        and(
          eq(schema.country.isActive, true),
          isNull(schema.country.deletedAt),
        ),
      )
      .orderBy(schema.country.sortOrder);
  }

  async getCommunicationTypes(): Promise<CommunicationTypeRow[]> {
    return this.db
      .select()
      .from(schema.communicationType)
      .where(
        and(
          eq(schema.communicationType.isActive, true),
          isNull(schema.communicationType.deletedAt),
        ),
      )
      .orderBy(schema.communicationType.sortOrder);
  }

  async getCurrencies(): Promise<CurrencyRow[]> {
    return this.db
      .select()
      .from(currency)
      .where(and(eq(currency.isActive, true), isNull(currency.deletedAt)))
      .orderBy(currency.sortOrder);
  }

  async getVolumes(): Promise<VolumesRow[]> {
    return this.db
      .select()
      .from(schema.volumes)
      .where(
        and(
          eq(schema.volumes.isActive, true),
          isNull(schema.volumes.deletedAt),
        ),
      )
      .orderBy(schema.volumes.sortOrder);
  }

  // ── Admin: Lookup Configuration ─────────────────────────────────────────────

  /** All active code categories with a count of their global active values */
  async findAllCodeCategories(): Promise<CodeCategoryWithCount[]> {
    return this.db
      .select({
        code: codeCategory.code,
        name: codeCategory.name,
        isSystem: codeCategory.isSystem,
        sortOrder: codeCategory.sortOrder,
        valueCount: count(codeValue.id),
      })
      .from(codeCategory)
      .leftJoin(
        codeValue,
        and(
          eq(codeValue.categoryFk, codeCategory.id),
          isNull(codeValue.storeFk),
          eq(codeValue.isActive, true),
          isNull(codeValue.deletedAt),
        ),
      )
      .where(
        and(eq(codeCategory.isActive, true), isNull(codeCategory.deletedAt)),
      )
      .groupBy(codeCategory.id)
      .orderBy(codeCategory.sortOrder, codeCategory.name);
  }

  /** All non-deleted global values for a category (admin view — supports sortBy, sortOrder, isActive) */
  async findCodeValuesByCategory(
    categoryCode: string,
    opts: { page: number; pageSize: number; search?: string; sortBy?: string; sortOrder?: string; isActive?: boolean },
  ): Promise<{ rows: CodeValueRow[]; total: number }> {
    const { page, pageSize, search, sortBy = 'sortOrder', sortOrder = 'asc', isActive } = opts;
    const offset = LookupsRepository.toOffset(page, pageSize);

    const where = and(
      eq(codeCategory.code, categoryCode),
      isNull(codeValue.storeFk),
      isNull(codeValue.deletedAt),
      isActive !== undefined ? eq(codeValue.isActive, isActive) : undefined,
      ilikeAny(search, codeValue.label, codeValue.code),
    );

    return this.paginate(
      this.db.select(codeValueSelect).from(codeValue).innerJoin(codeCategory, eq(codeValue.categoryFk, codeCategory.id)).where(where).orderBy(this.applySortDirection(this.getValueOrderColumn(sortBy), sortOrder)).limit(pageSize).offset(offset),
      () => this.db.select({ total: count() }).from(codeValue).innerJoin(codeCategory, eq(codeValue.categoryFk, codeCategory.id)).where(where),
      page, pageSize,
    );
  }

  /** Resolve a code_category row by its code */
  async findCodeCategoryByCode(code: string): Promise<CodeCategoryRef | null> {
    const [row] = await this.db
      .select({
        id: codeCategory.id,
        code: codeCategory.code,
        name: codeCategory.name,
      })
      .from(codeCategory)
      .where(and(eq(codeCategory.code, code), isNull(codeCategory.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  /** Find a single code_value by id */
  async findCodeValueById(id: number): Promise<CodeValueRow | null> {
    const [row] = await this.db
      .select(codeValueSelect)
      .from(codeValue)
      .where(and(eq(codeValue.id, id), isNull(codeValue.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  /**
   * Fetch a code_value by id and verify it belongs to categoryCode in one query.
   * Returns null if the value does not exist, is deleted, or belongs to a different category.
   * Use this instead of calling findCodeCategoryByCode + findCodeValueById separately.
   */
  async findCodeValueByIdAndCategory(
    id: number,
    categoryCode: string,
  ): Promise<CodeValueRow | null> {
    const [row] = await this.db
      .select(codeValueSelect)
      .from(codeValue)
      .innerJoin(codeCategory, eq(codeValue.categoryFk, codeCategory.id))
      .where(
        and(
          eq(codeValue.id, id),
          eq(codeCategory.code, categoryCode),
          isNull(codeValue.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** Fetch a code_value by guuid and verify it belongs to categoryCode. */
  async findCodeValueByGuuidAndCategory(
    guuid: string,
    categoryCode: string,
  ): Promise<CodeValueRow & { numericId: number } | null> {
    const [row] = await this.db
      .select({ ...codeValueSelect, numericId: codeValue.id })
      .from(codeValue)
      .innerJoin(codeCategory, eq(codeValue.categoryFk, codeCategory.id))
      .where(
        and(
          eq(codeValue.guuid, guuid),
          eq(codeCategory.code, categoryCode),
          isNull(codeValue.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** Insert a new global code_value under a category */
  async createCodeValue(categoryId: number, dto: CreateLookupValueDto): Promise<typeof codeValue.$inferSelect> {
    const [row] = await this.db
      .insert(codeValue)
      .values({
        categoryFk: categoryId,
        code: dto.code,
        label: dto.label,
        description: dto.description ?? null,
        sortOrder: dto.sortOrder ?? null,
        isActive: true,
        isSystem: false,
      })
      .returning();
    return row;
  }

  /** Update label / description / sortOrder / isActive on a code_value */
  async updateCodeValue(id: number, dto: UpdateLookupValueDto): Promise<typeof codeValue.$inferSelect | null> {
    const set: Partial<typeof codeValue.$inferInsert> = {};
    if (dto.code !== undefined) set.code = dto.code;
    if (dto.label !== undefined) set.label = dto.label;
    if (dto.description !== undefined)
      set.description = dto.description ?? null;
    if (dto.sortOrder !== undefined) set.sortOrder = dto.sortOrder ?? null;

    const [row] = await this.db
      .update(codeValue)
      .set(set)
      .where(and(eq(codeValue.id, id), isNull(codeValue.deletedAt)))
      .returning();
    return row ?? null;
  }

  /** Soft-delete a code_value */
  async deleteCodeValue(id: number): Promise<typeof codeValue.$inferSelect | null> {
    const [row] = await this.db
      .update(codeValue)
      .set({ deletedAt: new Date(), isActive: false })
      .where(and(eq(codeValue.id, id), isNull(codeValue.deletedAt)))
      .returning();
    return row ?? null;
  }
}
