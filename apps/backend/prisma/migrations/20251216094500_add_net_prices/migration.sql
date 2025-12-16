-- AlterTable ProductPrice: Add priceNet (precio neto sin IVA)
ALTER TABLE "product_prices" ADD COLUMN "priceNet" DECIMAL(12,2);

-- AlterTable SaleItem: Add unitPriceNet (precio unitario neto sin IVA)
ALTER TABLE "sale_items" ADD COLUMN "unitPriceNet" DECIMAL(12,2);
