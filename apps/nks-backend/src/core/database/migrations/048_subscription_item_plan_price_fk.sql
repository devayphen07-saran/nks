-- ─── Migration 048: subscription_item — planPriceFk NOT NULL + restrict ────────
--
-- Problem: plan_price_fk was nullable with ON DELETE SET NULL. If a price tier
-- was deleted, the subscription_item row survived with plan_price_fk = NULL —
-- losing the financial record of what the subscriber was charged.
--
-- Fix: NOT NULL + ON DELETE RESTRICT. Price tiers with active subscription items
-- cannot be deleted; archive them instead (is_active = false).
--
-- Assumes all existing subscription_item rows already have a valid plan_price_fk.
-- If any NULL rows exist, resolve them before running this migration.

ALTER TABLE subscription_item
  ALTER COLUMN plan_price_fk SET NOT NULL;

ALTER TABLE subscription_item
  DROP CONSTRAINT IF EXISTS subscription_item_plan_price_fk_fkey;

ALTER TABLE subscription_item
  ADD CONSTRAINT subscription_item_plan_price_fk_fkey
  FOREIGN KEY (plan_price_fk) REFERENCES plan_price(id) ON DELETE RESTRICT;
