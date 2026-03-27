import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { StoreRepository } from './store.repository';
import { RolesRepository } from '../roles/roles.repository';
import { TransactionService } from '../../core/database/transaction.service';
import { RegisterStoreDto } from './dto';
import { BadRequestException } from '../../common/exceptions';
import { ErrorCode } from '../../common/constants/error-codes.constants';
import { userSession } from '../../core/database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class StoreService {
  constructor(
    private readonly repository: StoreRepository,
    private readonly rolesRepo: RolesRepository,
    private readonly txService: TransactionService,
  ) {}

  /**
   * Register a new store and assign the user as STORE_OWNER.
   * Transaction boundary is managed via TransactionService — no raw DB
   * access in the service layer.
   */
  async register(userId: number, dto: RegisterStoreDto) {
    // 1. Validate legal type and category (read-only — no tx needed)
    const [legalType, storeCategory] = await Promise.all([
      this.repository.findLegalTypeByCode(dto.storeLegalTypeCode),
      this.repository.findCategoryByCode(dto.storeCategoryCode),
    ]);
    if (!legalType) {
      throw new BadRequestException({
        errorCode: ErrorCode.STORE_LEGAL_TYPE_NOT_FOUND,
        message: `Invalid store legal type code: ${dto.storeLegalTypeCode}`,
      });
    }
    if (!storeCategory) {
      throw new BadRequestException({
        errorCode: ErrorCode.STORE_CATEGORY_NOT_FOUND,
        message: `Invalid store category code: ${dto.storeCategoryCode}`,
      });
    }

    // 2. Validate STORE_OWNER role (read-only — no tx needed)
    const ownerRole = await this.rolesRepo.findByCode('STORE_OWNER');
    if (!ownerRole) {
      throw new BadRequestException({
        errorCode: ErrorCode.ROLE_NOT_FOUND,
        message: 'Role STORE_OWNER not found in database',
      });
    }

    // 3. Execute both writes atomically via TransactionService
    return this.txService.run(async (tx) => {
      // Generate IAM Store ID using UUID v4 for external system integration
      const iamStoreId = randomUUID();

      const store = await this.repository.create(
        {
          iamStoreId,
          storeName: dto.storeName,
          storeCode: dto.storeCode,
          ownerFk: userId,
          storeLegalTypeFk: legalType.id,
          storeCategoryFk: storeCategory.id,
          registrationNumber: dto.registrationNumber,
          taxNumber: dto.taxNumber,
          createdBy: userId,
        },
        tx,
      );

      await this.repository.addUserToStore(
        {
          userFk: userId,
          storeFk: store.id,
          roleFk: ownerRole.id,
          assignedBy: userId,
        },
        tx,
      );

      // 4. Initialize activeSession with the new store scope for ALL active sessions
      await tx
        .update(userSession)
        .set({ activeStoreFk: store.id })
        .where(eq(userSession.userId, userId));

      return {
        storeId: store.id,
        storeCode: store.storeCode,
        role: 'STORE_OWNER',
      };
    });
  }

  async getMyStores(userId: number) {
    return this.repository.findUserOwnedStores(userId);
  }

  async getInvitedStores(userId: number) {
    return this.repository.findUserInvitedStores(userId);
  }

  /**
   * Get all accessible stores for a user with pagination.
   * Used by mobile app for store selection during login flow.
   */
  async getAccessibleStores(userId: number, page: number = 1, pageSize: number = 20) {
    return this.repository.findAccessibleStores(userId, page, pageSize);
  }

  /**
   * Get a single store by ID.
   * Used by mobile app for store detail view.
   */
  async getStoreById(storeId: number) {
    return this.repository.findById(storeId);
  }
}
