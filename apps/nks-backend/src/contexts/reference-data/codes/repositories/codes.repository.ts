import { Injectable } from '@nestjs/common';
import { and, eq, or, isNull, count, asc, desc } from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm/column';
import { ilikeAny } from '../../../../core/database/query-helpers';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';
import { codeCategory } from '../../../../core/database/schema/lookups/code-category/code-category.table';
import { codeValue } from '../../../../core/database/schema/lookups/code-value/code-value.table';
  
type CodeCategory = typeof codeCategory.$inferSelect;
type CodeValue = typeof codeValue.$inferSelect;

@Injectable()
export class CodesRepository extends BaseRepository {
  constructor(@InjectDb() db: NodePgDatabase<typeof schema>) { super(db); }

  /**
   * Phase 1: Helper to map sortBy enum to code category column
   */
  private getCategoryOrderColumn(sortBy: string = 'name') {
    switch (sortBy) {
      case 'code':
        return codeCategory.code;
      case 'createdAt':
        return codeCategory.createdAt;
      case 'name':
      default:
        return codeCategory.name;
    }
  }

  /**
   * Phase 1: Helper to map sortBy enum to code value column
   */
  private applySortDirection(column: AnyColumn, sortOrder: string = 'asc') {
    return sortOrder === 'desc' ? desc(column) : asc(column);
  }

  private getValueOrderColumn(sortBy: string = 'sortOrder') {
    switch (sortBy) {
      case 'code':
        return codeValue.code;
      case 'label':
        return codeValue.label;
      case 'createdAt':
        return codeValue.createdAt;
      case 'sortOrder':
      default:
        return codeValue.sortOrder;
    }
  }

  async findCategory(categoryCode: string): Promise<CodeCategory | null> {
    const [row] = await this.db
      .select()
      .from(codeCategory)
      .where(
        and(
          eq(codeCategory.code, categoryCode),
          eq(codeCategory.isActive, true),
          isNull(codeCategory.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findAllCategories(opts: {
    page:     number;
    pageSize: number;
    search?:  string;
    sortBy?:  string;
    sortOrder?: string;
    isActive?: boolean;
  }): Promise<{ rows: CodeCategory[]; total: number }> {
    const { page, pageSize, search, sortBy = 'name', sortOrder = 'asc', isActive } = opts;
    const offset = CodesRepository.toOffset(page, pageSize);
    const categoryActiveFilter = isActive === undefined ? true : isActive;

    const where = and(
      eq(codeCategory.isActive, categoryActiveFilter),
      isNull(codeCategory.deletedAt),
      ilikeAny(search, codeCategory.name, codeCategory.code),
    );

    return this.paginate(
      this.db
        .select()
        .from(codeCategory)
        .where(where)
        .orderBy(this.applySortDirection(this.getCategoryOrderColumn(sortBy), sortOrder))
        .limit(pageSize)
        .offset(offset),
      () => this.db.select({ total: count() }).from(codeCategory).where(where),
      page, pageSize,
    );
  }

  async findValueById(id: number): Promise<CodeValue | null> {
    const [row] = await this.db
      .select()
      .from(codeValue)
      .where(and(eq(codeValue.id, id), isNull(codeValue.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findValueByIdWithStore(id: number): Promise<{ id: number; guuid: string; code: string; label: string; description: string | null; sortOrder: number | null; isSystem: boolean; storeGuuid: string | null } | null> {
    const [row] = await this.db
      .select({
        id: codeValue.id,
        guuid: codeValue.guuid,
        code: codeValue.code,
        label: codeValue.label,
        description: codeValue.description,
        sortOrder: codeValue.sortOrder,
        isSystem: codeValue.isSystem,
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

  async findValueByGuuid(guuid: string): Promise<CodeValue | null> {
    const [row] = await this.db
      .select()
      .from(codeValue)
      .where(and(eq(codeValue.guuid, guuid), isNull(codeValue.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  /**
   * Return all active values for a category.
   * storeId = null  → global values only
   * storeId = X     → global values + store-scoped values for that store
   * Phase 1: Added sortBy and isActive filters
   */
  async findValuesByCategory(
    categoryId: number,
    opts: {
      page:      number;
      pageSize:  number;
      storeId?:  number;
      search?:   string;
      sortBy?:   string;
      sortOrder?: string;
      isActive?: boolean;
    },
  ): Promise<{ rows: { id: number; guuid: string; code: string; label: string; description: string | null; sortOrder: number | null; isSystem: boolean; storeGuuid: string | null }[]; total: number }> {
    const { page, pageSize, storeId, search, sortBy = 'sortOrder', sortOrder = 'asc', isActive } = opts;
    const offset = CodesRepository.toOffset(page, pageSize);
    const valueActiveFilter = isActive === undefined ? true : isActive;

    const storeFilter = storeId
      ? or(isNull(codeValue.storeFk), eq(codeValue.storeFk, storeId))
      : isNull(codeValue.storeFk);

    const where = and(
      eq(codeValue.categoryFk, categoryId),
      eq(codeValue.isActive, valueActiveFilter),
      eq(codeValue.isHidden, false),
      storeFilter,
      ilikeAny(search, codeValue.label, codeValue.code),
    );

    return this.paginate(
      this.db
        .select({
          id: codeValue.id,
          guuid: codeValue.guuid,
          code: codeValue.code,
          label: codeValue.label,
          description: codeValue.description,
          sortOrder: codeValue.sortOrder,
          isSystem: codeValue.isSystem,
          storeGuuid: schema.store.guuid,
        })
        .from(codeValue)
        .leftJoin(schema.store, eq(codeValue.storeFk, schema.store.id))
        .where(where)
        .orderBy(this.applySortDirection(this.getValueOrderColumn(sortBy), sortOrder))
        .limit(pageSize)
        .offset(offset),
      () => this.db.select({ total: count() }).from(codeValue).where(where),
      page, pageSize,
    );
  }

  async createCategory(
    data: typeof codeCategory.$inferInsert,
  ): Promise<CodeCategory> {
    const [created] = await this.db
      .insert(codeCategory)
      .values(data)
      .returning();
    return created;
  }

  async createValue(data: typeof codeValue.$inferInsert): Promise<CodeValue> {
    const [created] = await this.db.insert(codeValue).values(data).returning();
    return created;
  }

  async updateValue(
    id: number,
    data: Partial<typeof codeValue.$inferInsert>,
  ): Promise<CodeValue | null> {
    const [updated] = await this.db
      .update(codeValue)
      .set(data)
      .where(
        and(
          eq(codeValue.id, id),
          eq(codeValue.isActive, true),
          eq(codeValue.isSystem, false),
        ),
      )
      .returning();
    return updated ?? null;
  }

  async softDeleteValue(id: number, deletedBy: number): Promise<boolean> {
    const [row] = await this.db
      .update(codeValue)
      .set({ isActive: false, deletedAt: new Date(), deletedBy })
      .where(
        and(
          eq(codeValue.id, id),
          eq(codeValue.isActive, true),
          eq(codeValue.isSystem, false),
          isNull(codeValue.deletedAt),
        ),
      )
      .returning({ id: codeValue.id });
    return !!row;
  }
}
