-- Add isDefaultQuickAccess field to categories for POS default category selection
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "is_default_quick_access" BOOLEAN NOT NULL DEFAULT false;
