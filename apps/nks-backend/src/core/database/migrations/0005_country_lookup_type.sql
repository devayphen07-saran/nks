-- ─────────────────────────────────────────────────────────────────────────────
-- 0004 — Register COUNTRY in lookup_type
--
-- Why:
--   COUNTRY is exposed via the unified GET /lookups/:typeCode endpoint, but
--   migration 0003 deliberately omitted it from lookup_type because country is
--   a structural entity (continent_fk, ISO codes, currency_fk, …) rather than
--   a generic value list. The unified endpoint resolves slugs against the
--   lookup_type registry, so the missing row caused 404 LOOKUP_NOT_FOUND when
--   clients called /lookups/countries (regression introduced when the
--   per-slug switch was replaced with DB-driven routing).
--
-- What:
--   Add COUNTRY as has_table=true. The country table itself is unchanged;
--   this row only registers it in the catalog so the unified dispatcher can
--   route to the existing CountryRepository.getCountries() handler.
--
-- Idempotent: ON CONFLICT DO NOTHING — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "lookup_type" ("guuid", "code", "title", "has_table", "is_system", "created_at")
VALUES (gen_random_uuid(), 'COUNTRY', 'Country', true, true, now())
ON CONFLICT DO NOTHING;
