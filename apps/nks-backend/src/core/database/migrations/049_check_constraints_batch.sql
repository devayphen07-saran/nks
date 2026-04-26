-- ─── Migration 049: CHECK constraints — M-10, M-11, M-13 ─────────────────────

-- M-10: store_user_mapping — is_active must be false when deleted_at is set.
-- Prevents split-brain: a row cannot be both "active" and "deleted" simultaneously.
ALTER TABLE store_user_mapping
  ADD CONSTRAINT store_user_mapping_active_deleted_consistency
  CHECK (NOT (is_active = true AND deleted_at IS NOT NULL));

-- M-11: store_documents — a verified document must have a document URL.
-- Prevents is_verified=true rows with no file backing the claim.
ALTER TABLE store_documents
  ADD CONSTRAINT store_documents_verified_requires_url
  CHECK (NOT (is_verified = true AND document_url IS NULL));

-- M-13: contact_person — at least one designation source must be present.
-- Either a FK to the designation_type lookup, or a free-text fallback.
ALTER TABLE contact_person
  ADD CONSTRAINT contact_person_designation_required
  CHECK (designation_fk IS NOT NULL OR designation_free_text IS NOT NULL);
