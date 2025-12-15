-- Remove unique constraint on SKU (allow duplicates/nulls)
DROP INDEX IF EXISTS "products_tenantId_sku_key";

-- Remove unique constraint on taxId in customers (allow duplicates)
DROP INDEX IF EXISTS "customers_tenantId_taxId_key";

-- Add index on taxId for faster lookups
CREATE INDEX IF NOT EXISTS "customers_tenantId_taxId_idx" ON "customers"("tenantId", "taxId");
