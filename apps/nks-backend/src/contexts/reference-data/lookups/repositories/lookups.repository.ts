import { Injectable, BadRequestException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, isNull, count, asc, desc, sql } from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm/column';
import { ilikeAny } from '../../../../core/database/query-helpers';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';
import { lookup } from '../../../../core/database/schema/lookups/lookup/lookup.table';
import { lookupType } from '../../../../core/database/schema/lookups/lookup-type/lookup-type.table';
import { currency } from '../../../../core/database/schema/lookups/currency/currency.table';
import { LookupTypeCodes } from '../../../../common/constants/lookup-type-codes.constants';
import type {
  CreateLookupValueDto,
  UpdateLookupValueDto,
} from '../dto/admin-lookups.dto';

const DEFAULT_LOOKUP_PAGE_SIZE = 200;

// ─── Row Types ──────────────────────────────────────────────────────────────

type LookupValueRow = {
  id: number;
  guuid: string;
  code: string;
  label: string;
  description: string | null;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date | null;
};

type CountryRow = typeof schema.country.$inferSelect;
type CommunicationTypeRow = typeof schema.communicationType.$inferSelect;
type CurrencyRow = typeof currency.$inferSelect;
type VolumesRow = typeof schema.volumes.$inferSelect;
type LookupTypeWithCount = { code: string; title: string; isSystem: boolean; sortOrder: number | null; valueCount: number };
type LookupTypeRef = { id: number; code: string; title: string; hasTable: boolean };

type FindOpts = {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  isActive?: boolean;
};

/** Columns to select from lookup for generic lookup endpoints */
const lookupValueSelect = {
  id: lookup.id,
  guuid: lookup.guuid,
  code: lookup.code,
  label: lookup.label,
  description: lookup.description,
  isActive: lookup.isActive,
  isHidden: lookup.isHidden,
  isSystem: lookup.isSystem,
  sortOrder: lookup.sortOrder,
  createdAt: lookup.createdAt,
  updatedAt: lookup.updatedAt,
};

@Injectable()
export class LookupsRepository extends BaseRepository {
  constructor(@InjectDb() db: NodePgDatabase<typeof schema>) { super(db); }

  private getValueOrderColumn(sortBy: string = 'sortOrder') {
    switch (sortBy) {
      case 'code':      return lookup.code;
      case 'label':     return lookup.label;
      case 'createdAt': return lookup.createdAt;
      case 'sortOrder':
      default:          return lookup.sortOrder;
    }
  }

  private applySortDirection(column: AnyColumn, sortOrder: string = 'asc') {
    return sortOrder === 'desc' ? desc(column) : asc(column);
  }

  /** Generic — fetch all active, visible global values for a lookup type code */
  async getValuesByType(typeCode: string, limit = DEFAULT_LOOKUP_PAGE_SIZE): Promise<LookupValueRow[]> {
    return this.db
      .select(lookupValueSelect)
      .from(lookup)
      .innerJoin(lookupType, eq(lookup.lookupTypeFk, lookupType.id))
      .where(
        and(
          eq(lookupType.code, typeCode),
          isNull(lookup.storeFk),
          eq(lookup.isActive, true),
          eq(lookup.isHidden, false),
          isNull(lookup.deletedAt),
        ),
      )
      .orderBy(lookup.sortOrder)
      .limit(limit);
  }

  async getCountries(): Promise<CountryRow[]> {
    return this.db
      .select()
      .from(schema.country)
      .where(
        and(
          eq(schema.country.isActive, true),
          eq(schema.country.isHidden, false),
          isNull(schema.country.deletedAt),
        ),
      )
      .orderBy(schema.country.sortOrder);
  }

  async getCommunicationTypes(): Promise<CommunicationTypeRow[]> {
    return this.db
      .select()
      .from(schema.communicationType)
      .where(
        and(
          eq(schema.communicationType.isActive, true),
          eq(schema.communicationType.isHidden, false),
          isNull(schema.communicationType.deletedAt),
        ),
      )
      .orderBy(schema.communicationType.sortOrder);
  }

  async getCurrencies(): Promise<CurrencyRow[]> {
    return this.db
      .select()
      .from(currency)
      .where(
        and(
          eq(currency.isActive, true),
          eq(currency.isHidden, false),
          isNull(currency.deletedAt),
        ),
      )
      .orderBy(currency.sortOrder);
  }

  async getVolumes(): Promise<VolumesRow[]> {
    return this.db
      .select()
      .from(schema.volumes)
      .where(
        and(
          eq(schema.volumes.isActive, true),
          eq(schema.volumes.isHidden, false),
          isNull(schema.volumes.deletedAt),
        ),
      )
      .orderBy(schema.volumes.sortOrder);
  }

