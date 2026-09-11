-- #48 card deck management: NFC cards become a first-class, platform-managed
-- asset instead of an invisible by-product of location creation.
--
-- 1. nfc_cards.property_id becomes nullable — "unassigned" deck inventory has
--    no property. Existing (property-bound, active) rows stay untouched and
--    keep their current statuses; new deck-minted cards use unassigned/assigned.
-- 2. Print/history columns: a card records when it was printed, by whom, and
--    how many print exports it has gone through. UID + property are frozen once
--    printed (no edit-UID path exists anywhere).
-- 3. card_deck: platform-wide inventory source of truth — a single row holding
--    the prefix + next sequential number minted from. Replaces the legacy
--    per-property card_pool / uid_start auto-generation on createLocation.
-- 4. nfc_print_profiles: per-org print artwork profiles (front + back template
--    images) used by the print designer.

-- 1. Unassigned cards: no property.
ALTER TABLE "nfc_cards" ALTER COLUMN "property_id" DROP NOT NULL;

-- 2. Print / history fields.
ALTER TABLE "nfc_cards" ADD COLUMN "printed_at" TIMESTAMPTZ;
ALTER TABLE "nfc_cards" ADD COLUMN "printed_by" INTEGER;
ALTER TABLE "nfc_cards" ADD COLUMN "prints_count" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "nfc_cards_status_idx" ON "nfc_cards"("status");

-- 3. Platform deck (single row, id = 1). next_uid starts after the largest
--    legacy numeric UID in the current inventory (7405), so the deck continues
--    the same series. Prefix 'NFC' yields NFC-07405, NFC-07406, ...
CREATE TABLE "card_deck" (
    "id" INTEGER NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT 'NFC',
    "next_uid" BIGINT NOT NULL DEFAULT 7405,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "card_deck_pkey" PRIMARY KEY ("id")
);
INSERT INTO "card_deck" ("id", "next_uid")
VALUES (1, GREATEST(7405, (SELECT COALESCE(MAX(NULLIF(regexp_replace(uid, '[^0-9]', '', 'g'), '')::bigint), 0) + 1 FROM "nfc_cards")))
ON CONFLICT ("id") DO NOTHING;

-- 4. Per-org print profiles.
CREATE TABLE "nfc_print_profiles" (
    "id" INTEGER NOT NULL GENERATED ALWAYS AS IDENTITY,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "front_image_url" TEXT,
    "back_image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nfc_print_profiles_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "nfc_print_profiles_organization_id_idx" ON "nfc_print_profiles"("organization_id");