-- CreateEnum
CREATE TYPE "TicketSubType" AS ENUM ('SUBMIT', 'SAMPLE', 'SCHEDULE', 'REVIEW', 'PUBLISH', 'DATA', 'SETTLE');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('PUBLISH_7D', 'REVIEW_3D', 'PUBLISH_1D', 'OVERDUE_7D', 'DATA_7D', 'SAMPLE_7D', 'SCHEDULE_FILL');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'DONE', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DataTaskStatus" AS ENUM ('PENDING', 'COLLECTED', 'MISSING');

-- DropIndex
DROP INDEX IF EXISTS "Content_ticketId_idx";

-- DropIndex
DROP INDEX IF EXISTS "CooperationTicket_assigneeId_idx";

-- DropIndex
DROP INDEX IF EXISTS "CooperationTicket_ticketKind_idx";

-- AlterTable
ALTER TABLE "CooperationTicket" ADD COLUMN     "confirmedDate" DATE,
ADD COLUMN     "estimatedPublishMonth" TEXT,
ADD COLUMN     "forceAt" TIMESTAMP(3),
ADD COLUMN     "forceById" TEXT,
ADD COLUMN     "forceCreated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "forceReason" TEXT,
ADD COLUMN     "occupiesResource" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "publishDate" DATE,
ADD COLUMN IF NOT EXISTS "publishLink" TEXT,
ADD COLUMN     "quoteAmount" DECIMAL(12,2),
ADD COLUMN     "resourceOccupiedAt" TIMESTAMP(3),
ADD COLUMN     "subType" "TicketSubType",
ALTER COLUMN "style" DROP DEFAULT,
ALTER COLUMN "coopCategory" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Influencer" ADD COLUMN     "email" TEXT,
ADD COLUMN     "lastPublishDate" DATE,
ADD COLUMN     "occupiedByTicketId" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "wechat" TEXT,
ALTER COLUMN "tags" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MaterialRecord" ADD COLUMN     "coopTypeDetail" TEXT,
ADD COLUMN     "coverSkipReason" TEXT,
ADD COLUMN     "dataCollected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "influencerName" TEXT,
ADD COLUMN     "isCoverSample" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentTicketId" TEXT,
ADD COLUMN     "platform" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "publishDate" DATE,
ADD COLUMN     "style" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "SampleShipment" ADD COLUMN     "abnormalFlag" TEXT,
ADD COLUMN     "logisticsCheckedAt" TIMESTAMP(3),
ADD COLUMN     "logisticsStatus" TEXT,
ADD COLUMN     "overdueWarnedAt" TIMESTAMP(3),
ADD COLUMN     "scheduleRemindedAt" TIMESTAMP(3),
ADD COLUMN     "shippedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ScheduleChangeLog" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "oldDate" DATE,
    "newDate" DATE,
    "changedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensitiveAccessLog" (
    "id" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "fields" TEXT[],
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensitiveAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderTask" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataCollectionTask" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "publishLink" TEXT,
    "metrics" JSONB,
    "status" "DataTaskStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataCollectionTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataCollectionMonthly" (
    "id" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataCollectionMonthly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleChangeLog_ticketId_createdAt_idx" ON "ScheduleChangeLog"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "SensitiveAccessLog_targetType_targetId_createdAt_idx" ON "SensitiveAccessLog"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "SensitiveAccessLog_viewerId_createdAt_idx" ON "SensitiveAccessLog"("viewerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderTask_idempotencyKey_key" ON "ReminderTask"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ReminderTask_status_scheduledAt_idx" ON "ReminderTask"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "ReminderTask_ticketId_type_idx" ON "ReminderTask"("ticketId", "type");

-- CreateIndex
CREATE INDEX "DataCollectionTask_ticketId_idx" ON "DataCollectionTask"("ticketId");

-- CreateIndex
CREATE INDEX "DataCollectionTask_status_dueAt_idx" ON "DataCollectionTask"("status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "DataCollectionMonthly_yearMonth_key" ON "DataCollectionMonthly"("yearMonth");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CooperationRequest_influencerId_fkey') THEN
    ALTER TABLE "CooperationRequest" ADD CONSTRAINT "CooperationRequest_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CooperationTicket_coopRequestId_fkey') THEN
    ALTER TABLE "CooperationTicket" ADD CONSTRAINT "CooperationTicket_coopRequestId_fkey" FOREIGN KEY ("coopRequestId") REFERENCES "CooperationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
ALTER TABLE "CooperationTicket" ADD CONSTRAINT "CooperationTicket_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CooperationTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperationTicket" ADD CONSTRAINT "CooperationTicket_forceById_fkey" FOREIGN KEY ("forceById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChangeLog" ADD CONSTRAINT "ScheduleChangeLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CooperationTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChangeLog" ADD CONSTRAINT "ScheduleChangeLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensitiveAccessLog" ADD CONSTRAINT "SensitiveAccessLog_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderTask" ADD CONSTRAINT "ReminderTask_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CooperationTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataCollectionTask" ADD CONSTRAINT "DataCollectionTask_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CooperationTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
