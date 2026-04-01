import { Injectable } from '@nestjs/common';
import { InjectDb } from '../../core/database/inject-db.decorator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../core/database/schema';
import { eq, like, desc, asc, count, or } from 'drizzle-orm';
import {
  AdminPaginationInput,
  UpdateAdminUserInput,
  UpdateAdminStoreInput,
  AdminUserResponse,
  AdminStoreResponse,
} from './admin.schemas';
import { NotFoundException } from '../../common/exceptions';
import { ErrorCode } from '../../common/constants/error-codes.constants';

@Injectable()
export class AdminService {
  constructor(
    @InjectDb() private readonly database: NodePgDatabase<typeof schema>,
  ) {}

  // ──── Users Management ────

  async listUsers(pagination: AdminPaginationInput): Promise<{
    data: AdminUserResponse[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const {
      page,
      pageSize,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = pagination;
    const offset = (page - 1) * pageSize;

    // Build WHERE clause with search
    let whereConditions: any = undefined;
    if (search) {
      const searchPattern = `%${search}%`;
      whereConditions = or(
        like(schema.users.name, searchPattern),
        like(schema.users.email, searchPattern),
        like(schema.users.phoneNumber, searchPattern),
      );
    }

    // Get total count
    const countResult = await this.database
      .select({ count: count() })
      .from(schema.users)
      .where(whereConditions);

    const total = countResult[0]?.count ?? 0;

    // Determine sort column and direction
    const sortColumn =
      sortBy === 'name'
        ? schema.users.name
        : sortBy === 'email'
          ? schema.users.email
          : sortBy === 'phoneNumber'
            ? schema.users.phoneNumber
            : sortBy === 'loginCount'
              ? schema.users.loginCount
              : schema.users.createdAt;

    const orderBy = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Fetch paginated results
    const users = await this.database
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        phoneNumber: schema.users.phoneNumber,
        emailVerified: schema.users.emailVerified,
        phoneNumberVerified: schema.users.phoneNumberVerified,
        isBlocked: schema.users.isBlocked,
        loginCount: schema.users.loginCount,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
      })
      .from(schema.users)
      .where(whereConditions)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset);

    // Convert dates to ISO strings
    const mappedUsers = users.map((user) => ({
      ...user,
      createdAt: user.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: user.updatedAt?.toISOString() ?? new Date().toISOString(),
    }));

