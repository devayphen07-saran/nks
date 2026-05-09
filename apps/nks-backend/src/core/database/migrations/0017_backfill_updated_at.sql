-- Backfill NULL updated_at values from created_at, then enforce NOT NULL with
-- a NOW() default on every coreEntity / baseEntity / betterAuthEntity table.
--
-- Why: Drizzle's $onUpdateFn fires only on UPDATE, so freshly inserted rows
-- ended up with updated_at = NULL. Sync-pull's `WHERE updated_at > cursor`
-- then matched zero rows because NULL comparisons are UNKNOWN. Reference
-- tables seeded once (state, district, lookup, etc.) never synced to mobile.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    -- coreEntity / baseEntity tables
    'address',
    'address_type',
    'billing_frequency',
    'commodity_codes',
    'communication',
    'communication_type',
    'contact_person',
    'country',
    'currency',
    'daily_tax_summary',
    'designation_type',
    'district',
    'entity',
    'entity_type',
    'lookup',
    'lookup_type',
    'notes',
    'notification_status',
    'notification_type',
    'permission_action',
    'pincode',
    'plan_price',
    'plans',
    'roles',
    'routes',
    'staff_invite_status',
    'state',
    'status',
    'store',
    'store_documents',
    'store_operating_hours',
    'subscription',
    'subscription_item',
    'tax_agencies',
    'tax_filing_frequency',
    'tax_levels',
    'tax_names',
    'tax_rate_master',
    'tax_registrations',
    'volumes',
    -- betterAuthEntity tables
    'device_registration',
    'otp_request_log',
    'otp_verification',
    'user_auth_provider',
    'user_session'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    -- Skip tables that don't exist yet (lets this migration run on partial schemas)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      RAISE NOTICE 'Skipping % — table not present', t;
      CONTINUE;
    END IF;

    EXECUTE format('UPDATE %I SET updated_at = created_at WHERE updated_at IS NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN updated_at SET DEFAULT NOW()', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN updated_at SET NOT NULL', t);
  END LOOP;
END $$;
