-- Rename the valet business-table columns from Prisma's default camelCase to
-- the original snake_case names used by the legacy raw-SQL data layer
-- (web/src/app/tenant-admin/_lib/valet-data.ts queries these exact columns).

-- properties
ALTER TABLE "properties" RENAME COLUMN "zonesCount" TO "zones_count";
ALTER TABLE "properties" RENAME COLUMN "slotsCount" TO "slots_count";
ALTER TABLE "properties" RENAME COLUMN "cardPool" TO "card_pool";
ALTER TABLE "properties" RENAME COLUMN "uidStart" TO "uid_start";
ALTER TABLE "properties" RENAME COLUMN "createdAt" TO "created_at";

-- zones
ALTER TABLE "zones" RENAME COLUMN "propertyId" TO "property_id";
ALTER TABLE "zones" RENAME COLUMN "slotCount" TO "slot_count";
ALTER INDEX "zones_propertyId_idx" RENAME TO "zones_property_id_idx";
ALTER INDEX "zones_propertyId_code_key" RENAME TO "zones_property_id_code_key";

-- drivers
ALTER TABLE "drivers" RENAME COLUMN "valetId" TO "valet_id";
ALTER TABLE "drivers" RENAME COLUMN "fullName" TO "full_name";
ALTER TABLE "drivers" RENAME COLUMN "avatarColor" TO "avatar_color";
ALTER TABLE "drivers" RENAME COLUMN "emiratesId" TO "emirates_id";
ALTER TABLE "drivers" RENAME COLUMN "licenseNumber" TO "license_number";
ALTER TABLE "drivers" RENAME COLUMN "emergencyContact" TO "emergency_contact";
ALTER TABLE "drivers" RENAME COLUMN "passwordHash" TO "password_hash";
ALTER TABLE "drivers" RENAME COLUMN "propertyId" TO "property_id";
ALTER TABLE "drivers" RENAME COLUMN "shiftStartedAt" TO "shift_started_at";
ALTER TABLE "drivers" RENAME COLUMN "tokenVersion" TO "token_version";
ALTER TABLE "drivers" RENAME COLUMN "pushToken" TO "push_token";
ALTER TABLE "drivers" RENAME COLUMN "createdAt" TO "created_at";
ALTER INDEX "drivers_valetId_key" RENAME TO "drivers_valet_id_key";
ALTER INDEX "drivers_propertyId_idx" RENAME TO "drivers_property_id_idx";

-- nfc_cards
ALTER TABLE "nfc_cards" RENAME COLUMN "physicalUid" TO "physical_uid";
ALTER TABLE "nfc_cards" RENAME COLUMN "cardNumber" TO "card_number";
ALTER TABLE "nfc_cards" RENAME COLUMN "propertyId" TO "property_id";
ALTER TABLE "nfc_cards" RENAME COLUMN "usesCount" TO "uses_count";
ALTER TABLE "nfc_cards" RENAME COLUMN "lostAt" TO "lost_at";
ALTER TABLE "nfc_cards" RENAME COLUMN "createdAt" TO "created_at";
ALTER INDEX "nfc_cards_propertyId_idx" RENAME TO "nfc_cards_property_id_idx";
ALTER INDEX "nfc_cards_physicalUid_idx" RENAME TO "nfc_cards_physical_uid_idx";

-- offers
ALTER TABLE "offers" RENAME COLUMN "propertyId" TO "property_id";
ALTER TABLE "offers" RENAME COLUMN "wasPrice" TO "was_price";
ALTER TABLE "offers" RENAME COLUMN "validatesValet" TO "validates_valet";
ALTER TABLE "offers" RENAME COLUMN "endsOn" TO "ends_on";
ALTER TABLE "offers" RENAME COLUMN "views7d" TO "views_7d";
ALTER TABLE "offers" RENAME COLUMN "opensAt" TO "opens_at";
ALTER TABLE "offers" RENAME COLUMN "closesAt" TO "closes_at";
ALTER TABLE "offers" RENAME COLUMN "staffCode" TO "staff_code";
ALTER TABLE "offers" RENAME COLUMN "dealTag" TO "deal_tag";
ALTER TABLE "offers" RENAME COLUMN "imageUrl" TO "image_url";
ALTER TABLE "offers" RENAME COLUMN "menuUrl" TO "menu_url";
ALTER TABLE "offers" RENAME COLUMN "createdAt" TO "created_at";
ALTER INDEX "offers_propertyId_idx" RENAME TO "offers_property_id_idx";

-- orders
ALTER TABLE "orders" RENAME COLUMN "propertyId" TO "property_id";
ALTER TABLE "orders" RENAME COLUMN "cardId" TO "card_id";
ALTER TABLE "orders" RENAME COLUMN "driverId" TO "driver_id";
ALTER TABLE "orders" RENAME COLUMN "carMake" TO "car_make";
ALTER TABLE "orders" RENAME COLUMN "carModel" TO "car_model";
ALTER TABLE "orders" RENAME COLUMN "carColor" TO "car_color";
ALTER TABLE "orders" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "orders" RENAME COLUMN "droppedAt" TO "dropped_at";
ALTER TABLE "orders" RENAME COLUMN "returnedAt" TO "returned_at";
ALTER TABLE "orders" RENAME COLUMN "guestEta" TO "guest_eta";
ALTER INDEX "orders_propertyId_status_idx" RENAME TO "orders_property_id_status_idx";
ALTER INDEX "orders_createdAt_idx" RENAME TO "orders_created_at_idx";
ALTER INDEX "orders_returnedAt_idx" RENAME TO "orders_returned_at_idx";

-- validations
ALTER TABLE "validations" RENAME COLUMN "orderId" TO "order_id";
ALTER TABLE "validations" RENAME COLUMN "offerId" TO "offer_id";
ALTER TABLE "validations" RENAME COLUMN "createdAt" TO "created_at";
ALTER INDEX "validations_createdAt_idx" RENAME TO "validations_created_at_idx";
