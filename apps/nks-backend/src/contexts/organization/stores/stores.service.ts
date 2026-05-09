import { Injectable, Logger } from '@nestjs/common';
import { eq, and, gt } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import { TransactionService } from '../../../core/database/transaction.service';
import * as schema from '../../../core/database/schema';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '../../../common/exceptions';
import {
  ErrorCode,
  errPayload,
} from '../../../common/constants/error-codes.constants';
import { StoresRepository } from './repositories/stores.repository';
import type { CreateStoreDto } from './dto/create-store.dto';
export type { StoreDto } from './mapper/stores.mapper';

/**
 * StoresService
 *
 * Manages store-related operations (set default store for user).
 *
 * Authorization Contract:
 *   - setDefaultStore(userId, storeGuuid): No explicit permission checks needed.
 *     userId must be a member of the store (enforced via atomic EXISTS subquery in repository).
 *     Marked with @NoEntityPermissionRequired at controller level because membership
 *     is verified in the database transaction, not via permission ceiling checks.
 *
 * Business Rule Validation:
 *   - Store must exist (findByGuuid returns null if not found)
 *   - User must be a member of the store (setDefaultStoreIfMember checks membership atomically)
 *   - Only a member can set a store as their default
 *
 * Audit Trail:
 *   - userId parameter identifies whose default store is being set
 *   - Note: Audit logging not currently implemented for this operation (low-risk action)
 */
@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);

  constructor(
    private readonly storesRepository: StoresRepository,
    private readonly txService: TransactionService,
    @InjectDb() private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async createStore(
    userId: number,
    dto: CreateStoreDto,
    deviceId?: string,
  ): Promise<{ storeGuuid: string }> {
    const [legalType] = await this.db
      .select({ id: schema.lookup.id })
      .from(schema.lookup)
      .where(eq(schema.lookup.code, dto.storeLegalTypeCode))
      .limit(1);
    if (!legalType)
      throw new BadRequestException(errPayload(ErrorCode.VALIDATION_ERROR));

    const [category] = await this.db
      .select({ id: schema.lookup.id })
      .from(schema.lookup)
      .where(eq(schema.lookup.code, dto.storeCategoryCode))
      .limit(1);
    if (!category)
      throw new BadRequestException(errPayload(ErrorCode.VALIDATION_ERROR));

    const [activeStatus] = await this.db
      .select({ id: schema.status.id })
      .from(schema.status)
      .where(eq(schema.status.code, 'ACTIVE'))
      .limit(1);
    if (!activeStatus)
      throw new NotFoundException(errPayload(ErrorCode.NOT_FOUND));

    const [created] = await this.db
      .insert(schema.store)
      .values({
        storeName: dto.storeName,
        storeCode: dto.storeCode ?? null,
        timezone: dto.timezone ?? 'Asia/Kolkata',
        ownerUserFk: userId,
        storeLegalTypeFk: legalType.id,
        storeCategoryFk: category.id,
        statusFk: activeStatus.id,
        isActive: true,
        createdBy: userId,
      })
      .returning({ id: schema.store.id, guuid: schema.store.guuid });

    const storeId = created.id;
    const storeGuuid = created.guuid;

    // Assign STORE_OWNER role for this user in the new store
    const [storeOwnerRole] = await this.db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.code, 'STORE_OWNER'))
      .limit(1);

    if (storeOwnerRole) {
      await this.db
        .insert(schema.userRoleMapping)
        .values({
          userFk: userId,
          roleFk: storeOwnerRole.id,
          storeFk: storeId,
          isPrimary: true,
          assignedBy: userId,
        })
        .onConflictDoNothing();
    }

    // Auto-default only when the user has no existing default store.
    // Promotion to default is done explicitly via PUT /stores/default.
    const existingDefault = await this.db
      .select({ id: schema.store.id })
      .from(schema.store)
      .where(
        and(
          eq(schema.store.ownerUserFk, userId),
          eq(schema.store.isDefault, true),
        ),
      )
      .limit(1);

    if (!existingDefault.length) {
      await this.txService.run(
        async (tx) => {
          await this.storesRepository.setDefaultStore(userId, storeId, tx);

          await tx
            .update(schema.userSession)
            .set({ activeStoreFk: storeId })
            .where(
              and(
                eq(schema.userSession.userId, userId),
                gt(schema.userSession.expiresAt, new Date()),
              ),
            );

          if (deviceId) {
            await tx
              .insert(schema.deviceRegistration)
              .values({ deviceId, userId, storeId, lastSeenAt: new Date() })
              .onConflictDoUpdate({
                target: [
                  schema.deviceRegistration.deviceId,
                  schema.deviceRegistration.userId,
                  schema.deviceRegistration.storeId,
                ],
                set: { lastSeenAt: new Date() },
              });
          }
        },
        { name: 'StoresService.createStore.autoDefault' },
      );
    }

    return { storeGuuid };
  }

  async setDefaultStore(userId: number, storeGuuid: string): Promise<void> {
    const store = await this.storesRepository.findByGuuid(storeGuuid);
    if (!store)
      throw new NotFoundException(errPayload(ErrorCode.STORE_NOT_FOUND));

    await this.txService.run(
      async (tx) => {
        const updated = await this.storesRepository.setDefaultStoreIfMember(
          userId,
          store.id,
          tx,
        );
        if (!updated) {
          throw new ForbiddenException(errPayload(ErrorCode.FORBIDDEN));
        }

        // Propagate the store selection to all active sessions so the next token
        // refresh picks up activeStoreId and DeviceAuthGuard can find a registration.
        await tx
          .update(schema.userSession)
          .set({ activeStoreFk: store.id })
          .where(
            and(
              eq(schema.userSession.userId, userId),
              gt(schema.userSession.expiresAt, new Date()),
            ),
          );
      },
      { name: 'StoresService.setDefaultStore' },
    );
  }
}
