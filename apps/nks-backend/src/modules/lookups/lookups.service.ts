import { Injectable } from '@nestjs/common';
import { LookupsRepository } from './lookups.repository';
import {
  toSalutationResponse,
  toAddressTypeResponse,
  toDesignationResponse,
  toStoreLegalTypeResponse,
  toStoreCategoryResponse,
  toCountryResponse,
  toCommunicationTypeResponse,
  toCurrencyResponse,
  toVolumeResponse,
} from './mapper/lookups.mapper';
import type {
  SalutationsListResponse,
  CountriesListResponse,
  AddressTypesListResponse,
  CommunicationTypesListResponse,
  DesignationsListResponse,
  StoreLegalTypesListResponse,
  StoreCategoriesListResponse,
  CurrenciesListResponse,
  VolumesListResponse,
  PlanTypesListResponse,
  TaxLineStatusesListResponse,
  EntityTypesListResponse,
  NotificationStatusesListResponse,
  StaffInviteStatusesListResponse,
  BillingFrequenciesListResponse,
  TaxRegistrationTypesListResponse,
  TaxFilingFrequenciesListResponse,
} from './dto/lookups-response.dto';
import type {
  CreateLookupValueDto,
  UpdateLookupValueDto,
  LookupTypesListResponse,
  LookupValuesListResponse,
} from './dto/admin-lookups.dto';

@Injectable()
export class LookupsService {
  constructor(private readonly repository: LookupsRepository) {}

  // ── Public: code-value family (salutations, address types, …) ────────────

  /**
   * Get all salutation titles (Mr., Mrs., Ms., Dr., Prof., etc.).
   * Used in user profiles and forms for formal addressing.
   *
   * @returns List of salutation lookup values sorted by display order
   */
  async getSalutations(): Promise<SalutationsListResponse> {
    const rows = await this.repository.getSalutations();
    return rows.map(toSalutationResponse);
  }

  /**
   * Get all address types (Residential, Commercial, Billing, Shipping, etc.).
   * Defines the categories for user addresses.
   *
   * @returns List of address type lookup values
   */
  async getAddressTypes(): Promise<AddressTypesListResponse> {
    const rows = await this.repository.getAddressTypes();
    return rows.map(toAddressTypeResponse);
  }

  /**
   * Get all job designations (Manager, Assistant, Coordinator, etc.).
   * Used for staff classification and authorization context.
   *
   * @returns List of designation lookup values
   */
  async getDesignations(): Promise<DesignationsListResponse> {
    const rows = await this.repository.getDesignations();
    return rows.map(toDesignationResponse);
  }

  /**
   * Get all store legal entity types (Sole Proprietor, Partnership, Corporation, etc.).
   * Used during store registration and KYC validation.
   *
   * @returns List of legal entity type lookup values
   */
  async getStoreLegalTypes(): Promise<StoreLegalTypesListResponse> {
    const rows = await this.repository.getStoreLegalTypes();
    return rows.map(toStoreLegalTypeResponse);
  }

  /**
   * Get all store categories (Retail, Wholesale, E-commerce, etc.).
   * Categorizes stores by their business model and operational scope.
   *
   * @returns List of store category lookup values
   */
  async getStoreCategories(): Promise<StoreCategoriesListResponse> {
    const rows = await this.repository.getStoreCategories();
    return rows.map(toStoreCategoryResponse);
  }

  /**
   * Get all countries for global operations.
   * Primarily used for address forms and shipping destinations.
   *
   * @returns List of country lookup values
   */
  async getCountries(): Promise<CountriesListResponse> {
    const rows = await this.repository.getCountries();
    return rows.map(toCountryResponse);
  }

  /**
   * Get all communication channels (Email, SMS, WhatsApp, Phone, etc.).
   * Used for customer communication preferences and notification settings.
   *
   * @returns List of communication type lookup values
   */
  async getCommunicationTypes(): Promise<CommunicationTypesListResponse> {
    const rows = await this.repository.getCommunicationTypes();
    return rows.map(toCommunicationTypeResponse);
  }

  /**
   * Get all currencies for multi-currency transactions.
   * Used in product pricing, invoicing, and financial reports.
   *
   * @returns List of currency lookup values
   */
  async getCurrencies(): Promise<CurrenciesListResponse> {
    const rows = await this.repository.getCurrencies();
    return rows.map(toCurrencyResponse);
  }

