import { Injectable } from '@nestjs/common';
import { and, eq, isNull, or } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../core/database/inject-db.decorator';
import * as schema from '../../core/database/schema';
import { codeCategory } from '../../core/database/schema/lookups/code-category/code-category.table';
import { codeValue } from '../../core/database/schema/lookups/code-value/code-value.table';

type CodeCategory = typeof codeCategory.$inferSelect;
type CodeValue = typeof codeValue.$inferSelect;

@Injectable()
export class CodesRepository {
  constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}

  async findCategory(categoryCode: string): Promise<CodeCategory | null> {
    const [row] = await this.db
      .select()
      .from(codeCategory)
      .where(
        and(
          eq(codeCategory.code, categoryCode),
          eq(codeCategory.isActive, true),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findAllCategories(): Promise<CodeCategory[]> {
    return this.db
      .select()
      .from(codeCategory)
      .where(eq(codeCategory.isActive, true))
      .orderBy(codeCategory.sortOrder);
  }

  /**
   * Return all active values for a category.
   * storeId = null  → global values only
   * storeId = X     → global values + store-scoped values for that store
   */
  async findValuesByCategory(categoryId: number, storeId?: number): Promise<CodeValue[]> {
    const storeFilter = storeId
      ? or(isNull(codeValue.storeFk), eq(codeValue.storeFk, storeId))
      : isNull(codeValue.storeFk);

    return this.db
      .select()
      .from(codeValue)
      .where(
        and(
          eq(codeValue.categoryFk, categoryId),
          eq(codeValue.isActive, true),
          eq(codeValue.isHidden, false),
          storeFilter,
        ),
      )
      .orderBy(codeValue.sortOrder);
  }

  async createCategory(data: typeof codeCategory.$inferInsert): Promise<CodeCategory> {
    const [created] = await this.db
      .insert(codeCategory)
      .values(data)
      .returning();
    return created;
  }

  async createValue(data: typeof codeValue.$inferInsert): Promise<CodeValue> {
    const [created] = await this.db
      .insert(codeValue)
      .values(data)
      .returning();
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

  async softDeleteValue(id: number, deletedBy: number): Promise<void> {
    await this.db
      .update(codeValue)
      .set({ isActive: false, deletedAt: new Date(), deletedBy })
      .where(
        and(
          eq(codeValue.id, id),
          eq(codeValue.isActive, true),
          eq(codeValue.isSystem, false),
        ),
      );
  }
}
