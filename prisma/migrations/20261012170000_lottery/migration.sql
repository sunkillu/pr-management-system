-- CreateEnum
CREATE TYPE "LotteryStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "Lottery" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "prizeItems" JSONB NOT NULL,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "status" "LotteryStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Lottery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LotteryEntry" (
    "id" TEXT NOT NULL,
    "lotteryId" TEXT NOT NULL,
    "influencerId" TEXT,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LotteryEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LotteryWinner" (
    "id" TEXT NOT NULL,
    "lotteryId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "prizeName" TEXT NOT NULL,
    "drawnAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "drawnById" TEXT NOT NULL,
    CONSTRAINT "LotteryWinner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lottery_status_updatedAt_id_idx" ON "Lottery"("status", "updatedAt", "id");
CREATE INDEX "LotteryEntry_lotteryId_createdAt_idx" ON "LotteryEntry"("lotteryId", "createdAt");
CREATE UNIQUE INDEX "LotteryWinner_lotteryId_entryId_key" ON "LotteryWinner"("lotteryId", "entryId");
CREATE INDEX "LotteryWinner_lotteryId_idx" ON "LotteryWinner"("lotteryId");

-- AddForeignKey
ALTER TABLE "Lottery" ADD CONSTRAINT "Lottery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LotteryEntry" ADD CONSTRAINT "LotteryEntry_lotteryId_fkey" FOREIGN KEY ("lotteryId") REFERENCES "Lottery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LotteryEntry" ADD CONSTRAINT "LotteryEntry_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LotteryWinner" ADD CONSTRAINT "LotteryWinner_lotteryId_fkey" FOREIGN KEY ("lotteryId") REFERENCES "Lottery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LotteryWinner" ADD CONSTRAINT "LotteryWinner_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LotteryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LotteryWinner" ADD CONSTRAINT "LotteryWinner_drawnById_fkey" FOREIGN KEY ("drawnById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
