import type { LookupValueResponse } from '../dto/lookups-response.dto';

/**
 * Minimal row shape consumed by {@link LookupValueMapper}. Any source — the
 * generic `lookup` table or a dedicated table that exposes the standard
 * (guuid, code, label, description) tuple — is acceptable. Distinct from the
 * full `LookupValueRow` defined in the repository, which carries audit fields
 * the public API doesn't expose.
 */
export interface LookupSummaryRow {
  guuid: string;
  code: string;
  label: string;
  description: string | null;
}

/**
 * Mapper for generic lookup-style rows.
 *
 * Used wherever a (guuid, code, label, description) tuple needs to be returned
 * to the client — covers both `lookup` table queries (has_table=false) and
 * the simpler dedicated tables (address_type, designation_type) that share
 * the same surface shape.
 */
export class LookupValueMapper {
  static buildLookupValueDto(row: LookupSummaryRow): LookupValueResponse {
    return {
      guuid:       row.guuid,
      code:        row.code,
      title:       row.label,
      description: row.description ?? undefined,
    };
  }
}