  /**
   * Get all volume/measurement units (kg, liter, piece, box, etc.).
   * Used for inventory management and product specifications.
   *
   * @returns List of volume lookup values
   */
  async getVolumes(): Promise<VolumesListResponse> {
    const rows = await this.repository.getVolumes();
    return rows.map(toVolumeResponse);
  }

  // ── Public: specialized lookups (not tied to code-value tables) ──────────

  /**
   * Get all billing plan types (Monthly, Quarterly, Annual, etc.).
   * Defines subscription billing cycles and pricing models.
   *
   * @returns List of plan type lookup values
   */
  async getPlanTypes(): Promise<PlanTypesListResponse> {
    return this.repository.getPlanTypes();
  }

  /**
   * Get all tax line statuses (Taxable, Exempt, Zero-rated, Reverse charge, etc.).
   * Used for tax calculation and compliance in invoicing.
   *
   * @returns List of tax line status lookup values
   */
  async getTaxLineStatuses(): Promise<TaxLineStatusesListResponse> {
    return this.repository.getTaxLineStatuses();
  }

  /**
   * Get all entity types (Customer, Vendor, Employee, Store, etc.).
   * Categorizes different actors in the system for permission and audit purposes.
   *
   * @returns List of entity type lookup values
   */
  async getEntityTypes(): Promise<EntityTypesListResponse> {
    return this.repository.getEntityTypes();
  }

  /**
   * Get all notification statuses (Pending, Sent, Failed, Bounced, etc.).
   * Tracks the delivery state of notifications across multiple channels.
   *
   * @returns List of notification status lookup values
   */
  async getNotificationStatuses(): Promise<NotificationStatusesListResponse> {
    return this.repository.getNotificationStatuses();
  }

  /**
   * Get all staff invitation statuses (Pending, Accepted, Declined, Expired, etc.).
   * Tracks the lifecycle of staff invitation workflows.
   *
   * @returns List of staff invite status lookup values
   */
  async getStaffInviteStatuses(): Promise<StaffInviteStatusesListResponse> {
    return this.repository.getStaffInviteStatuses();
  }

  /**
   * Get all billing frequencies (Monthly, Quarterly, Annual, etc.).
   * Defines recurring billing cycles for subscriptions and services.
   *
   * @returns List of billing frequency lookup values
   */
  async getBillingFrequencies(): Promise<BillingFrequenciesListResponse> {
    return this.repository.getBillingFrequencies();
  }

  /**
   * Get all tax registration types (VAT/GST, Pan, CIN, etc.).
   * Defines types of tax registration numbers and identifiers.
   *
   * @returns List of tax registration type lookup values
   */
  async getTaxRegistrationTypes(): Promise<TaxRegistrationTypesListResponse> {
    return this.repository.getTaxRegistrationTypes();
  }

  /**
   * Get all tax filing frequencies (Monthly, Quarterly, Annual, etc.).
   * Defines the frequency of tax filing obligations and deadlines.
   *
   * @returns List of tax filing frequency lookup values
   */
  async getTaxFilingFrequencies(): Promise<TaxFilingFrequenciesListResponse> {
    return this.repository.getTaxFilingFrequencies();
  }

  // ── Admin: Generic code-value lookups ───────────────────────────────────

  /**
   * Get all custom lookup types (categories).
   */
  async getAllLookupTypes(): Promise<LookupTypesListResponse> {
    return this.repository.findAllCodeCategories();
  }

  /**
   * Get all lookup values for a specific category code.
   */
  async getLookupValues(
    categoryCode: string,
  ): Promise<LookupValuesListResponse> {
    return this.repository.findCodeValuesByCategory(categoryCode);
  }

  /**
   * Create a new lookup value in a specific category.
   */
  async createLookupValue(
    categoryCode: string,
    dto: CreateLookupValueDto,
  ): Promise<any> {
    const category = await this.repository.findCodeCategoryByCode(categoryCode);
    if (!category) {
      throw new Error(`Category '${categoryCode}' not found`);
    }
    return this.repository.createCodeValue(category.id, dto);
  }

  /**
   * Update an existing lookup value.
   */
  async updateLookupValue(
    categoryCode: string,
    id: number,
    dto: UpdateLookupValueDto,
  ): Promise<any> {
    // Verify the value exists in the category
    const value = await this.repository.findCodeValueById(id);
    if (!value) {
      throw new Error(`Lookup value with ID ${id} not found`);
    }
    return this.repository.updateCodeValue(id, dto);
  }

  /**
   * Delete a lookup value.
   */
  async deleteLookupValue(categoryCode: string, id: number): Promise<any> {
    return this.repository.deleteCodeValue(id);
  }
}
