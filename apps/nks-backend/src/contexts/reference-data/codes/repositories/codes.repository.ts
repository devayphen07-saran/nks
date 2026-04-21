import { Injectable } from '@nestjs/common';
import { and, eq, or, isNull, count } from 'drizzle-orm';
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
    page:    number;
    pageSize: number;
    search?: string;
  }): Promise<{ rows: CodeCategory[]; total: number }> {
    const { page, pageSize, search } = opts;
    const offset = (page - 1) * pageSize;

    const where = and(
      eq(codeCategory.isActive, true),
      isNull(codeCategory.deletedAt),
      ilikeAny(search, codeCategory.name, codeCategory.code),
    );

    return this.paginate(
      this.db.select().from(codeCategory).where(where).orderBy(codeCategory.sortOrder).limit(pageSize).offset(offset),
      this.db.select({ total: count() }).from(codeCategory).where(where),
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

  /**
   * Return all active values for a category.
   * storeId = null  → global values only
   * storeId = X     → global values + store-scoped values for that store
   */
  async findValuesByCategory(
    categoryId: number,
    opts: { page: number; pageSize: number; storeId?: number; search?: string },
  ): Promise<{ rows: CodeValue[]; total: number }> {
    const { page, pageSize, storeId, search } = opts;
    const offset = (page - 1) * pageSize;

    const storeFilter = storeId
      ? or(isNull(codeValue.storeFk), eq(codeValue.storeFk, storeId))
      : isNull(codeValue.storeFk);

    const where = and(
      eq(codeValue.categoryFk, categoryId),
      eq(codeValue.isActive, true),
      eq(codeValue.isHidden, false),
      storeFilter,
      ilikeAny(search, codeValue.label, codeValue.code),
    );

    return this.paginate(
      this.db.select().from(codeValue).where(where).orderBy(codeValue.sortOrder).limit(pageSize).offset(offset),
      this.db.select({ total: count() }).from(codeValue).where(where),
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
