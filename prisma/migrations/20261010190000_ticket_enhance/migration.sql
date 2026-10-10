-- 工单增强：新字段（编号/平台/款式/类目/备注/主页ID/超预算特批/跟进到期）
-- + TicketStatus 新增 FOLLOW_UP + FollowUpRecord 表 + Influencer.homepageId

-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'FOLLOW_UP';

-- AlterTable: CooperationTicket 新增字段
ALTER TABLE "CooperationTicket" ADD COLUMN "ticketNo" TEXT;
ALTER TABLE "CooperationTicket" ADD COLUMN "style" TEXT;
ALTER TABLE "CooperationTicket" ADD COLUMN "contentDirection" TEXT;
ALTER TABLE "CooperationTicket" ADD COLUMN "coopCategory" TEXT;
ALTER TABLE "CooperationTicket" ADD COLUMN "priceNote" TEXT;
ALTER TABLE "CooperationTicket" ADD COLUMN "contentNote" TEXT;
ALTER TABLE "CooperationTicket" ADD COLUMN "platform" TEXT;
ALTER TABLE "CooperationTicket" ADD COLUMN "homepageId" TEXT;
ALTER TABLE "CooperationTicket" ADD COLUMN "budgetOverridden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CooperationTicket" ADD COLUMN "followUpDueDate" TIMESTAMP(3);

-- 回填存量工单编号：按创建日期分组，YYYYMMDD + 4位序号
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY createdAt::date ORDER BY createdAt, id) AS rn,
           createdAt
    FROM "CooperationTicket"
  LOOP
    UPDATE "CooperationTicket"
    SET "ticketNo" = to_char(r.createdAt, 'YYYYMMDD') || lpad(r.rn::text, 4, '0')
    WHERE id = r.id;
  END LOOP;
END $$;

-- 存量 platform 置空字符串（新建时必填由应用层校验）
UPDATE "CooperationTicket" SET "platform" = '' WHERE "platform" IS NULL;

-- 必填约束 + 唯一约束
ALTER TABLE "CooperationTicket" ALTER COLUMN "ticketNo" SET NOT NULL;
ALTER TABLE "CooperationTicket" ALTER COLUMN "platform" SET NOT NULL;
CREATE UNIQUE INDEX "CooperationTicket_ticketNo_key" ON "CooperationTicket"("ticketNo");

-- AlterTable: Influencer 新增达人主页ID
ALTER TABLE "Influencer" ADD COLUMN "homepageId" TEXT;

-- CreateTable: FollowUpRecord（打款后15天跟进记录）
CREATE TABLE "FollowUpRecord" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "followNo" INTEGER NOT NULL,
    "noteUrl" TEXT,
    "views" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FollowUpRecord_ticketId_idx" ON "FollowUpRecord"("ticketId");

-- AddForeignKey
ALTER TABLE "FollowUpRecord" ADD CONSTRAINT "FollowUpRecord_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CooperationTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpRecord" ADD CONSTRAINT "FollowUpRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
