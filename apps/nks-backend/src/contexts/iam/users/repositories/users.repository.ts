import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../../core/database/schema';
import { userRoleMapping } from '../../../../core/database/schema/auth/user-role-mapping';
import { eq, and, isNull, count, asc, desc, or } from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm/column';
import {
  ilikeAny,
  ilikeFullName,
} from '../../../../core/database/query-helpers';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import type { UserRow } from '../dto';

@Injectable()
export class UsersRepository extends BaseRepository {
  constructor(@InjectDb() db: NodePgDatabase<typeof schema>) {
    super(db);
  }

  /**
   * Fetch a single active user by their external `iamUserId` — the identity
   * key used by ayphen clients in REST paths like `/users/:iamUserId`.
   *
   * Mirrors ayphen's `findByIamUserIdAndIsActiveTrue(String iamUserId)`:
   * soft-deleted users are filtered out so deactivated accounts don't leak.
   */
  async findByIamUserId(iamUserId: string): Promise<UserRow | null> {
    const [row] = await this.db
      .select({
        guuid: schema.users.guuid,
        iamUserId: schema.users.iamUserId,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        email: schema.users.email,
        emailVerified: schema.users.emailVerified,
        phoneNumber: schema.users.phoneNumber,
        phoneNumberVerified: schema.users.phoneNumberVerified,
        image: schema.users.image,
        isBlocked: schema.users.isBlocked,
        blockedReason: schema.users.blockedReason,
        primaryLoginMethod: schema.users.primaryLoginMethod,
        loginCount: schema.users.loginCount,
        lastLoginAt: schema.users.lastLoginAt,
        profileCompleted: schema.users.profileCompleted,
        isActive: schema.users.isActive,
        createdAt: schema.users.createdAt,
        primaryRole: schema.roles.code,
      })
      .from(schema.users)
      .leftJoin(
        userRoleMapping,
        and(
          eq(userRoleMapping.userFk, schema.users.id),
          eq(userRoleMapping.isPrimary, true),
          eq(userRoleMapping.isActive, true),
          isNull(userRoleMapping.deletedAt),
        ),
      )
      .leftJoin(schema.roles, eq(userRoleMapping.roleFk, schema.roles.id))
      .where(
        and(
          eq(schema.users.iamUserId, iamUserId),
          isNull(schema.users.deletedAt),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  private getUserOrderColumn(sortBy: string = 'createdAt') {
    switch (sortBy) {
      case 'firstName':
        return schema.users.firstName;
      case 'email':
        return schema.users.email;
      case 'createdAt':
      default:
        return schema.users.createdAt;
    }
  }

  private applySortDirection(column: AnyColumn, sortOrder: string = 'desc') {
    return sortOrder === 'desc' ? desc(column) : asc(column);
  }

  /**
   * List all users with optional search, pagination, sorting, and active filter.
   * Joins user_role_mapping to surface the primary role code.
   */
  async findPage(opts: {
    page: number;
    pageSize: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    isActive?: boolean;
  }): Promise<{ rows: UserRow[]; total: number }> {
    const {
      page,
      pageSize,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      isActive,
    } = opts;
    const offset = UsersRepository.toOffset(page, pageSize);

    const searchFilter = or(
      ilikeAny(
        search,
        schema.users.firstName,
        schema.users.lastName,
        schema.users.email,
        schema.users.phoneNumber,
      ),
      ilikeFullName(search, schema.users.firstName, schema.users.lastName),
    );

    const where = and(
      isNull(schema.users.deletedAt),
      isActive !== undefined ? eq(schema.users.isActive, isActive) : undefined,
      searchFilter,
    );

    return this.paginate(
      this.db
        .select({
          guuid: schema.users.guuid,
          iamUserId: schema.users.iamUserId,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          email: schema.users.email,
          emailVerified: schema.users.emailVerified,
          phoneNumber: schema.users.phoneNumber,
          phoneNumberVerified: schema.users.phoneNumberVerified,
          image: schema.users.image,
          isBlocked: schema.users.isBlocked,
          blockedReason: schema.users.blockedReason,
          primaryLoginMethod: schema.users.primaryLoginMethod,
          loginCount: schema.users.loginCount,
          lastLoginAt: schema.users.lastLoginAt,
          profileCompleted: schema.users.profileCompleted,
          isActive: schema.users.isActive,
          createdAt: schema.users.createdAt,
          primaryRole: schema.roles.code,
        })
        .from(schema.users)
        .leftJoin(
          userRoleMapping,
          and(
            eq(userRoleMapping.userFk, schema.users.id),
            eq(userRoleMapping.isPrimary, true),
            eq(userRoleMapping.isActive, true),
            isNull(userRoleMapping.deletedAt),
          ),
        )
        .leftJoin(schema.roles, eq(userRoleMapping.roleFk, schema.roles.id))
        .where(where)
        .orderBy(
          this.applySortDirection(this.getUserOrderColumn(sortBy), sortOrder),
        )
        .limit(pageSize)
        .offset(offset),
      () => this.db.select({ total: count() }).from(schema.users).where(where),
      page, pageSize,
    );
  }
}
