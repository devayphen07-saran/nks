import { Injectable } from '@nestjs/common';
import * as schema from '../../core/database/schema';
import { eq, and } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { alias } from 'drizzle-orm/pg-core';

type Tx = NodePgDatabase<typeof schema>;

@Injectable()
export class StoreRepository {
  constructor(@InjectDb() private readonly db: Tx) {}

  /**
   * Create a store and return the ID.
   * WITH tx? - Write operation.
   */
  async create(data: typeof schema.store.$inferInsert, tx?: Tx) {
    const client = tx ?? this.db;
    const [inserted] = await client
      .insert(schema.store)
      .values(data)
      .returning();
    return inserted;
  }

  /**
   * Find active store type by code.
   * No tx? - Read only.
   */
  async findLegalTypeByCode(code: string) {
    const [result] = await this.db
      .select()
      .from(schema.storeLegalType)
      .where(
        and(
          eq(schema.storeLegalType.legalTypeCode, code),
          eq(schema.storeLegalType.isActive, true),
        ),
      )
      .limit(1);
    return result || null;
  }

  async findCategoryByCode(code: string) {
    const [result] = await this.db
      .select()
      .from(schema.storeCategory)
      .where(
        and(
          eq(schema.storeCategory.categoryCode, code),
          eq(schema.storeCategory.isActive, true),
        ),
      )
      .limit(1);
    return result || null;
  }

  /**
   * Create a user-role-store mapping.
   * WITH tx? - Write operation.
   */
  async addUserToStore(
    data: typeof schema.userRoleMapping.$inferInsert,
    tx?: Tx,
  ) {
    const client = tx ?? this.db;
    await client.insert(schema.userRoleMapping).values(data);
  }

  /**
   * Find all stores owned by a user (STORE_OWNER role mappings).
   */
  async findUserOwnedStores(userId: number) {
    const ownerRole = alias(schema.roles, 'ownerRole');
    const rows = await this.db
      .select({
        id: schema.store.id,
        storeName: schema.store.storeName,
        storeCode: schema.store.storeCode,
        isActive: schema.store.isActive,
        createdAt: schema.store.createdAt,
      })
      .from(schema.store)
      .innerJoin(
        schema.userRoleMapping,
        and(
          eq(schema.userRoleMapping.userFk, userId),
          eq(schema.userRoleMapping.storeFk, schema.store.id),
        ),
      )
      .innerJoin(ownerRole, eq(ownerRole.id, schema.userRoleMapping.roleFk))
      .where(eq(ownerRole.code, 'STORE_OWNER'));
    return rows;
  }

  /**
   * Find all stores a user was invited to as staff.
   */
  async findUserInvitedStores(userId: number) {
    const staffRoles = ['STORE_MANAGER', 'CASHIER', 'DELIVERY'];
    const staffRole = alias(schema.roles, 'staffRole');
    const rows = await this.db
      .select({
        id: schema.store.id,
        storeName: schema.store.storeName,
        storeCode: schema.store.storeCode,
        isActive: schema.store.isActive,
        createdAt: schema.store.createdAt,
        roleName: staffRole.roleName,
        roleCode: staffRole.code,
      })
      .from(schema.store)
      .innerJoin(
        schema.userRoleMapping,
        and(
          eq(schema.userRoleMapping.userFk, userId),
          eq(schema.userRoleMapping.storeFk, schema.store.id),
        ),
      )
      .innerJoin(staffRole, eq(staffRole.id, schema.userRoleMapping.roleFk));

    return rows.filter((r) => staffRoles.includes(r.roleCode));
  }

  /**
   * Find all stores accessible to a user (owned or staff access) with pagination.
   * Used by mobile app for store selection.
   */
  async findAccessibleStores(
    userId: number,
    page: number = 1,
    pageSize: number = 20,
  ) {
    const offset = (page - 1) * pageSize;
    const ownerRole = alias(schema.roles, 'ownerRole');
    const staffRole = alias(schema.roles, 'staffRole');

    // Get stores user owns (STORE_OWNER)
    const ownedStores = await this.db
      .select({
        id: schema.store.id,
        storeName: schema.store.storeName,
        storeCode: schema.store.storeCode,
        isActive: schema.store.isActive,
        createdAt: schema.store.createdAt,
      })
      .from(schema.store)
      .innerJoin(
        schema.userRoleMapping,
        and(
          eq(schema.userRoleMapping.userFk, userId),
          eq(schema.userRoleMapping.storeFk, schema.store.id),
        ),
      )
      .innerJoin(ownerRole, eq(ownerRole.id, schema.userRoleMapping.roleFk))
      .where(eq(ownerRole.code, 'STORE_OWNER'));

    // Get stores user has staff access to
    const staffRoles = ['STORE_MANAGER', 'CASHIER', 'DELIVERY'];
    const staffStoresRaw = await this.db
      .select({
        id: schema.store.id,
        storeName: schema.store.storeName,
        storeCode: schema.store.storeCode,
        isActive: schema.store.isActive,
        createdAt: schema.store.createdAt,
        roleCode: staffRole.code,
      })
      .from(schema.store)
      .innerJoin(
        schema.userRoleMapping,
        and(
          eq(schema.userRoleMapping.userFk, userId),
          eq(schema.userRoleMapping.storeFk, schema.store.id),
        ),
      )
      .innerJoin(staffRole, eq(staffRole.id, schema.userRoleMapping.roleFk));

    // Filter for staff roles only
    const staffStores = staffStoresRaw
      .filter((r) => staffRoles.includes(r.roleCode))
      .map(({ roleCode, ...store }) => store);

    // Combine and deduplicate by ID
    const allStores = [...ownedStores, ...staffStores];
    const uniqueStores = Array.from(
      new Map(allStores.map((s) => [s.id, s])).values(),
    );

    // Apply pagination
    const paginatedStores = uniqueStores.slice(offset, offset + pageSize);
    const total = uniqueStores.length;

    return {
      items: paginatedStores,
      total,
      page,
      pageSize,
    };
  }

  /**
   * Find a single store by ID. Returns null if not found.
   */
  async findById(storeId: number) {
    const [result] = await this.db
      .select({
        id: schema.store.id,
        storeName: schema.store.storeName,
        storeCode: schema.store.storeCode,
        isActive: schema.store.isActive,
        createdAt: schema.store.createdAt,
      })
      .from(schema.store)
      .where(eq(schema.store.id, storeId))
      .limit(1);
    return result || null;
  }
}
