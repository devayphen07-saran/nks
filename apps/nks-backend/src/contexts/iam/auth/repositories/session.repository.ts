import { Injectable } from '@nestjs/common';
import { eq, and, gt, asc, count } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';
import type { UserSession, NewUserSession, UpdateUserSession } from '../../../../core/database/schema/auth/user-session';

type Db = NodePgDatabase<typeof schema>;

/**
 * SessionRepository - CRUD operations only
 * Handles: create, find, update, delete, and session count queries
 * Does NOT handle: token management, revocation, or cleanup
 */
@Injectable()
export class SessionRepository extends BaseRepository {
  constructor(@InjectDb() db: Db) { super(db); }

  private activeSessionWhere(userId: number) {
    return and(
      eq(schema.userSession.userId, userId),
      gt(schema.userSession.expiresAt, new Date()),
    );
  }

  async create(data: NewUserSession): Promise<UserSession | null> {
    const [session] = await this.db
      .insert(schema.userSession)
      .values(data)
      .returning();
    return session ?? null;
  }

  async findById(sessionId: number): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(eq(schema.userSession.id, sessionId))
      .limit(1);
    return session ?? null;
  }

  async findByToken(token: string): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(eq(schema.userSession.token, token))
      .limit(1);
    return session ?? null;
  }

  async findByUserId(userId: number): Promise<UserSession[]> {
    return this.db
      .select()
      .from(schema.userSession)
      .where(eq(schema.userSession.userId, userId))
      .orderBy(asc(schema.userSession.createdAt));
  }

  async findActiveByUserId(userId: number): Promise<UserSession[]> {
    return this.db
      .select()
      .from(schema.userSession)
      .where(this.activeSessionWhere(userId))
      .orderBy(schema.userSession.createdAt);
  }

  async findByGuuid(guuid: string): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(eq(schema.userSession.guuid, guuid))
      .limit(1);
    return session ?? null;
  }

  async findByIdAndUserId(sessionId: number, userId: number): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(
        and(
          eq(schema.userSession.id, sessionId),
          eq(schema.userSession.userId, userId),
        ),
      )
      .limit(1);
    return session ?? null;
  }

  async findActiveSessionsForUser(userId: number): Promise<
    Array<{
      id: number;
      deviceId: string | null;
      deviceName: string | null;
      deviceType: string | null;
      platform: string | null;
      appVersion: string | null;
      createdAt: Date | null;
      expiresAt: Date;
    }>
  > {
    return this.db
      .select({
        id: schema.userSession.id,
        deviceId: schema.userSession.deviceId,
        deviceName: schema.userSession.deviceName,
        deviceType: schema.userSession.deviceType,
        platform: schema.userSession.platform,
        appVersion: schema.userSession.appVersion,
        createdAt: schema.userSession.createdAt,
        expiresAt: schema.userSession.expiresAt,
      })
      .from(schema.userSession)
      .where(this.activeSessionWhere(userId))
      .orderBy(schema.userSession.createdAt);
  }

  async findAllByUserIdOrdered(userId: number): Promise<
    Array<{ id: number; createdAt: Date | null }>
  > {
    return this.db
      .select({
        id: schema.userSession.id,
        createdAt: schema.userSession.createdAt,
      })
      .from(schema.userSession)
      .where(eq(schema.userSession.userId, userId))
      .orderBy(asc(schema.userSession.createdAt));
  }

  async update(sessionId: number, data: UpdateUserSession): Promise<UserSession | null> {
    const [updated] = await this.db
      .update(schema.userSession)
      .set(data)
      .where(eq(schema.userSession.id, sessionId))
      .returning();
    return updated ?? null;
  }

  async delete(sessionId: number): Promise<number> {
    const result = await this.db
      .delete(schema.userSession)
      .where(eq(schema.userSession.id, sessionId));
    return result.rowCount ?? 0;
  }

  async deleteAllForUser(userId: number): Promise<number> {
    const result = await this.db
      .delete(schema.userSession)
      .where(eq(schema.userSession.userId, userId));
    return result.rowCount ?? 0;
  }

  async getActiveSessionCount(userId: number): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(schema.userSession)
      .where(this.activeSessionWhere(userId));
    return result?.count ?? 0;
  }

  async findOldestActiveSession(userId: number): Promise<UserSession | null> {
    const [session] = await this.db
      .select()
      .from(schema.userSession)
      .where(this.activeSessionWhere(userId))
      .orderBy(schema.userSession.createdAt)
      .limit(1);
    return session ?? null;
  }

  async setActiveStore(sessionId: number, storeId: number): Promise<void> {
    await this.db
      .update(schema.userSession)
      .set({ activeStoreFk: storeId })
      .where(eq(schema.userSession.id, sessionId));
  }

  async clearActiveStore(sessionId: number): Promise<void> {
    await this.db
      .update(schema.userSession)
      .set({ activeStoreFk: null })
      .where(eq(schema.userSession.id, sessionId));
  }
}