    return {
      data: mappedUsers as AdminUserResponse[],
      total,
      page,
      pageSize,
    };
  }

  async getUserById(userId: number): Promise<AdminUserResponse> {
    const user = await this.database
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        phoneNumber: schema.users.phoneNumber,
        emailVerified: schema.users.emailVerified,
        phoneNumberVerified: schema.users.phoneNumberVerified,
        isBlocked: schema.users.isBlocked,
        loginCount: schema.users.loginCount,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user || user.length === 0) {
      throw new NotFoundException({
        errorCode: ErrorCode.USER_NOT_FOUND,
        message: 'User not found',
      });
    }

    const userData = user[0];
    return {
      ...userData,
      createdAt: userData.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: userData.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  async updateUser(
    userId: number,
    dto: UpdateAdminUserInput,
  ): Promise<AdminUserResponse> {
    // Verify user exists first
    await this.getUserById(userId);

    // Build update object with only provided fields
    const updateData: Record<string, any> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.isBlocked !== undefined) updateData.isBlocked = dto.isBlocked;
    if (dto.emailVerified !== undefined)
      updateData.emailVerified = dto.emailVerified;
    if (dto.phoneNumberVerified !== undefined)
      updateData.phoneNumberVerified = dto.phoneNumberVerified;
    updateData.updatedAt = new Date();

    await this.database
      .update(schema.users)
      .set(updateData)
      .where(eq(schema.users.id, userId));

    // Return updated user
    return this.getUserById(userId);
  }

  // ──── Stores Management ────

  async listStores(pagination: AdminPaginationInput): Promise<{
    data: AdminStoreResponse[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const {
      page,
      pageSize,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = pagination;
    const offset = (page - 1) * pageSize;

    // Build WHERE clause with search
    let whereConditions: any = undefined;
    if (search) {
      const searchPattern = `%${search}%`;
      whereConditions = or(
        like(schema.store.storeName, searchPattern),
        like(schema.store.storeCode, searchPattern),
      );
    }

    // Get total count
    const countResult = await this.database
      .select({ count: count() })
      .from(schema.store)
      .where(whereConditions);

    const total = countResult[0]?.count ?? 0;

    // Determine sort column and direction
    const sortColumn =
      sortBy === 'storeName'
        ? schema.store.storeName
        : sortBy === 'storeCode'
          ? schema.store.storeCode
          : schema.store.createdAt;

    const orderBy = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Fetch paginated results
    const stores = await this.database
      .select({
        id: schema.store.id,
        storeCode: schema.store.storeCode,
        storeName: schema.store.storeName,
        storeLegalTypeFk: schema.store.storeLegalTypeFk,
        storeCategoryFk: schema.store.storeCategoryFk,
        registrationNumber: schema.store.registrationNumber,
        taxNumber: schema.store.taxNumber,
        deletedAt: schema.store.deletedAt,
        createdAt: schema.store.createdAt,
        updatedAt: schema.store.updatedAt,
      })
      .from(schema.store)
      .where(whereConditions)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset);

    // Convert to response format
    const mappedStores = stores.map((store) => ({
      id: store.id,
      storeCode: store.storeCode ?? '',
      storeName: store.storeName,
      storeLegalTypeFk: store.storeLegalTypeFk,
      storeCategoryFk: store.storeCategoryFk,
      registrationNumber: store.registrationNumber ?? null,
      taxNumber: store.taxNumber ?? null,
      isDeleted: store.deletedAt !== null,
      createdAt: store.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: store.updatedAt?.toISOString() ?? new Date().toISOString(),
    }));

    return {
      data: mappedStores as AdminStoreResponse[],
      total,
      page,
      pageSize,
    };
  }

  async getStoreById(storeId: number): Promise<AdminStoreResponse> {
    const store = await this.database
      .select({
        id: schema.store.id,
        storeCode: schema.store.storeCode,
        storeName: schema.store.storeName,
        storeLegalTypeFk: schema.store.storeLegalTypeFk,
        storeCategoryFk: schema.store.storeCategoryFk,
        registrationNumber: schema.store.registrationNumber,
        taxNumber: schema.store.taxNumber,
        deletedAt: schema.store.deletedAt,
        createdAt: schema.store.createdAt,
        updatedAt: schema.store.updatedAt,
      })
      .from(schema.store)
      .where(eq(schema.store.id, storeId))
      .limit(1);

    if (!store || store.length === 0) {
      throw new NotFoundException({
        errorCode: ErrorCode.NOT_FOUND,
        message: 'Store not found',
      });
    }

    const storeData = store[0];
    return {
      id: storeData.id,
      storeCode: storeData.storeCode ?? '',
      storeName: storeData.storeName,
      storeLegalTypeFk: storeData.storeLegalTypeFk,
      storeCategoryFk: storeData.storeCategoryFk,
      registrationNumber: storeData.registrationNumber ?? null,
      taxNumber: storeData.taxNumber ?? null,
      isDeleted: storeData.deletedAt !== null,
      createdAt: storeData.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: storeData.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  async updateStore(
    storeId: number,
    dto: UpdateAdminStoreInput,
  ): Promise<AdminStoreResponse> {
    // Verify store exists first
    await this.getStoreById(storeId);

    // Build update object with only provided fields
    const updateData: Record<string, any> = {};
    if (dto.storeName !== undefined) updateData.storeName = dto.storeName;
    if (dto.registrationNumber !== undefined)
      updateData.registrationNumber = dto.registrationNumber;
    if (dto.taxNumber !== undefined) updateData.taxNumber = dto.taxNumber;
    updateData.updatedAt = new Date();

    await this.database
      .update(schema.store)
      .set(updateData)
      .where(eq(schema.store.id, storeId));

    // Return updated store
    return this.getStoreById(storeId);
  }
}
