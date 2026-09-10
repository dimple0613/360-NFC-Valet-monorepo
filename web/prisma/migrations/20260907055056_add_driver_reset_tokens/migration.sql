-- CreateTable
CREATE TABLE "driver_reset_tokens" (
    "id" SERIAL NOT NULL,
    "driver_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "driver_reset_tokens_token_hash_idx" ON "driver_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "driver_reset_tokens_driver_id_used_idx" ON "driver_reset_tokens"("driver_id", "used");

-- AddForeignKey
ALTER TABLE "driver_reset_tokens" ADD CONSTRAINT "driver_reset_tokens_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
