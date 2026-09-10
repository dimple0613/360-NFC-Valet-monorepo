-- AlterTable
ALTER TABLE "drivers" ADD COLUMN     "organization_id" TEXT;

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "organization_id" TEXT;

-- CreateIndex
CREATE INDEX "drivers_organization_id_idx" ON "drivers"("organization_id");

-- CreateIndex
CREATE INDEX "properties_organization_id_idx" ON "properties"("organization_id");

-- RenameForeignKey
ALTER TABLE "drivers" RENAME CONSTRAINT "drivers_propertyId_fkey" TO "drivers_property_id_fkey";

-- RenameForeignKey
ALTER TABLE "nfc_cards" RENAME CONSTRAINT "nfc_cards_propertyId_fkey" TO "nfc_cards_property_id_fkey";

-- RenameForeignKey
ALTER TABLE "offers" RENAME CONSTRAINT "offers_propertyId_fkey" TO "offers_property_id_fkey";

-- RenameForeignKey
ALTER TABLE "orders" RENAME CONSTRAINT "orders_cardId_fkey" TO "orders_card_id_fkey";

-- RenameForeignKey
ALTER TABLE "orders" RENAME CONSTRAINT "orders_driverId_fkey" TO "orders_driver_id_fkey";

-- RenameForeignKey
ALTER TABLE "orders" RENAME CONSTRAINT "orders_propertyId_fkey" TO "orders_property_id_fkey";

-- RenameForeignKey
ALTER TABLE "validations" RENAME CONSTRAINT "validations_offerId_fkey" TO "validations_offer_id_fkey";

-- RenameForeignKey
ALTER TABLE "validations" RENAME CONSTRAINT "validations_orderId_fkey" TO "validations_order_id_fkey";

-- RenameForeignKey
ALTER TABLE "zones" RENAME CONSTRAINT "zones_propertyId_fkey" TO "zones_property_id_fkey";
