import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, isNull, count } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
import * as schema from '../../core/database/schema';
import { codeValue } from '../../core/database/schema/lookups/code-value/code-value.table';
import { codeCategory } from '../../core/database/schema/lookups/code-category/code-category.table';
import { currency } from '../../core/database/schema/lookups/currency/currency.table';
import { planType } from '../../core/database/schema/lookups/plan-type/plan-type.table';
import { taxLineStatus } from '../../core/database/schema/tax/tax-line-status/tax-line-status.table';
import { entityType } from '../../core/database/schema/lookups/entity-type/entity-type.table';
import { notificationStatus } from '../../core/database/schema/lookups/notification-status/notification-status.table';
import { staffInviteStatus } from '../../core/database/schema/lookups/staff-invite-status/staff-invite-status.table';
import { billingFrequency } from '../../core/database/schema/lookups/billing-frequency/billing-frequency.table';
import { taxRegistrationType } from '../../core/database/schema/tax/tax-registration-type/tax-registration-type.table';
import { taxFilingFrequency } from '../../core/database/schema/tax/tax-filing-frequency/tax-filing-frequency.table';
import type {
  CreateLookupValueDto,
  UpdateLookupValueDto,
} from './dto/admin-lookups.dto';

// ─── Row Types ──────────────────────────────────────────────────────────────

