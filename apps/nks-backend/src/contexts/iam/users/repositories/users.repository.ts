import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../../core/database/schema';
import { userRoleMapping } from '../../../../core/database/schema/auth/user-role-mapping';
import { eq, and, isNull, count, desc } from 'drizzle-orm';
import { ilikeAny } from '../../../../core/database/query-helpers';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import type { UserRow } from '../dto';

@Injectable()
export class UsersRepository extends BaseRepository {
  constructor(@InjectDb() db: NodePgDatabase<typeof schema>) { super(db); }

  /**
   * List all users with optional search and pagination.
   * Joins user_role_mapping to surface the primary role code.
   */
  async findPage(opts: {
    page:     number;
    pageSize: number;
    search?:  string;
  }): Promise<{ rows: UserRow[]; total: number }> {
    const { page, pageSize, search } = opts;
    const offset = (page - 1) * pageSize;

    const searchFilter = ilikeAny(search, schema.users.name, schema.users.email, schema.users.phoneNumber);

    const where = and(isNull(schema.users.deletedAt), searchFilter);

    return this.paginate(
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
      this.db.select({ total: count() }).from(schema.users).where(where),
    );
  }
}
