-- AlterTable: Add quick access fields to Category
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "isQuickAccess" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "quickAccessOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "quickAccessColor" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "quickAccessIcon" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Category_tenantId_isQuickAccess_quickAccessOrder_idx" ON "Category"("tenantId", "isQuickAccess", "quickAccessOrder");
