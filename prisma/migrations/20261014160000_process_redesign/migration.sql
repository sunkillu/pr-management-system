-- 枚举新增值（本迁移内不引用新值）
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'MAINTAINING';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'AWAITING_DRAFT';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'DRAFT_RETURNED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'PUBLISHED';
ALTER TYPE "TicketKind" ADD VALUE IF NOT EXISTS 'MAINTENANCE';
ALTER TYPE "DocType" ADD VALUE IF NOT EXISTS 'PURCHASE';
ALTER TYPE "DocType" ADD VALUE IF NOT EXISTS 'PURCHASE_LINE';

-- 达人：主页链接、报价模式
ALTER TABLE "Influencer" ADD COLUMN "xhsUrl" TEXT, ADD COLUMN "douyinUrl" TEXT, ADD COLUMN "quoteMode" TEXT;

-- 工单：品牌改为可空（提交审批前必填）
ALTER TABLE "CooperationTicket" ALTER COLUMN "brandId" DROP NOT NULL;

-- 跟进记录：曝光/收藏/转发
ALTER TABLE "FollowUpRecord" ADD COLUMN "impressions" INTEGER, ADD COLUMN "favorites" INTEGER, ADD COLUMN "shares" INTEGER;

-- 寄品：推送仓库记录
ALTER TABLE "SampleShipment" ADD COLUMN "pushedAt" TIMESTAMP(3), ADD COLUMN "pushCount" INTEGER NOT NULL DEFAULT 0;
UPDATE "SampleShipment" SET "pushedAt" = "updatedAt", "pushCount" = 1 WHERE "infoConfirmed" = true;

-- 选项配置：款式 / 抛期 / 度数
DROP INDEX "StyleOption_name_key";
DROP INDEX "StyleOption_isActive_sort_idx";
ALTER TABLE "StyleOption" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'STYLE';
CREATE UNIQUE INDEX "StyleOption_kind_name_key" ON "StyleOption"("kind", "name");
CREATE INDEX "StyleOption_kind_isActive_sort_idx" ON "StyleOption"("kind", "isActive", "sort");

INSERT INTO "StyleOption" ("id", "kind", "name", "sort", "updatedAt") VALUES
  ('period_daily', 'PERIOD', '日抛', 1, CURRENT_TIMESTAMP),
  ('period_weekly', 'PERIOD', '周抛', 2, CURRENT_TIMESTAMP),
  ('period_biweekly', 'PERIOD', '双周抛', 3, CURRENT_TIMESTAMP),
  ('period_monthly', 'PERIOD', '月抛', 4, CURRENT_TIMESTAMP),
  ('period_quarterly', 'PERIOD', '季抛', 5, CURRENT_TIMESTAMP),
  ('period_halfyear', 'PERIOD', '半年抛', 6, CURRENT_TIMESTAMP),
  ('period_yearly', 'PERIOD', '年抛', 7, CURRENT_TIMESTAMP),
  ('degree_0', 'DEGREE', '平光', 0, CURRENT_TIMESTAMP);
INSERT INTO "StyleOption" ("id", "kind", "name", "sort", "updatedAt")
SELECT 'degree_' || n, 'DEGREE', n || '度', n, CURRENT_TIMESTAMP FROM generate_series(50, 1000, 25) AS n;

-- 采买请求
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('PENDING_REVIEW', 'REVIEWED', 'ASSIGNED', 'REJECTED', 'VOIDED');
CREATE TYPE "PurchaseLineStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ASSIGNED');

CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "requestNo" TEXT NOT NULL,
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "note" TEXT,
    "creatorId" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseLine" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "platform" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "PurchaseLineStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "influencerId" TEXT,
    "assigneeId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "ticketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseRequest_requestNo_key" ON "PurchaseRequest"("requestNo");
CREATE INDEX "PurchaseRequest_status_createdAt_idx" ON "PurchaseRequest"("status", "createdAt");
CREATE UNIQUE INDEX "PurchaseLine_ticketId_key" ON "PurchaseLine"("ticketId");
CREATE INDEX "PurchaseLine_requestId_idx" ON "PurchaseLine"("requestId");
CREATE INDEX "PurchaseLine_status_idx" ON "PurchaseLine"("status");

ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CooperationTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