  async getAddressTypesFromTable(): Promise<{ id: number; guuid: string; code: string; label: string; description: string | null }[]> {
    return this.db
      .select({ id: schema.addressType.id, guuid: schema.addressType.guuid, code: schema.addressType.code, label: schema.addressType.label, description: schema.addressType.description })
      .from(schema.addressType)
      .where(and(eq(schema.addressType.isActive, true), eq(schema.addressType.isHidden, false), isNull(schema.addressType.deletedAt)))
      .orderBy(schema.addressType.sortOrder);
  }

  async getDesignationTypesFromTable(): Promise<{ id: number; guuid: string; code: string; label: string; description: string | null }[]> {
    return this.db
      .select({ id: schema.designationType.id, guuid: schema.designationType.guuid, code: schema.designationType.code, label: schema.designationType.label, description: schema.designationType.description })
      .from(schema.designationType)
      .where(and(eq(schema.designationType.isActive, true), eq(schema.designationType.isHidden, false), isNull(schema.designationType.deletedAt)))
      .orderBy(schema.designationType.sortOrder);
  }

  // ── Admin: Lookup Configuration ─────────────────────────────────────────────

  /** All active lookup types with a count of their global active values */
  async findAllLookupTypes(): Promise<LookupTypeWithCount[]> {
    return this.db
      .select({
        code: lookupType.code,
        title: lookupType.title,
        isSystem: lookupType.isSystem,
        sortOrder: lookupType.sortOrder,
        valueCount: count(lookup.id),
      })
      .from(lookupType)
      .leftJoin(
        lookup,
        and(
          eq(lookup.lookupTypeFk, lookupType.id),
          isNull(lookup.storeFk),
          eq(lookup.isActive, true),
          isNull(lookup.deletedAt),
        ),
      )
      .where(
        and(eq(lookupType.isActive, true), isNull(lookupType.deletedAt)),
      )
      .groupBy(lookupType.id)
      .orderBy(lookupType.sortOrder, lookupType.title);
  }

  /** All non-deleted global values for a type (admin view — supports sortBy, sortOrder, isActive) */
  async findLookupValuesByType(
    typeCode: string,
    opts: FindOpts,
  ): Promise<{ rows: LookupValueRow[]; total: number }> {
    const { page, pageSize, search, sortBy = 'sortOrder', sortOrder = 'asc', isActive } = opts;
    const offset = LookupsRepository.toOffset(page, pageSize);

    const where = and(
      eq(lookupType.code, typeCode),
      isNull(lookup.storeFk),
      isNull(lookup.deletedAt),
      isActive !== undefined ? eq(lookup.isActive, isActive) : undefined,
      ilikeAny(search, lookup.label, lookup.code),
    );

    return this.paginate(
      this.db.select(lookupValueSelect).from(lookup).innerJoin(lookupType, eq(lookup.lookupTypeFk, lookupType.id)).where(where).orderBy(this.applySortDirection(this.getValueOrderColumn(sortBy), sortOrder)).limit(pageSize).offset(offset),
      () => this.db.select({ total: count() }).from(lookup).innerJoin(lookupType, eq(lookup.lookupTypeFk, lookupType.id)).where(where),
      page, pageSize,
    );
  }

  /**
   * Paginated admin view for a dedicated-table lookup type.
   * Routes to the correct table based on typeCode and maps columns to LookupValueRow.
   * Uses type-safe methods per table instead of unsafe `as any` casting.
   */
  async findDedicatedLookupValues(
    typeCode: string,
    opts: FindOpts,
  ): Promise<{ rows: LookupValueRow[]; total: number }> {
    const { page, pageSize, search, sortBy = 'sortOrder', sortOrder = 'asc', isActive } = opts;
    const offset = LookupsRepository.toOffset(page, pageSize);
    const dir = sortOrder === 'desc' ? desc : asc;

    // Route to type-safe method per lookup type
    switch (typeCode) {
      case LookupTypeCodes.BILLING_FREQUENCY:
        return this.queryStandardLookupTable(schema.billingFrequency, page, pageSize, offset, dir, search, sortBy, isActive);

      case LookupTypeCodes.COMMUNICATION_TYPE:
        return this.queryStandardLookupTable(schema.communicationType, page, pageSize, offset, dir, search, sortBy, isActive);

      case LookupTypeCodes.DESIGNATION_TYPE:
        return this.queryStandardLookupTable(schema.designationType, page, pageSize, offset, dir, search, sortBy, isActive);

      case LookupTypeCodes.ENTITY_TYPE:
        return this.queryStandardLookupTable(schema.entityType, page, pageSize, offset, dir, search, sortBy, isActive);

      case LookupTypeCodes.NOTIFICATION_STATUS:
        return this.queryStandardLookupTable(schema.notificationStatus, page, pageSize, offset, dir, search, sortBy, isActive);

      case LookupTypeCodes.STAFF_INVITE_STATUS:
        return this.queryStandardLookupTable(schema.staffInviteStatus, page, pageSize, offset, dir, search, sortBy, isActive);

      case LookupTypeCodes.TAX_FILING_FREQUENCY:
        return this.queryStandardLookupTable(schema.taxFilingFrequency, page, pageSize, offset, dir, search, sortBy, isActive);

      case LookupTypeCodes.ADDRESS_TYPE:
        return this.queryStandardLookupTable(schema.addressType, page, pageSize, offset, dir, search, sortBy, isActive);

      case LookupTypeCodes.CURRENCY:
        return this.queryCurrencyTable(page, pageSize, offset, dir, search, sortBy, isActive);

      case LookupTypeCodes.VOLUMES:
        return this.queryVolumesTable(page, pageSize, offset, dir, search, sortBy, isActive);

      default:
        throw new BadRequestException(`Unknown lookup type: ${typeCode}`);
    }
  }

