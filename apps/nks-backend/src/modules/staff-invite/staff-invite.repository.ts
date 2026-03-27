import { Injectable } from '@nestjs/common';
import * as schema from '../../core/database/schema';
import { eq, and, gt } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

type Tx = NodePgDatabase<typeof schema>;

@Injectable()
export class StaffInviteRepository {
  constructor(@InjectDb() private readonly db: Tx) {}

  /** Create a new staff invite. */
  async create(data: typeof schema.staffInvite.$inferInsert, tx?: Tx) {
    const client = tx ?? this.db;
    const [inserted] = await client
      .insert(schema.staffInvite)
      .values(data)
      .returning();
    return inserted;
  }

  /** Find a valid (PENDING, not expired) invite by token. */
  async findByToken(token: string) {
    const [invite] = await this.db
      .select()
      .from(schema.staffInvite)
      .where(
        and(
          eq(schema.staffInvite.token, token),
          eq(schema.staffInvite.status, 'PENDING'),
          eq(schema.staffInvite.isActive, true),
          gt(schema.staffInvite.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return invite ?? null;
  }

  /** Mark an invite as ACCEPTED. */
  async markAccepted(id: number, acceptedByFk: number, tx?: Tx) {
    const client = tx ?? this.db;
    await client
      .update(schema.staffInvite)
      .set({ status: 'ACCEPTED', acceptedByFk, acceptedAt: new Date() })
      .where(eq(schema.staffInvite.id, id));
  }

  /** List all staff (accepted invites) for a store with user + role info. */
  async findStaffByStore(storeFk: number) {
    return this.db
      .select({
        userId: schema.users.id,
        userName: schema.users.name,
        userEmail: schema.users.email,
        roleCode: schema.roles.code,
        roleName: schema.roles.roleName,
        inviteId: schema.staffInvite.id,
        acceptedAt: schema.staffInvite.acceptedAt,
      })
      .from(schema.staffInvite)
      .innerJoin(
        schema.users,
        eq(schema.staffInvite.acceptedByFk, schema.users.id),
      )
      .innerJoin(schema.roles, eq(schema.staffInvite.roleFk, schema.roles.id))
      .where(
        and(
          eq(schema.staffInvite.storeFk, storeFk),
          eq(schema.staffInvite.status, 'ACCEPTED'),
          eq(schema.staffInvite.isActive, true),
        ),
      );
  }

  /** Insert permission grants for an invite into staff_invite_permission. */
  async createPermissions(inviteId: number, permissionIds: number[], tx?: Tx) {
    if (permissionIds.length === 0) return;
    const client = tx ?? this.db;
    await client
      .insert(schema.staffInvitePermission)
      .values(
        permissionIds.map((permissionFk) => ({
          inviteFk: inviteId,
          permissionFk,
        })),
      )
      .onConflictDoNothing();
  }

  /** Return the permission FKs granted to an invite. */
  async findPermissionIds(inviteId: number): Promise<number[]> {
    const rows = await this.db
      .select({ permissionFk: schema.staffInvitePermission.permissionFk })
      .from(schema.staffInvitePermission)
      .where(eq(schema.staffInvitePermission.inviteFk, inviteId));
    return rows.map((r) => r.permissionFk);
  }

  /** Look up a user by email (case-insensitive) — used to pre-link inviteeFk. */
  async findUserByEmail(email: string) {
    const [user] = await this.db
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1);
    return user ?? null;
  }

  /** Get just the email for a user by ID — used to validate at accept time. */
  async findUserEmailById(userId: number): Promise<string | null> {
    const [user] = await this.db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    return user?.email ?? null;
  }

  /** Backfill inviteeFk on an invite (called at accept time for first-time registrants). */
  async backfillInviteeFk(inviteId: number, inviteeFk: number, tx?: Tx) {
    const client = tx ?? this.db;
    await client
      .update(schema.staffInvite)
      .set({ inviteeFk })
      .where(eq(schema.staffInvite.id, inviteId));
  }

  /** Find the store a user owns (STORE_OWNER role mapping). */
  async findOwnerStore(userId: number) {
    const [row] = await this.db
      .select({ storeFk: schema.userRoleMapping.storeFk })
      .from(schema.userRoleMapping)
      .innerJoin(
        schema.roles,
        eq(schema.userRoleMapping.roleFk, schema.roles.id),
      )
      .where(
        and(
          eq(schema.userRoleMapping.userFk, userId),
          eq(schema.roles.code, 'STORE_OWNER'),
        ),
      )
      .limit(1);
    return row?.storeFk ?? null;
  }
}
