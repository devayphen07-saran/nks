import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, isNull, or, count, asc, desc } from 'drizzle-orm';
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

  /** Generic — replaces getSalutations / getAddressTypes / getDesignations / getStoreLegalTypes / getStoreCategories. */
  async getValuesByCategory(categoryCode: string, limit = DEFAULT_LOOKUP_PAGE_SIZE): Promise<CodeValueRow[]> {
    return this.db
      .select(codeValueSelect)
      .from(codeValue)
      .innerJoin(codeCategory, eq(codeValue.categoryFk, codeCategory.id))
      .where(
        and(
          eq(codeCategory.code, categoryCode),
          isNull(codeValue.storeFk),
          eq(codeValue.isActive, true),
          eq(codeValue.isHidden, false),
          isNull(codeValue.deletedAt),
        ),
      )
      .orderBy(codeValue.sortOrder)
      .limit(limit);
  }

  async getCountries(): Promise<CountryRow[]> {
    return this.db
      .select()
      .from(schema.country)
      .where(
        and(
          eq(schema.country.isActive, true),
          eq(schema.country.isHidden, false),
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
          eq(schema.communicationType.isHidden, false),
          isNull(schema.communicationType.deletedAt),
        ),
      )
      .orderBy(schema.communicationType.sortOrder);
  }

  async getCurrencies(): Promise<CurrencyRow[]> {
    return this.db
      .select()
      .from(currency)
      .where(
        and(
          eq(currency.isActive, true),
          eq(currency.isHidden, false),
          isNull(currency.deletedAt),
        ),
      )
      .orderBy(currency.sortOrder);
  }

  async getVolumes(): Promise<VolumesRow[]> {
    return this.db
      .select()
      .from(schema.volumes)
      .where(
        and(
          eq(schema.volumes.isActive, true),
          eq(schema.volumes.isHidden, false),
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

  /** Update label / description / sortOrder on a code_value (code is immutable after creation) */
  async updateCodeValue(id: number, dto: UpdateLookupValueDto): Promise<typeof codeValue.$inferSelect | null> {
    const set: Partial<typeof codeValue.$inferInsert> = {};
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

  // ─── Codes (admin CRUD on code_category + code_value) ────────────────────

  private getCategoryOrderColumn(sortBy: string = 'name') {
    switch (sortBy) {
      case 'code':      return codeCategory.code;
      case 'createdAt': return codeCategory.createdAt;
      default:          return codeCategory.name;
    }
  }

  private getCodeValueOrderColumn(sortBy: string = 'sortOrder') {
    switch (sortBy) {
      case 'code':      return codeValue.code;
      case 'label':     return codeValue.label;
      case 'createdAt': return codeValue.createdAt;
      default:          return codeValue.sortOrder;
    }
  }

  async findCategory(categoryCode: string): Promise<typeof codeCategory.$inferSelect | null> {
    const [row] = await this.db
      .select()
      .from(codeCategory)
      .where(and(eq(codeCategory.code, categoryCode), eq(codeCategory.isActive, true), isNull(codeCategory.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findAllCategories(opts: {
    page: number; pageSize: number; search?: string; sortBy?: string; sortOrder?: string; isActive?: boolean;
  }): Promise<{ rows: typeof codeCategory.$inferSelect[]; total: number }> {
    const { page, pageSize, search, sortBy = 'name', sortOrder = 'asc', isActive } = opts;
    const offset = LookupsRepository.toOffset(page, pageSize);
    const activeFilter = isActive === undefined ? true : isActive;
    const where = and(
      eq(codeCategory.isActive, activeFilter),
      isNull(codeCategory.deletedAt),
      ilikeAny(search, codeCategory.name, codeCategory.code),
    );
    return this.paginate(
      this.db.select().from(codeCategory).where(where)
        .orderBy(this.applySortDirection(this.getCategoryOrderColumn(sortBy), sortOrder))
        .limit(pageSize).offset(offset),
      () => this.db.select({ total: count() }).from(codeCategory).where(where),
      page, pageSize,
    );
  }

  async findValueById(id: number): Promise<typeof codeValue.$inferSelect | null> {
    const [row] = await this.db
      .select().from(codeValue)
      .where(and(eq(codeValue.id, id), isNull(codeValue.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findValueByIdWithStore(id: number): Promise<{ id: number; guuid: string; code: string; label: string; description: string | null; sortOrder: number | null; isSystem: boolean; storeGuuid: string | null } | null> {
    const [row] = await this.db
      .select({
        id: codeValue.id, guuid: codeValue.guuid, code: codeValue.code,
        label: codeValue.label, description: codeValue.description,
        sortOrder: codeValue.sortOrder, isSystem: codeValue.isSystem,
        storeGuuid: schema.store.guuid,
      })
      .from(codeValue)
      .leftJoin(schema.store, eq(codeValue.storeFk, schema.store.id))
      .where(and(eq(codeValue.id, id), isNull(codeValue.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findStoreIdByGuuid(guuid: string): Promise<number | null> {
    const [row] = await this.db
      .select({ id: schema.store.id })
      .from(schema.store)
      .where(eq(schema.store.guuid, guuid))
      .limit(1);
    return row?.id ?? null;
  }

  async findValueByGuuid(guuid: string): Promise<typeof codeValue.$inferSelect | null> {
    const [row] = await this.db
      .select().from(codeValue)
      .where(and(eq(codeValue.guuid, guuid), isNull(codeValue.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findValuesByCategory(
    categoryId: number,
    opts: { page: number; pageSize: number; storeId?: number; search?: string; sortBy?: string; sortOrder?: string; isActive?: boolean },
  ): Promise<{ rows: { id: number; guuid: string; code: string; label: string; description: string | null; sortOrder: number | null; isSystem: boolean; storeGuuid: string | null }[]; total: number }> {
    const { page, pageSize, storeId, search, sortBy = 'sortOrder', sortOrder = 'asc', isActive } = opts;
    const offset = LookupsRepository.toOffset(page, pageSize);
    const activeFilter = isActive === undefined ? true : isActive;
    const storeFilter = storeId
      ? or(isNull(codeValue.storeFk), eq(codeValue.storeFk, storeId))
      : isNull(codeValue.storeFk);
    const where = and(
      eq(codeValue.categoryFk, categoryId),
      eq(codeValue.isActive, activeFilter),
      eq(codeValue.isHidden, false),
      storeFilter,
      ilikeAny(search, codeValue.label, codeValue.code),
    );
    return this.paginate(
      this.db
        .select({ id: codeValue.id, guuid: codeValue.guuid, code: codeValue.code, label: codeValue.label, description: codeValue.description, sortOrder: codeValue.sortOrder, isSystem: codeValue.isSystem, storeGuuid: schema.store.guuid })
        .from(codeValue)
        .leftJoin(schema.store, eq(codeValue.storeFk, schema.store.id))
        .where(where)
        .orderBy(this.applySortDirection(this.getCodeValueOrderColumn(sortBy), sortOrder))
        .limit(pageSize).offset(offset),
      () => this.db.select({ total: count() }).from(codeValue).where(where),
      page, pageSize,
    );
  }

  async createCategory(data: typeof codeCategory.$inferInsert): Promise<typeof codeCategory.$inferSelect> {
    const [created] = await this.db.insert(codeCategory).values(data).returning();
    return created;
  }

  async createValue(data: typeof codeValue.$inferInsert): Promise<typeof codeValue.$inferSelect> {
    const [created] = await this.db.insert(codeValue).values(data).returning();
    return created;
  }

  async updateValue(id: number, data: Partial<typeof codeValue.$inferInsert>): Promise<typeof codeValue.$inferSelect | null> {
    const [updated] = await this.db
      .update(codeValue).set(data)
      .where(and(eq(codeValue.id, id), eq(codeValue.isActive, true), eq(codeValue.isSystem, false)))
      .returning();
    return updated ?? null;
  }

  async softDeleteValue(id: number, deletedBy: number): Promise<boolean> {
    const [row] = await this.db
      .update(codeValue)
      .set({ isActive: false, deletedAt: new Date(), deletedBy })
      .where(and(eq(codeValue.id, id), eq(codeValue.isActive, true), eq(codeValue.isSystem, false), isNull(codeValue.deletedAt)))
      .returning({ id: codeValue.id });
    return !!row;
  }
}
