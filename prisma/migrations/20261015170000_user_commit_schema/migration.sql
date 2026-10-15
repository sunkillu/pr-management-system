-- 用户版 364bcc6c 补齐 schema：主页链接/脚本寄品开关/素材审批/寄品单号/跟进指标/款式选项/采买分配
-- 安全写法：枚举 ADD VALUE 与其他语句同迁移但不使用新值，不触 PG 55P04

-- 枚举新增采买父单状态（仅 ADD VALUE，不在同迁移内使用）
ALTER TYPE "TicketStatus" ADD VALUE 'PROCUREMENT_GENERATED';
ALTER TYPE "TicketStatus" ADD VALUE 'PROCUREMENT_CLOSED';

-- 工单：主页链接 / 脚本寄品开关 / 素材审批
ALTER TABLE "CooperationTicket" ADD COLUMN "homepageLinks" JSONB;
ALTER TABLE "CooperationTicket" ADD COLUMN "scriptRequired" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CooperationTicket" ADD COLUMN "sampleRequired" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CooperationTicket" ADD COLUMN "materialApprovedAt" TIMESTAMP(3);
ALTER TABLE "CooperationTicket" ADD COLUMN "materialApprovedById" TEXT;
ALTER TABLE "CooperationTicket" ADD CONSTRAINT "CooperationTicket_materialApprovedById_fkey" FOREIGN KEY ("materialApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 寄品：寄品单号
ALTER TABLE "SampleShipment" ADD COLUMN "sampleNo" TEXT;
CREATE UNIQUE INDEX "SampleShipment_sampleNo_key" ON "SampleShipment"("sampleNo");

-- 跟进：曝光 / 收藏 / 转发
ALTER TABLE "FollowUpRecord" ADD COLUMN "impressions" INTEGER;
ALTER TABLE "FollowUpRecord" ADD COLUMN "favorites" INTEGER;
ALTER TABLE "FollowUpRecord" ADD COLUMN "shares" INTEGER;

-- 款式选项表
CREATE TABLE "StyleOption" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StyleOption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StyleOption_kind_brandId_name_key" ON "StyleOption"("kind", "brandId", "name");
CREATE INDEX "StyleOption_brandId_kind_isActive_idx" ON "StyleOption"("brandId", "kind", "isActive");
ALTER TABLE "StyleOption" ADD CONSTRAINT "StyleOption_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 采买分配记录表
CREATE TABLE "ProcurementAllocation" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "prId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "ticketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcurementAllocation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProcurementAllocation_itemId_idx" ON "ProcurementAllocation"("itemId");
CREATE INDEX "ProcurementAllocation_prId_idx" ON "ProcurementAllocation"("prId");
ALTER TABLE "ProcurementAllocation" ADD CONSTRAINT "ProcurementAllocation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ProcurementItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcurementAllocation" ADD CONSTRAINT "ProcurementAllocation_prId_fkey" FOREIGN KEY ("prId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcurementAllocation" ADD CONSTRAINT "ProcurementAllocation_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CooperationTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
