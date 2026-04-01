import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { StoreRepository } from './store.repository';
import { StoreAddressService } from './services/store-address.service';
import { RolesRepository } from '../roles/roles.repository';
import { TransactionService } from '../../core/database/transaction.service';
import { RegisterStoreDto } from './dto';
import { BadRequestException } from '../../common/exceptions';
import { ErrorCode } from '../../common/constants/error-codes.constants';
import { userSession, addressType } from '../../core/database/schema';
import { eq } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../core/database/schema';

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);

  constructor(
    private readonly storeRepository: StoreRepository,
    private readonly storeAddressService: StoreAddressService,
    private readonly rolesRepository: RolesRepository,
    private readonly txService: TransactionService,
    @InjectDb() private readonly database: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Register a new store and assign the user as STORE_OWNER.
   * Transaction boundary is managed via TransactionService — no raw DB
   * access in the service layer.
   */
  async register(userId: number, dto: RegisterStoreDto) {
    // 1. Validate legal type and category (read-only — no tx needed)
    const [legalType, storeCategory, storeAddressType] = await Promise.all([
      this.storeRepository.findLegalTypeByCode(dto.storeLegalTypeCode),
      this.storeRepository.findCategoryByCode(dto.storeCategoryCode),
      this.database.query.addressType.findFirst({
        where: eq(addressType.addressTypeCode, 'STORE'),
      }),
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
    if (!storeAddressType && dto.address) {
      throw new BadRequestException({
        errorCode: ErrorCode.ADDRESS_TYPE_NOT_FOUND,
        message: 'STORE address type not configured in database',
      });
    }

    // 2. Validate STORE_OWNER role (read-only — no tx needed)
    const ownerRole = await this.rolesRepository.findByCode('STORE_OWNER');
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

      const store = await this.storeRepository.create(
        {
          iamStoreId,
          storeName: dto.storeName,
          storeCode: dto.storeCode,
          storeLegalTypeFk: legalType.id,
          storeCategoryFk: storeCategory.id,
          registrationNumber: dto.registrationNumber,
          taxNumber: dto.taxNumber,
          createdBy: userId,
        },
        tx,
      );

      await this.storeRepository.addUserToStore(
        {
          userFk: userId,
          storeFk: store.id,
          roleFk: ownerRole.id,
          assignedBy: userId,
        },
        tx,
      );

      // Insert primary owner into store_user_mapping
      await tx.insert(schema.storeUserMapping).values({
        storeFk: store.id,
        userFk: userId,
        isPrimary: true,
        assignedBy: userId,
      });

      // 4. Initialize activeSession with the new store scope for ALL active sessions
      await tx
        .update(userSession)
        .set({ activeStoreFk: store.id })
        .where(eq(userSession.userId, userId));

      // 5. Create store address if provided (within transaction)
      if (dto.address && storeAddressType) {
        await this.storeAddressService.create(
          store.id,
          {
            addressTypeFk: storeAddressType.id,
            line1: dto.address.line1,
            line2: dto.address.line2,
            cityName: dto.address.cityName,
            stateRegionProvinceFk: dto.address.stateRegionProvinceFk,
            stateRegionProvinceText: dto.address.stateRegionProvinceText,
            administrativeDivisionFk: dto.address.administrativeDivisionFk,
            administrativeDivisionText: dto.address.administrativeDivisionText,
            postalCode: dto.address.postalCode,
            countryFk: dto.address.countryFk,
            isDefaultAddress: true,
            isBillingAddress: true,
            createdBy: userId,
            modifiedBy: userId,
          },
          tx, // Pass transaction context
        );
      }

      return {
        storeId: store.id,
        storeCode: store.storeCode,
        role: 'STORE_OWNER',
      };
    }).then((result) => {
      this.logger.log(`Created store ${result.storeCode} for user ${userId}`);
      return result;
    });
  }

  async getMyStores(userId: number) {
    return this.storeRepository.findUserOwnedStores(userId);
  }

  async getInvitedStores(userId: number) {
    return this.storeRepository.findUserInvitedStores(userId);
  }

  /**
   * Get all accessible stores for a user with pagination.
   * Used by mobile app for store selection during login flow.
   */
  async getAccessibleStores(
    userId: number,
    page: number = 1,
    pageSize: number = 20,
  ) {
    return this.storeRepository.findAccessibleStores(userId, page, pageSize);
  }

  /**
   * Get a single store by ID.
   * Used by mobile app for store detail view.
   */
  async getStoreById(storeId: number) {
    return this.storeRepository.findById(storeId);
  }

  /**
   * Check if user has access to a store (owned or staff).
   */
  async userHasAccessToStore(
    userId: number,
    storeId: number,
  ): Promise<boolean> {
    return this.storeRepository.userHasAccessToStore(userId, storeId);
  }
}
