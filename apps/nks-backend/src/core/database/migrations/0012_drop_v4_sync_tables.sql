-- Drop the orphan v4 sync tables. Their schema files were removed when the
-- previous sync implementation was retired; the tables remained in the DB
-- because no migration was generated at the time. The v5 sync system uses
-- different tables (processed_operations, device_registration), introduced
-- in the next migration.

DROP TABLE IF EXISTS "idempotency_log";--> statement-breakpoint
DROP TABLE IF EXISTS "revoked_devices";
