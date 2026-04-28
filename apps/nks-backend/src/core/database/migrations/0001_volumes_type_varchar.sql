-- Converts volumes.volume_type from a PostgreSQL enum to varchar(50).
-- Motivation: adding a new category (e.g. 'temperature') previously required
-- an ALTER TYPE migration. varchar(50) allows new categories via seed data only.
-- Non-destructive: existing values ('weight', 'volume', 'length', 'count', 'area') are preserved.

ALTER TABLE "volumes" ALTER COLUMN "volume_type" TYPE varchar(50) USING "volume_type"::text;--> statement-breakpoint
DROP TYPE IF EXISTS "volume_type";
