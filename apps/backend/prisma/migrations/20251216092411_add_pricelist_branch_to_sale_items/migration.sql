-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN "priceListId" TEXT;
ALTER TABLE "sale_items" ADD COLUMN "branchId" TEXT;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
