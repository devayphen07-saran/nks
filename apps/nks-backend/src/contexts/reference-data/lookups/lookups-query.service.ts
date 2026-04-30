import { Injectable, Logger } from '@nestjs/common';
import { NotFoundException } from '../../../common/exceptions';
import { LookupsRepository } from './repositories/lookups.repository';
import type { LookupTypeRef } from './repositories/lookups.repository';
import { LookupValueMapper, LookupMapper, AdminLookupMapper } from './mapper/lookups.mapper';
import { ErrorCode, errPayload } from '../../../common/constants/error-codes.constants';
import { paginated } from '../../../common/utils/paginated-result';
import { resolvePublicLookupCode } from './public-lookup-slugs';
import type { PaginatedResult } from '../../../common/utils/paginated-result';
import type {
  LookupValueResponse,
  CountryResponse,
  CommunicationTypeResponse,
  CurrencyResponse,
  VolumeResponse,
  PublicLookupItem,
  BatchLookupResponse,
} from './dto/lookups-response.dto';
import type {
  LookupTypesListResponse,
  LookupValueAdminResponse,
} from './dto/admin-lookups.dto';

@Injectable()
export class LookupsQueryService {
  private readonly logger = new Logger(LookupsQueryService.name);
  private readonly lookupTypeCache = new Map<string, LookupTypeRef>();

  constructor(private readonly repository: LookupsRepository) {}

  private async findLookupTypeCached(code: string): Promise<LookupTypeRef | null> {
    const cached = this.lookupTypeCache.get(code);
    if (cached) return cached;
    const type = await this.repository.findLookupTypeByCode(code);
    if (type) this.lookupTypeCache.set(code, type);
    return type ?? null;
  }

  // ── Dedicated-table lookup helpers ────────────────────────────────────────
  // Each returns the type-specific shape used by the unified dispatcher below.
  // has_table=false types (SALUTATION, STORE_LEGAL_TYPE, STORE_CATEGORY, …)
  // are handled directly by getPublicLookup() against the generic `lookup`
  // table — no per-type wrapper needed.

  // ADDRESS_TYPE is a dedicated table — query it directly
  private async getAddressTypes(): Promise<LookupValueResponse[]> {
    return (await this.repository.getAddressTypesFromTable()).map(LookupValueMapper.buildLookupValueDto);
  }

  // DESIGNATION_TYPE is a dedicated table — query it directly
  private async getDesignations(): Promise<LookupValueResponse[]> {
    return (await this.repository.getDesignationTypesFromTable()).map(LookupValueMapper.buildLookupValueDto);
  }

  private async getCountries(): Promise<CountryResponse[]> {
    return (await this.repository.getCountries()).map(LookupMapper.buildCountryDto);
  }

  private async getCommunicationTypes(): Promise<CommunicationTypeResponse[]> {
    return (await this.repository.getCommunicationTypes()).map(LookupMapper.buildCommunicationTypeDto);
  }

  private async getCurrencies(): Promise<CurrencyResponse[]> {
    return (await this.repository.getCurrencies()).map(LookupMapper.buildCurrencyDto);
  }

  private async getVolumes(): Promise<VolumeResponse[]> {
    return (await this.repository.getVolumes()).map(LookupMapper.buildVolumeDto);
  }

  /**
   * Unified public-lookup endpoint — DB-driven routing via lookup_type registry.
   *
   * Accepts a lookup_type.code or a friendly kebab-case slug; both resolve to
   * the same canonical code via {@link resolvePublicLookupCode}.
   *
   * Routing:
   *   - lookup_type.has_table = false → query the generic `lookup` table.
   *     Adding a new value list works with no code change here.
   *   - lookup_type.has_table = true  → dispatch to the dedicated-table handler
   *     in {@link getDedicatedLookup}. New dedicated tables need a new case
   *     there so their type-specific shape can be returned.
   *
   * Returns 404 (LOOKUP_NOT_FOUND) when the resolved code isn't registered or
   * a dedicated type has no wired handler.
   */
  async getPublicLookup(slugOrCode: string): Promise<PublicLookupItem[]> {
    const typeCode = resolvePublicLookupCode(slugOrCode);
    const type = await this.findLookupTypeCached(typeCode);
    if (!type) {
      this.logger.warn(`Lookup type not found: input='${slugOrCode}' resolved='${typeCode}'`);
      throw new NotFoundException(errPayload(ErrorCode.LOOKUP_NOT_FOUND));
    }

    if (!type.hasTable) {
      const rows = await this.repository.getValuesByType(typeCode);
      return rows.map(LookupValueMapper.buildLookupValueDto);
    }
    return this.getDedicatedLookup(typeCode);
  }

  /**
   * Dispatch to the dedicated-table handler for a `has_table=true` lookup type.
   * Each case maps the type-specific row shape to its public response DTO.
   *
   * NOTE: A `has_table=true` row in `lookup_type` without a case here is a
   * deliberate non-public signal (e.g. ENTITY_TYPE, NOTIFICATION_STATUS,
   * STAFF_INVITE_STATUS, TAX_FILING_FREQUENCY, BILLING_FREQUENCY are internal-
   * only). Do not blindly auto-route every dedicated table — internal types
   * should not leak through the public endpoint.
   */
  private getDedicatedLookup(typeCode: string): Promise<PublicLookupItem[]> {
    switch (typeCode) {
      case 'COUNTRY':            return this.getCountries();
      case 'COMMUNICATION_TYPE': return this.getCommunicationTypes();
      case 'CURRENCY':           return this.getCurrencies();
      case 'VOLUMES':            return this.getVolumes();
      case 'ADDRESS_TYPE':       return this.getAddressTypes();
      case 'DESIGNATION_TYPE':   return this.getDesignations();
      default:
        // lookup_type.has_table=true but intentionally not exposed publicly.
        throw new NotFoundException(errPayload(ErrorCode.LOOKUP_NOT_FOUND));
    }
  }

  /**
   * Fetch multiple lookup types in a single round-trip.
   * Runs all fetches in parallel. If a type is unknown or not public, its key
   * maps to an empty array — the whole batch never fails due to one bad type.
   */
  async getBatchLookups(types: string[]): Promise<BatchLookupResponse> {
    const entries = await Promise.all(
      types.map(async (input) => {
        try {
          const items = await this.getPublicLookup(input);
          return [input, items] as const;
        } catch {
          return [input, [] as PublicLookupItem[]] as const;
        }
      }),
    );
    return Object.fromEntries(entries);
  }

  // ── Admin lookup endpoints ────────────────────────────────────────────────

  async getAllLookupTypes(): Promise<LookupTypesListResponse> {
    return this.repository.findAllLookupTypes();
  }

  async listLookupValues(
    typeCode: string,
    opts: { page: number; pageSize: number; search?: string; sortBy?: string; sortOrder?: string; isActive?: boolean },
  ): Promise<PaginatedResult<LookupValueAdminResponse>> {
    const type = await this.findLookupTypeCached(typeCode);
    if (!type) {
      this.logger.warn(`Admin lookup type not found: typeCode='${typeCode}'`);
      throw new NotFoundException(errPayload(ErrorCode.LOOKUP_CATEGORY_NOT_FOUND));
    }

    // Route to the correct table based on hasTable flag
    const { rows, total } = type.hasTable
      ? await this.repository.findDedicatedLookupValues(typeCode, opts)
      : await this.repository.findLookupValuesByType(typeCode, opts);

    return paginated({ items: rows.map(AdminLookupMapper.buildLookupValueDto), page: opts.page, pageSize: opts.pageSize, total });
  }
}
