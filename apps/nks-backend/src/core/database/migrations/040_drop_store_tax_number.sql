-- ─── Migration 040: store — drop redundant tax_number column ─────────────────
--
-- Problem: store.tax_number duplicates data already stored with more structure
-- in tax_registrations (registration number, type, jurisdiction, validity).
-- Storing plaintext GST/PAN in the main store row also means any store SELECT
-- includes PII that should only be read when explicitly needed.
--
-- Authoritative source: tax_registrations table (storeFk FK, registrationNumber,
-- taxRegistrationTypeFk, jurisdictionCode, isActive).
--
-- No services or DTOs reference store.tax_number — safe to drop.

ALTER TABLE store DROP COLUMN IF EXISTS tax_number;
