-- CreateEnum
CREATE TYPE "LedgerStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateTable
CREATE TABLE "InfluencerLedger" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "homeUrl" TEXT NOT NULL,
    "platform" TEXT,
    "nickname" TEXT,
    "accountId" TEXT,
    "status" "LedgerStatus" NOT NULL DEFAULT 'DRAFT',
    "influencerId" TEXT,
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photoUrl" TEXT,
    "budget" DECIMAL(12,2),
    "schedule" TEXT,
    "quote" DECIMAL(12,2),
    "sampleInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfluencerLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InfluencerLedger_ownerId_status_idx" ON "InfluencerLedger"("ownerId", "status");
CREATE INDEX "InfluencerLedger_accountId_idx" ON "InfluencerLedger"("accountId");
CREATE INDEX "Influencer_homepageId_idx" ON "Influencer"("homepageId");

-- AddForeignKey
ALTER TABLE "InfluencerLedger" ADD CONSTRAINT "InfluencerLedger_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InfluencerLedger" ADD CONSTRAINT "InfluencerLedger_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