  /** Resolve a lookup_type row by its code (includes hasTable flag for routing decisions) */
  async findLookupTypeByCode(code: string): Promise<LookupTypeRef | null> {
    const [row] = await this.db
      .select({
        id: lookupType.id,
        code: lookupType.code,
        title: lookupType.title,
        hasTable: lookupType.hasTable,
      })
      .from(lookupType)
      .where(and(eq(lookupType.code, code), isNull(lookupType.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  /** Find a single lookup value by id */
  async findLookupValueById(id: number): Promise<LookupValueRow | null> {
    const [row] = await this.db
      .select(lookupValueSelect)
      .from(lookup)
      .where(and(eq(lookup.id, id), isNull(lookup.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  /**
   * Fetch a lookup value by id and verify it belongs to typeCode in one query.
   * Returns null if the value does not exist, is deleted, or belongs to a different type.
   */
  async findLookupValueByIdAndType(
    id: number,
    typeCode: string,
  ): Promise<LookupValueRow | null> {
    const [row] = await this.db
      .select(lookupValueSelect)
      .from(lookup)
      .innerJoin(lookupType, eq(lookup.lookupTypeFk, lookupType.id))
      .where(
        and(
          eq(lookup.id, id),
          eq(lookupType.code, typeCode),
          isNull(lookup.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** Fetch a lookup value by guuid and verify it belongs to typeCode. */
  async findLookupValueByGuuidAndType(
    guuid: string,
    typeCode: string,
  ): Promise<LookupValueRow & { numericId: number } | null> {
    const [row] = await this.db
      .select({ ...lookupValueSelect, numericId: lookup.id })
      .from(lookup)
      .innerJoin(lookupType, eq(lookup.lookupTypeFk, lookupType.id))
      .where(
        and(
          eq(lookup.guuid, guuid),
          eq(lookupType.code, typeCode),
          isNull(lookup.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** Insert a new global lookup value under a type */
  async createLookupValue(typeId: number, dto: CreateLookupValueDto, createdBy: number): Promise<typeof lookup.$inferSelect> {
    return this.insertOneAudited(
      lookup,
      {
        lookupTypeFk: typeId,
        code: dto.code,
        label: dto.label,
        description: dto.description ?? null,
        sortOrder: dto.sortOrder ?? null,
        isActive: true,
        isSystem: false,
      },
      createdBy,
    );
  }

  /** Update label / description / sortOrder on a lookup value (code is immutable after creation) */
  async updateLookupValue(id: number, dto: UpdateLookupValueDto, modifiedBy: number): Promise<typeof lookup.$inferSelect | null> {
    const set: Partial<typeof lookup.$inferInsert> = {};
    if (dto.label !== undefined) set.label = dto.label;
    if (dto.description !== undefined) set.description = dto.description ?? null;
    if (dto.sortOrder !== undefined) set.sortOrder = dto.sortOrder ?? null;

    return this.updateOneAudited(
      lookup,
      set,
      and(eq(lookup.id, id), isNull(lookup.deletedAt))!,
      modifiedBy,
    );
  }

  /** Soft-delete a lookup value */
  async deleteLookupValue(id: number, deletedBy: number): Promise<typeof lookup.$inferSelect | null> {
    return this.softDeleteAudited(
      lookup,
      and(eq(lookup.id, id), isNull(lookup.deletedAt))!,
      deletedBy,
    );
  }

  /** Lightweight existence check — true if an active lookup with this guuid exists under typeCode. */
  async existsByGuuidAndType(guuid: string, typeCode: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: lookup.id })
      .from(lookup)
      .innerJoin(lookupType, eq(lookup.lookupTypeFk, lookupType.id))
      .where(
        and(
          eq(lookup.guuid, guuid),
          eq(lookupType.code, typeCode),
          eq(lookup.isActive, true),
          isNull(lookup.deletedAt),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  async findStoreIdByGuuid(guuid: string): Promise<number | null> {
    const [row] = await this.db
      .select({ id: schema.store.id })
      .from(schema.store)
      .where(eq(schema.store.guuid, guuid))
      .limit(1);
    return row?.id ?? null;
  }

  /**
   * Type-safe query for standard lookup tables (code + label + description columns).
   * No unsafe `as any` casting — full type information is preserved.
   */
  private async queryStandardLookupTable(
    table: typeof schema.billingFrequency | typeof schema.communicationType | typeof schema.designationType | typeof schema.entityType | typeof schema.notificationStatus | typeof schema.staffInviteStatus | typeof schema.taxFilingFrequency | typeof schema.addressType,
    page: number,
    pageSize: number,
    offset: number,
    dir: (col: AnyColumn) => any,
    search: string | undefined,
    sortBy: string | undefined,
    isActive: boolean | undefined,
  ): Promise<{ rows: LookupValueRow[]; total: number }> {
    // Determine sort column — all these tables have: code, label, createdAt, sortOrder
    const orderCol =
      sortBy === 'code' ? table.code :
      sortBy === 'label' ? table.label :
      sortBy === 'createdAt' ? table.createdAt :
      table.sortOrder;

    const where = and(
      isNull(table.deletedAt),
      isActive !== undefined ? eq(table.isActive, isActive) : undefined,
      ilikeAny(search, table.label, table.code),
    );

    return this.paginate(
      this.db
        .select({
          id: table.id,
          guuid: table.guuid,
          code: table.code,
          label: table.label,
          description: table.description,
          isActive: table.isActive,
          isHidden: table.isHidden,
          isSystem: table.isSystem,
          sortOrder: table.sortOrder,
          createdAt: table.createdAt,
          updatedAt: table.updatedAt,
        })
        .from(table)
        .where(where)
        .orderBy(dir(orderCol))
        .limit(pageSize)
        .offset(offset),
      () => this.db.select({ total: count() }).from(table).where(where),
      page,
      pageSize,
    );
  }

  /**
   * Type-safe query for currency table (symbol instead of label).
   */
  private async queryCurrencyTable(
    page: number,
    pageSize: number,
    offset: number,
    dir: (col: AnyColumn) => any,
    search: string | undefined,
    sortBy: string | undefined,
    isActive: boolean | undefined,
  ): Promise<{ rows: LookupValueRow[]; total: number }> {
    const t = schema.currency;

    const orderCol =
      sortBy === 'code' ? t.code :
      sortBy === 'label' ? t.symbol :
      sortBy === 'createdAt' ? t.createdAt :
      t.sortOrder;

    const where = and(
      isNull(t.deletedAt),
      isActive !== undefined ? eq(t.isActive, isActive) : undefined,
      ilikeAny(search, t.symbol, t.code),
    );

    return this.paginate(
      this.db
        .select({
          id: t.id,
          guuid: t.guuid,
          code: t.code,
          label: t.symbol,
          description: t.description,
          isActive: t.isActive,
          isHidden: t.isHidden,
          isSystem: t.isSystem,
          sortOrder: t.sortOrder,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })
        .from(t)
        .where(where)
        .orderBy(dir(orderCol))
        .limit(pageSize)
        .offset(offset),
      () => this.db.select({ total: count() }).from(t).where(where),
      page,
      pageSize,
    );
  }

  /**
   * Type-safe query for volumes table (volumeCode and volumeName columns).
   */
  private async queryVolumesTable(
    page: number,
    pageSize: number,
    offset: number,
    dir: (col: AnyColumn) => any,
    search: string | undefined,
    sortBy: string | undefined,
    isActive: boolean | undefined,
  ): Promise<{ rows: LookupValueRow[]; total: number }> {
    const t = schema.volumes;

    const orderCol =
      sortBy === 'code' ? t.volumeCode :
      sortBy === 'label' ? t.volumeName :
      sortBy === 'createdAt' ? t.createdAt :
      t.sortOrder;

    const where = and(
      isNull(t.deletedAt),
      isActive !== undefined ? eq(t.isActive, isActive) : undefined,
      ilikeAny(search, t.volumeName, t.volumeCode),
    );

    return this.paginate(
      this.db
        .select({
          id: t.id,
          guuid: t.guuid,
          code: t.volumeCode,
          label: t.volumeName,
          description: sql<string | null>`NULL`,
          isActive: t.isActive,
          isHidden: t.isHidden,
          isSystem: t.isSystem,
          sortOrder: t.sortOrder,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })
        .from(t)
        .where(where)
        .orderBy(dir(orderCol))
        .limit(pageSize)
        .offset(offset),
      () => this.db.select({ total: count() }).from(t).where(where),
      page,
      pageSize,
    );
  }
}
