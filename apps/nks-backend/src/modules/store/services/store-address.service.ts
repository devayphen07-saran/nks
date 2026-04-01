import { Injectable } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../core/database/schema';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import { address, entity, addressType } from '../../../core/database/schema';
import type { NewAddress, UpdateAddress } from '../../../core/database/schema';
import { InternalServerException } from '../../../common/exceptions';

/**
 * Store Address Service
 *
 * Manages store addresses using the polymorphic address table.
 * Abstracts the entity/recordId pattern for store-specific operations.
 *
 * Usage:
 *   const storeAddr = storeAddressService.create(storeId, { line1, line2, ... })
 *   const addrs = storeAddressService.getByStore(storeId)
 */
@Injectable()
export class StoreAddressService {
  private storeEntityId: number | null = null;

  constructor(
    @InjectDb() private readonly database: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Initialize: fetch and cache the "store" entity ID
   * Called once on module load
   */
  async initialize() {
    const storeEntity = await this.database
      .select()
      .from(entity)
      .where(eq(entity.entityName, 'store'))
      .limit(1);

    if (storeEntity.length === 0) {
      throw new InternalServerException(
        'Store entity not found. Run migrations to seed entity data.',
      );
    }

    this.storeEntityId = storeEntity[0].id;
  }

  /**
   * Get all addresses for a store
   */
  async getByStore(storeId: number) {
    await this.ensureInitialized();

    return this.database
      .select({
        id: address.id,
        line1: address.line1,
        line2: address.line2,
        cityName: address.cityName,
        postalCode: address.postalCode,
        stateRegionProvinceText: address.stateRegionProvinceText,
        administrativeDivisionText: address.administrativeDivisionText,
        addressType: addressType.addressTypeName,
        isDefault: address.isDefaultAddress,
        isBilling: address.isBillingAddress,
        createdAt: address.createdAt,
      })
      .from(address)
      .leftJoin(addressType, eq(address.addressTypeFk, addressType.id))
      .where(
        and(
          eq(address.entityFk, this.storeEntityId!),
          eq(address.recordId, storeId),
          isNull(address.deletedAt),
        ),
      )
      .orderBy(address.isDefaultAddress);
  }

  /**
   * Get default address for a store
   */
  async getDefaultByStore(storeId: number) {
    await this.ensureInitialized();

    const result = await this.database
      .select()
      .from(address)
      .where(
        and(
          eq(address.entityFk, this.storeEntityId!),
          eq(address.recordId, storeId),
          eq(address.isDefaultAddress, true),
          isNull(address.deletedAt),
        ),
      )
      .limit(1);

    return result[0] || null;
  }

  /**
   * Create address for a store
   * @param storeId - Store ID
   * @param data - Address data
   * @param tx - Optional transaction context. If provided, insert is executed within the transaction
   */
  async create(
    storeId: number,
    data: Omit<NewAddress, 'entityFk' | 'recordId' | 'updatedAt'>,
    tx?: any,
  ) {
    await this.ensureInitialized();

    const db = tx || this.database;

    // Only include the fields we explicitly want to insert
    // This prevents Drizzle from trying to include auto-fields like updatedAt
    const values: any = {
      addressTypeFk: data.addressTypeFk,
      line1: data.line1,
      line2: data.line2,
      cityName: data.cityName,
      stateRegionProvinceFk: data.stateRegionProvinceFk,
      stateRegionProvinceText: data.stateRegionProvinceText,
      administrativeDivisionFk: data.administrativeDivisionFk,
      administrativeDivisionText: data.administrativeDivisionText,
      postalCode: data.postalCode,
      countryFk: data.countryFk,
      isBillingAddress: data.isBillingAddress,
      isDefaultAddress: data.isDefaultAddress,
      createdBy: data.createdBy,
      modifiedBy: data.modifiedBy,
      entityFk: this.storeEntityId!,
      recordId: storeId,
    };

    const result = await db.insert(address).values(values).returning();

    return result[0];
  }

  /**
   * Update address
   */
  async update(addressId: number, data: UpdateAddress) {
    const result = await this.database
      .update(address)
      .set(data)
      .where(eq(address.id, addressId))
      .returning();

    return result[0];
  }

  /**
   * Soft delete address
   */
  async delete(addressId: number, deletedBy: number) {
    const result = await this.database
      .update(address)
      .set({
        deletedAt: new Date(),
        deletedBy,
      })
      .where(eq(address.id, addressId))
      .returning();

    return result[0];
  }

  /**
   * Set an address as default
   * Unsets any other default address for this store
   */
  async setAsDefault(storeId: number, addressId: number) {
    await this.ensureInitialized();

    await this.database
      .update(address)
      .set({ isDefaultAddress: false })
      .where(
        and(
          eq(address.entityFk, this.storeEntityId!),
          eq(address.recordId, storeId),
        ),
      );

    const result = await this.database
      .update(address)
      .set({ isDefaultAddress: true })
      .where(eq(address.id, addressId))
      .returning();

    return result[0];
  }

  /**
   * Set an address as billing address
   */
  async setAsBillingAddress(storeId: number, addressId: number) {
    await this.ensureInitialized();

    await this.database
      .update(address)
      .set({ isBillingAddress: false })
      .where(
        and(
          eq(address.entityFk, this.storeEntityId!),
          eq(address.recordId, storeId),
        ),
      );

    const result = await this.database
      .update(address)
      .set({ isBillingAddress: true })
      .where(eq(address.id, addressId))
      .returning();

    return result[0];
  }

  /**
   * Ensure entity is initialized
   */
  private async ensureInitialized() {
    if (!this.storeEntityId) {
      await this.initialize();
    }
  }
}
