-- CreateTable
CREATE TABLE "properties" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Dubai',
    "slug" TEXT NOT NULL,
    "zonesCount" INTEGER NOT NULL DEFAULT 4,
    "slotsCount" INTEGER NOT NULL DEFAULT 160,
    "cardPool" INTEGER NOT NULL DEFAULT 200,
    "uidStart" BIGINT NOT NULL DEFAULT 7001,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "slotCount" INTEGER NOT NULL DEFAULT 45,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" SERIAL NOT NULL,
    "valetId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "avatarColor" TEXT NOT NULL DEFAULT '#1C2B46',
    "email" TEXT,
    "phone" TEXT,
    "emiratesId" TEXT,
    "licenseNumber" TEXT,
    "nationality" TEXT,
    "emergencyContact" TEXT,
    "pin" TEXT,
    "passwordHash" TEXT,
    "propertyId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'off_duty',
    "shiftStartedAt" TIMESTAMP(3),
    "role" TEXT NOT NULL DEFAULT 'driver',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "pushToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfc_cards" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "physicalUid" TEXT,
    "cardNumber" TEXT,
    "propertyId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "usesCount" INTEGER NOT NULL DEFAULT 0,
    "lostAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfc_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "wasPrice" DECIMAL(10,2),
    "description" TEXT,
    "featured" INTEGER,
    "live" BOOLEAN NOT NULL DEFAULT false,
    "draft" BOOLEAN NOT NULL DEFAULT false,
    "validatesValet" BOOLEAN NOT NULL DEFAULT true,
    "endsOn" TIMESTAMP(3),
    "views7d" INTEGER NOT NULL DEFAULT 0,
    "rating" DECIMAL(2,1) NOT NULL DEFAULT 0,
    "reviews" INTEGER NOT NULL DEFAULT 0,
    "level" TEXT,
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "staffCode" TEXT,
    "dealTag" TEXT,
    "imageUrl" TEXT,
    "menuUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "cardId" INTEGER,
    "driverId" INTEGER,
    "plate" TEXT NOT NULL,
    "carMake" TEXT,
    "carModel" TEXT,
    "carColor" TEXT,
    "zone" TEXT,
    "slot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "droppedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "guestEta" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validations" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "offerId" INTEGER,
    "outlet" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "properties_slug_key" ON "properties"("slug");

-- CreateIndex
CREATE INDEX "zones_propertyId_idx" ON "zones"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "zones_propertyId_code_key" ON "zones"("propertyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_valetId_key" ON "drivers"("valetId");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_email_key" ON "drivers"("email");

-- CreateIndex
CREATE INDEX "drivers_propertyId_idx" ON "drivers"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "nfc_cards_uid_key" ON "nfc_cards"("uid");

-- CreateIndex
CREATE INDEX "nfc_cards_propertyId_idx" ON "nfc_cards"("propertyId");

-- CreateIndex
CREATE INDEX "nfc_cards_physicalUid_idx" ON "nfc_cards"("physicalUid");

-- CreateIndex
CREATE INDEX "offers_propertyId_idx" ON "offers"("propertyId");

-- CreateIndex
CREATE INDEX "orders_propertyId_status_idx" ON "orders"("propertyId", "status");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- CreateIndex
CREATE INDEX "orders_returnedAt_idx" ON "orders"("returnedAt");

-- CreateIndex
CREATE INDEX "validations_createdAt_idx" ON "validations"("createdAt");

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfc_cards" ADD CONSTRAINT "nfc_cards_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "nfc_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validations" ADD CONSTRAINT "validations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validations" ADD CONSTRAINT "validations_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
