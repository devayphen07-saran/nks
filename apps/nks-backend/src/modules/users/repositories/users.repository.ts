import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../core/database/schema';
import { userRoleMapping } from '../../../core/database/schema/auth/user-role-mapping';
import { eq, and, or, ilike, isNull, count, desc } from 'drizzle-orm';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import type { UserRow } from '../dto';

@Injectable()
export class UsersRepository {
  constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}

  /**
   * List all users with optional search and pagination.
   * Joins user_role_mapping to surface the primary role code.
   */
  async findAll(opts: {
    page:     number;
    pageSize: number;
    search?:  string;
  }): Promise<{ rows: UserRow[]; total: number }> {
    const { page, pageSize, search } = opts;
    const offset = (page - 1) * pageSize;

    const searchFilter = search?.trim()
      ? or(
          ilike(schema.users.name,        `%${search}%`),
          ilike(schema.users.email,       `%${search}%`),
          ilike(schema.users.phoneNumber, `%${search}%`),
        )
      : undefined;

    const where = and(isNull(schema.users.deletedAt), searchFilter);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          guuid:               schema.users.guuid,
          name:                schema.users.name,
          email:               schema.users.email,
          emailVerified:       schema.users.emailVerified,
          phoneNumber:         schema.users.phoneNumber,
          phoneNumberVerified: schema.users.phoneNumberVerified,
          image:               schema.users.image,
          isBlocked:           schema.users.isBlocked,
          blockedReason:       schema.users.blockedReason,
          primaryLoginMethod:  schema.users.primaryLoginMethod,
          loginCount:          schema.users.loginCount,
          lastLoginAt:         schema.users.lastLoginAt,
          profileCompleted:    schema.users.profileCompleted,
          isActive:            schema.users.isActive,
          createdAt:           schema.users.createdAt,
          primaryRole:         schema.roles.code,
        })
        .from(schema.users)
        .leftJoin(
          userRoleMapping,
          and(
            eq(userRoleMapping.userFk,   schema.users.id),
            eq(userRoleMapping.isPrimary, true),
            eq(userRoleMapping.isActive,  true),
            isNull(userRoleMapping.deletedAt),
          ),
        )
        .leftJoin(schema.roles, eq(userRoleMapping.roleFk, schema.roles.id))
        .where(where)
        .orderBy(desc(schema.users.createdAt))
        .limit(pageSize)
        .offset(offset),

      this.db
        .select({ total: count() })
        .from(schema.users)
        .where(where),
    ]);

    return { rows, total };
  }
}
