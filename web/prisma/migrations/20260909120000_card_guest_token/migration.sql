ALTER TABLE "nfc_cards" ADD COLUMN "guest_token" TEXT NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX "nfc_cards_guest_token_key" ON "nfc_cards"("guest_token");
