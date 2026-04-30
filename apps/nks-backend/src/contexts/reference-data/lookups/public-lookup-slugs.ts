/**
 * Public lookup slug → lookup_type.code translation table.
 *
 * The HTTP route `GET /lookups/:slugOrCode` accepts either:
 *   - a friendly kebab-case slug (e.g. "address-types") — for backwards
 *     compatibility with existing clients
 *   - a direct lookup_type.code (e.g. "ADDRESS_TYPE")    — preferred for new
 *     integrations and any lookup_type seeded later
 *
 * `resolvePublicLookupCode` normalises the input to the canonical code so the
 * service layer can do a single DB lookup against `lookup_type.code`.
 *
 * Adding a new lookup type:
 *   - has_table=false → no change here; INSERT into lookup_type and clients
 *     can immediately call /lookups/MY_NEW_TYPE.
 *   - has_table=true  → no change here either; the dispatcher in
 *     LookupsQueryService.getDedicatedLookup() needs a case for the new code.
 *   - You only need to add a slug entry below if you want a friendlier URL
 *     than the raw lookup_type.code.
 */
const PUBLIC_LOOKUP_SLUGS: Readonly<Record<string, string>> = {
  salutations:           'SALUTATION',
  countries:             'COUNTRY',
  'address-types':       'ADDRESS_TYPE',
  'communication-types': 'COMMUNICATION_TYPE',
  designations:          'DESIGNATION_TYPE',
  'store-legal-types':   'STORE_LEGAL_TYPE',
  'store-categories':    'STORE_CATEGORY',
  currencies:            'CURRENCY',
  volumes:               'VOLUMES',
};

/**
 * Convert any of {kebab-slug | UPPER_SNAKE_CODE | mixed} to lookup_type.code.
 * Pure function; safe to call multiple times.
 */
export function resolvePublicLookupCode(input: string): string {
  const slug = input.toLowerCase();
  return PUBLIC_LOOKUP_SLUGS[slug] ?? input.toUpperCase().replace(/-/g, '_');
}