type CodeValueRow = {
  id: number;
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
type PlanTypeRow = typeof planType.$inferSelect;
type TaxLineStatusRow = typeof taxLineStatus.$inferSelect;
type EntityTypeRow = typeof entityType.$inferSelect;
type NotificationStatusRow = typeof notificationStatus.$inferSelect;
type StaffInviteStatusRow = typeof staffInviteStatus.$inferSelect;
type BillingFrequencyRow = typeof billingFrequency.$inferSelect;
type TaxRegistrationTypeRow = typeof taxRegistrationType.$inferSelect;
type TaxFilingFrequencyRow = typeof taxFilingFrequency.$inferSelect;
type CodeCategoryWithCount = { code: string; name: string; isSystem: boolean; sortOrder: number | null; valueCount: number };
type CodeCategoryRef = { id: number; code: string; name: string };

/** Columns to select from code_value for generic lookup endpoints */
const codeValueSelect = {
  id: codeValue.id,
  code: codeValue.code,
  label: codeValue.label,
  description: codeValue.description,
  isActive: codeValue.isActive,
  isHidden: codeValue.isHidden,
  isSystem: codeValue.isSystem,
  sortOrder: codeValue.sortOrder,
  createdAt: codeValue.createdAt,
  updatedAt: codeValue.updatedAt,
};

@Injectable()
export class LookupsRepository {
  constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}

  private queryCodeValues(categoryCode: string) {
    return this.db
      .select(codeValueSelect)
      .from(codeValue)
      .innerJoin(codeCategory, eq(codeValue.categoryFk, codeCategory.id))
      .where(
        and(
          eq(codeCategory.code, categoryCode),
          isNull(codeValue.storeFk),
          eq(codeValue.isActive, true),
          isNull(codeValue.deletedAt),
        ),
      )
      .orderBy(codeValue.sortOrder);
  }

  async getSalutations(): Promise<CodeValueRow[]> {
    return this.queryCodeValues('SALUTATION');
  }

  async getAddressTypes(): Promise<CodeValueRow[]> {
    return this.queryCodeValues('ADDRESS_TYPE');
  }

  async getDesignations(): Promise<CodeValueRow[]> {
    return this.queryCodeValues('DESIGNATION');
  }

  async getStoreLegalTypes(): Promise<CodeValueRow[]> {
    return this.queryCodeValues('STORE_LEGAL_TYPE');
  }

  async getStoreCategories(): Promise<CodeValueRow[]> {
    return this.queryCodeValues('STORE_CATEGORY');
  }

  async getCountries(): Promise<CountryRow[]> {
    return this.db
      .select()
      .from(schema.country)
      .where(
        and(
          eq(schema.country.isActive, true),
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
          isNull(schema.communicationType.deletedAt),
        ),
      )
      .orderBy(schema.communicationType.sortOrder);
  }

  async getCurrencies(): Promise<CurrencyRow[]> {
    return this.db
      .select()
      .from(currency)
      .where(and(eq(currency.isActive, true), isNull(currency.deletedAt)))
      .orderBy(currency.sortOrder);
  }

  async getVolumes(): Promise<VolumesRow[]> {
    return this.db
      .select()
      .from(schema.volumes)
      .where(
        and(
          eq(schema.volumes.isActive, true),
          isNull(schema.volumes.deletedAt),
        ),
      )
      .orderBy(schema.volumes.sortOrder);
  }

  // ── NEW Dedicated Lookup Tables (Phase 1 Normalization) ─────────────────────

  async getPlanTypes(): Promise<PlanTypeRow[]> {
    return this.db
      .select()
      .from(planType)
      .where(and(eq(planType.isActive, true), isNull(planType.deletedAt)))
      .orderBy(planType.code);
  }

  async getTaxLineStatuses(): Promise<TaxLineStatusRow[]> {
    return this.db
      .select()
      .from(taxLineStatus)
      .where(
        and(eq(taxLineStatus.isActive, true), isNull(taxLineStatus.deletedAt)),
      )
      .orderBy(taxLineStatus.code);
  }

  async getEntityTypes(): Promise<EntityTypeRow[]> {
    return this.db
      .select()
      .from(entityType)
      .where(and(eq(entityType.isActive, true), isNull(entityType.deletedAt)))
      .orderBy(entityType.code);
  }

  async getNotificationStatuses(): Promise<NotificationStatusRow[]> {
    return this.db
      .select()
      .from(notificationStatus)
      .where(
        and(
          eq(notificationStatus.isActive, true),
          isNull(notificationStatus.deletedAt),
        ),
      )
      .orderBy(notificationStatus.code);
  }

  async getStaffInviteStatuses(): Promise<StaffInviteStatusRow[]> {
    return this.db
      .select()
      .from(staffInviteStatus)
      .where(
        and(
          eq(staffInviteStatus.isActive, true),
          isNull(staffInviteStatus.deletedAt),
        ),
      )
      .orderBy(staffInviteStatus.code);
  }

  async getBillingFrequencies(): Promise<BillingFrequencyRow[]> {
    return this.db
      .select()
      .from(billingFrequency)
      .where(
        and(
          eq(billingFrequency.isActive, true),
          isNull(billingFrequency.deletedAt),
        ),
      )
      .orderBy(billingFrequency.code);
  }

  async getTaxRegistrationTypes(): Promise<TaxRegistrationTypeRow[]> {
    return this.db
      .select()
      .from(taxRegistrationType)
      .where(
        and(
          eq(taxRegistrationType.isActive, true),
          isNull(taxRegistrationType.deletedAt),
        ),
      )
      .orderBy(taxRegistrationType.code);
  }

  async getTaxFilingFrequencies(): Promise<TaxFilingFrequencyRow[]> {
    return this.db
      .select()
      .from(taxFilingFrequency)
      .where(
        and(
          eq(taxFilingFrequency.isActive, true),
          isNull(taxFilingFrequency.deletedAt),
        ),
      )
      .orderBy(taxFilingFrequency.code);
  }

  // ── Admin: Lookup Configuration ─────────────────────────────────────────────

  /** All active code categories with a count of their global active values */
  async findAllCodeCategories(): Promise<CodeCategoryWithCount[]> {
    return this.db
      .select({
        code: codeCategory.code,
        name: codeCategory.name,
        isSystem: codeCategory.isSystem,
        sortOrder: codeCategory.sortOrder,
        valueCount: count(codeValue.id),
      })
      .from(codeCategory)
      .leftJoin(
        codeValue,
        and(
          eq(codeValue.categoryFk, codeCategory.id),
          isNull(codeValue.storeFk),
          eq(codeValue.isActive, true),
          isNull(codeValue.deletedAt),
        ),
      )
      .where(
        and(eq(codeCategory.isActive, true), isNull(codeCategory.deletedAt)),
      )
      .groupBy(codeCategory.id)
      .orderBy(codeCategory.sortOrder, codeCategory.name);
  }

  /** All non-deleted global values for a category (active + inactive — admin view) */
  async findCodeValuesByCategory(categoryCode: string): Promise<CodeValueRow[]> {
    return this.db
      .select(codeValueSelect)
      .from(codeValue)
      .innerJoin(codeCategory, eq(codeValue.categoryFk, codeCategory.id))
      .where(
        and(
          eq(codeCategory.code, categoryCode),
          isNull(codeValue.storeFk),
          isNull(codeValue.deletedAt),
        ),
      )
      .orderBy(codeValue.sortOrder, codeValue.code);
  }

  /** Resolve a code_category row by its code */
  async findCodeCategoryByCode(code: string): Promise<CodeCategoryRef | null> {
    const [row] = await this.db
      .select({
        id: codeCategory.id,
        code: codeCategory.code,
        name: codeCategory.name,
      })
      .from(codeCategory)
      .where(and(eq(codeCategory.code, code), isNull(codeCategory.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  /** Find a single code_value by id */
  async findCodeValueById(id: number): Promise<CodeValueRow | null> {
    const [row] = await this.db
      .select(codeValueSelect)
      .from(codeValue)
      .where(and(eq(codeValue.id, id), isNull(codeValue.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  /** Insert a new global code_value under a category */
  async createCodeValue(categoryId: number, dto: CreateLookupValueDto): Promise<typeof codeValue.$inferSelect> {
    const [row] = await this.db
      .insert(codeValue)
      .values({
        categoryFk: categoryId,
        code: dto.code,
        label: dto.label,
        description: dto.description ?? null,
        sortOrder: dto.sortOrder ?? null,
        isActive: true,
        isSystem: false,
      })
      .returning();
    return row;
  }

  /** Update label / description / sortOrder / isActive on a code_value */
  async updateCodeValue(id: number, dto: UpdateLookupValueDto): Promise<typeof codeValue.$inferSelect | null> {
    const set: Partial<typeof codeValue.$inferInsert> = {};
    if (dto.code !== undefined) set.code = dto.code;
    if (dto.label !== undefined) set.label = dto.label;
    if (dto.description !== undefined)
      set.description = dto.description ?? null;
    if (dto.sortOrder !== undefined) set.sortOrder = dto.sortOrder ?? null;

    const [row] = await this.db
      .update(codeValue)
      .set(set)
      .where(and(eq(codeValue.id, id), isNull(codeValue.deletedAt)))
      .returning();
    return row ?? null;
  }

  /** Soft-delete a code_value */
  async deleteCodeValue(id: number): Promise<typeof codeValue.$inferSelect | null> {
    const [row] = await this.db
      .update(codeValue)
      .set({ deletedAt: new Date(), isActive: false })
      .where(and(eq(codeValue.id, id), isNull(codeValue.deletedAt)))
      .returning();
    return row ?? null;
  }
}
